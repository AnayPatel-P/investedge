"""Risk metrics, risk-profile fit, screener ranking and example portfolios.

Everything here is descriptive (what *has* happened) and educational. Example portfolios are
rule-based illustrations of diversification, never recommendations.
"""

from dataclasses import dataclass

import numpy as np
import pandas as pd

TRADING_YEAR = 252


# ---------------------------------------------------------------- metrics


def max_drawdown(close: pd.Series) -> float:
    """Worst peak-to-trough fall, as a negative fraction (e.g. -0.35)."""
    if close.empty:
        return float("nan")
    return float((close / close.cummax() - 1).min())


def symbol_metrics(
    close: pd.Series, dividends: pd.Series, bench_returns: pd.Series
) -> dict[str, float]:
    """Trailing metrics for one symbol. `close` and `dividends` share a date index."""
    out: dict[str, float] = {"last_close": float(close.iloc[-1])}
    returns = close.pct_change().dropna()
    year = returns.iloc[-TRADING_YEAR:]
    has_year = len(close) > TRADING_YEAR

    out["return_1y"] = (
        float(close.iloc[-1] / close.iloc[-TRADING_YEAR - 1] - 1) if has_year else np.nan
    )
    out["volatility_1y"] = float(year.std() * np.sqrt(TRADING_YEAR)) if len(year) > 20 else np.nan

    aligned = pd.concat([year, bench_returns], axis=1, join="inner").dropna()
    if len(aligned) > 20 and aligned.iloc[:, 1].var() > 0:
        cov = np.cov(aligned.iloc[:, 0], aligned.iloc[:, 1])
        out["beta_1y"] = float(cov[0, 1] / cov[1, 1])
    else:
        out["beta_1y"] = np.nan

    out["max_drawdown_1y"] = max_drawdown(close.iloc[-TRADING_YEAR - 1 :])
    out["max_drawdown_5y"] = max_drawdown(close)

    since = close.index[-1] - pd.Timedelta(days=365)
    out["dividend_yield"] = float(dividends[dividends.index > since].sum() / close.iloc[-1])

    vol = out["volatility_1y"]
    out["sharpe_1y"] = (
        float(year.mean() * TRADING_YEAR / vol)
        if has_year and vol and not np.isnan(vol)
        else np.nan
    )
    return out


def compute_metrics(prices: pd.DataFrame, benchmark: str) -> pd.DataFrame:
    """prices: long frame (symbol, date, close, dividend). Returns one row per non-benchmark
    symbol with metrics, a 0-100 relative risk score and a Low/Medium/High risk level."""
    prices = prices.assign(date=pd.to_datetime(prices["date"]))
    bench = prices[prices["symbol"] == benchmark].set_index("date")["close"]
    bench_returns = bench.pct_change().dropna().rename("bench")

    rows = []
    for sym, g in prices[prices["symbol"] != benchmark].groupby("symbol", sort=True):
        g = g.set_index("date").sort_index()
        if len(g) < 30:
            continue
        rows.append(
            {
                "symbol": sym,
                "as_of": g.index[-1].date(),
                **symbol_metrics(g["close"], g["dividend"], bench_returns),
            }
        )
    df = pd.DataFrame(rows)
    return add_risk_score(df)


def add_risk_score(df: pd.DataFrame) -> pd.DataFrame:
    """Risk score = percentile rank of the average of the volatility, beta and 1y drawdown
    ranks. 50 means 'riskier than half of the S&P 500'; terciles give Low/Medium/High."""
    parts = pd.concat(
        [
            df["volatility_1y"].rank(pct=True),
            df["beta_1y"].rank(pct=True),
            (-df["max_drawdown_1y"]).rank(pct=True),
        ],
        axis=1,
    )
    df = df.copy()
    # Rank the composite so the score is a true percentile: "riskier than X% of stocks".
    composite = parts.mean(axis=1, skipna=True)
    df["risk_score"] = (composite.rank(pct=True) * 100).round(1)
    df["risk_level"] = pd.cut(
        df["risk_score"], bins=[-0.1, 100 / 3, 200 / 3, 100.1], labels=["low", "medium", "high"]
    ).astype("string")
    return df


# ---------------------------------------------------------------- profiles


@dataclass(frozen=True)
class Profile:
    key: str
    label: str
    description: str
    fit: dict[str, str]  # risk_level -> "good" | "possible" | "outside"
    portfolio_sort: tuple[str, bool]  # (column, ascending)
    view: dict  # hints for the frontend forecast view


PROFILES: dict[str, Profile] = {
    "conservative": Profile(
        "conservative",
        "Conservative",
        "You'd rather grow slowly than see big drops. Stability and dividends matter most.",
        {"low": "good", "medium": "possible", "high": "outside"},
        ("risk_score", True),
        {
            "bands": [95],
            "emphasis": "downside",
            "default_models": ["naive", "garch"],
            "explanation_focus": ["stability", "dividends", "drawdowns"],
        },
    ),
    "moderate": Profile(
        "moderate",
        "Moderate",
        "You accept some ups and downs for better long-term growth.",
        {"low": "good", "medium": "good", "high": "possible"},
        ("sharpe_1y", False),
        {
            "bands": [80, 95],
            "emphasis": "balanced",
            "default_models": ["naive", "arima", "ets"],
            "explanation_focus": ["risk vs. return", "diversification"],
        },
    ),
    "aggressive": Profile(
        "aggressive",
        "Aggressive",
        "You're comfortable with big swings in pursuit of higher growth.",
        {"low": "possible", "medium": "good", "high": "good"},
        ("sharpe_1y", False),
        {
            "bands": [80],
            "emphasis": "full model spread",
            "default_models": ["naive", "arima", "ets", "prophet", "garch"],
            "explanation_focus": ["growth", "volatility", "momentum vs. luck"],
        },
    ),
}
FIT_ORDER = {"good": 0, "possible": 1, "outside": 2}


def get_profile(key: str) -> Profile:
    try:
        return PROFILES[key.lower()]
    except KeyError as exc:
        raise ValueError(f"Unknown profile {key!r}; choose one of {', '.join(PROFILES)}") from exc


def risk_sentence(score: float) -> str:
    if pd.isna(score):
        return "Not enough history to compare risk yet."
    return (
        f"Riskier than {score:.0f}% of S&P 500 stocks "
        "(based on swings, market sensitivity and drops)."
    )


def screener(metrics: pd.DataFrame, profile: str, sector: str | None = None) -> pd.DataFrame:
    """Rank stocks for a profile: best fit first, then by return per unit of risk (1y)."""
    p = get_profile(profile)
    df = metrics.copy()
    if sector:
        df = df[df["sector"].str.lower() == sector.lower()]
    df["fit"] = df["risk_level"].map(p.fit).fillna("outside")
    df["fit_rank"] = df["fit"].map(FIT_ORDER)
    df["risk_sentence"] = df["risk_score"].map(risk_sentence)
    return df.sort_values(
        ["fit_rank", "sharpe_1y"], ascending=[True, False], na_position="last"
    ).drop(columns="fit_rank")


# ---------------------------------------------------------------- example portfolios

PORTFOLIO_SIZE = 10
MAX_PER_SECTOR = 2


def pick_portfolio(metrics: pd.DataFrame, profile: str) -> pd.DataFrame:
    """Greedy, rule-based pick: 'good fit' stocks ranked by the profile's sort key,
    at most MAX_PER_SECTOR per sector, equal weights."""
    p = get_profile(profile)
    col, asc = p.portfolio_sort
    pool = metrics[metrics["risk_level"].map(p.fit) == "good"].dropna(subset=[col, "sector"])
    pool = pool.sort_values(col, ascending=asc)
    picked: list[pd.Series] = []
    per_sector: dict[str, int] = {}
    for _, row in pool.iterrows():
        if per_sector.get(row["sector"], 0) >= MAX_PER_SECTOR:
            continue
        picked.append(row)
        per_sector[row["sector"]] = per_sector.get(row["sector"], 0) + 1
        if len(picked) == PORTFOLIO_SIZE:
            break
    out = pd.DataFrame(picked)
    if not out.empty:
        out["weight"] = 1 / len(out)
    return out


def basket_stats(closes: pd.DataFrame, holdings: pd.DataFrame) -> dict[str, float]:
    """closes: wide frame (date x symbol). Equal-weight, daily-rebalanced basket over 1y."""
    rets = closes[holdings["symbol"]].pct_change().iloc[-TRADING_YEAR:].dropna(how="all")
    basket = rets.mean(axis=1)
    growth = (1 + basket).cumprod()
    return {
        "volatility_1y": float(basket.std() * np.sqrt(TRADING_YEAR)),
        "return_1y": float(growth.iloc[-1] - 1),
        "max_drawdown_1y": max_drawdown(growth),
        "avg_holding_volatility_1y": float(holdings["volatility_1y"].mean()),
        "sectors": int(holdings["sector"].nunique()),
    }


def portfolio_lesson(profile: str, stats: dict[str, float]) -> str:
    cut = 1 - stats["volatility_1y"] / stats["avg_holding_volatility_1y"]
    p = get_profile(profile)
    return (
        f"These {PORTFOLIO_SIZE} stocks swung {stats['avg_holding_volatility_1y']:.0%} a year on "
        f"average on their own, but together the basket swung only {stats['volatility_1y']:.0%} "
        f"— about {cut:.0%} less. That's diversification: spreading across "
        f"{stats['sectors']} sectors means one company's bad day is softened by the others. "
        f"The stocks were picked by a simple rule for a {p.label.lower()} profile using the past "
        f"year's data, and past results don't predict future ones."
    )


DISCLAIMER = (
    "Example for learning only, not a recommendation or financial advice. "
    "Built by a fixed rule from past data; it does not know your situation."
)
