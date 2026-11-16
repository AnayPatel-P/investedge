import numpy as np
import pandas as pd
import pytest

from investedge import backtest, risk
from investedge.models.forecasters import naive


@pytest.fixture(scope="module")
def close() -> pd.Series:
    rng = np.random.default_rng(7)
    idx = pd.bdate_range("2023-01-02", periods=700)
    return pd.Series(100 * np.exp(np.cumsum(rng.normal(0.0004, 0.015, len(idx)))), index=idx)


# ---------------------------------------------------------------- backtest


def test_origin_positions_end_on_last_day_and_respect_min_history() -> None:
    pos = backtest.origin_positions(n=700, horizon=30, origins=12, spacing=21, min_history=250)
    assert pos[-1] == 700 - 1 - 30  # newest window ends on the last observation
    assert np.all(np.diff(pos) == 21)
    assert len(pos) == 12
    short = backtest.origin_positions(n=300, horizon=30, origins=12, spacing=21, min_history=250)
    assert all(p + 1 >= 250 for p in short) and len(short) < 12


def test_no_look_ahead_leakage(close: pd.Series) -> None:
    """A spy model records the data it sees; it must never see a date after the origin."""
    seen: list[tuple[pd.Timestamp, pd.Timestamp]] = []

    def spy(train: pd.Series, horizon: int) -> pd.DataFrame:
        seen.append((train.index[-1], close.index[len(train) - 1]))
        return naive(train, horizon)

    res = backtest.backtest_symbol("X", close, {"spy": spy}, 30, 12, 21, 250)
    rows = pd.concat(res.rows)
    for last_seen, _ in seen:
        origin_rows = rows[rows["origin"] == last_seen]
        assert (origin_rows["date"] > last_seen).all()  # every scored day is in the future
    # The model only ever received a prefix of the series ending at each origin.
    assert all(a == b for a, b in seen)
    assert len(seen) == 12


def test_actuals_are_real_future_prices(close: pd.Series) -> None:
    res = backtest.backtest_symbol("X", close, {"naive": naive}, 30, 2, 21, 250)
    rows = pd.concat(res.rows)
    looked_up = close.reindex(pd.to_datetime(rows["date"])).to_numpy()
    assert np.allclose(rows["actual"].to_numpy(), looked_up)


def test_score_math_and_baseline_skill() -> None:
    dates = pd.bdate_range("2026-01-01", periods=2)
    origin = pd.Timestamp("2025-12-31")
    base = dict(symbol="X", origin=origin, step=[1, 2], date=dates, actual=[100.0, 110.0])
    naive_rows = pd.DataFrame(
        {
            **base,
            "model": "naive",
            "mean": [90.0, 90.0],
            "lo_80": 0,
            "hi_80": 200,
            "lo_95": 0,
            "hi_95": 200,
        }
    )
    good_rows = pd.DataFrame(
        {
            **base,
            "model": "arima",
            "mean": [100.0, 105.0],
            "lo_80": [99, 104],
            "hi_80": [101, 106],
            "lo_95": 0,
            "hi_95": 200,
        }
    )
    card = backtest.score(pd.concat([naive_rows, good_rows])).set_index("model")
    assert card.loc["naive", "mae"] == pytest.approx(15.0)  # (10 + 20) / 2
    assert card.loc["arima", "mae"] == pytest.approx(2.5)
    assert card.loc["arima", "skill"] == pytest.approx(1 - 2.5 / 15)
    assert card.loc["arima", "coverage_80"] == pytest.approx(0.5)  # 100 in, 110 out
    assert bool(card.loc["arima", "beats_baseline"]) and not bool(
        card.loc["naive", "beats_baseline"]
    )


def test_verdict_is_honest_when_nothing_beats_baseline() -> None:
    card = pd.DataFrame(
        {
            "model": ["naive", "arima"],
            "skill": [0.0, -0.05],
            "beats_baseline": [False, False],
            "mape": [0.05, 0.06],
            "coverage_95": [0.95, 0.9],
        }
    )
    assert "No model beat" in backtest.verdict("TSLA", card)
    assert backtest.coverage_note(card) is None
    card.loc[1, "coverage_95"] = 0.6
    assert "Overconfident" in backtest.coverage_note(card)


# ---------------------------------------------------------------- risk


def test_max_drawdown() -> None:
    assert risk.max_drawdown(pd.Series([100, 120, 60, 90, 130])) == pytest.approx(-0.5)


def test_symbol_metrics_beta_of_market_is_one_and_dividend_yield(close: pd.Series) -> None:
    divs = pd.Series(0.0, index=close.index)
    divs.iloc[-10] = 1.0
    divs.iloc[-100] = 1.0
    divs.iloc[-400] = 5.0  # older than a year: excluded
    m = risk.symbol_metrics(close, divs, close.pct_change().dropna())
    assert m["beta_1y"] == pytest.approx(1.0)
    assert m["dividend_yield"] == pytest.approx(2.0 / close.iloc[-1])
    assert m["volatility_1y"] == pytest.approx(close.pct_change().iloc[-252:].std() * np.sqrt(252))


def metrics_frame() -> pd.DataFrame:
    sectors = [
        "Tech",
        "Tech",
        "Tech",
        "Energy",
        "Utilities",
        "Health",
        "Health",
        "Financials",
        "Staples",
        "Industrials",
        "Materials",
        "Real Estate",
    ]
    n = len(sectors)
    return risk.add_risk_score(
        pd.DataFrame(
            {
                "symbol": [f"S{i}" for i in range(n)],
                "sector": sectors,
                "volatility_1y": np.linspace(0.1, 0.6, n),
                "beta_1y": np.linspace(0.4, 1.8, n),
                "max_drawdown_1y": -np.linspace(0.05, 0.5, n),
                "sharpe_1y": np.linspace(1.0, 0.1, n),
                "dividend_yield": 0.02,
            }
        )
    )


def test_risk_score_orders_and_levels() -> None:
    df = metrics_frame()
    assert df["risk_score"].is_monotonic_increasing
    assert df["risk_level"].iloc[0] == "low" and df["risk_level"].iloc[-1] == "high"


def test_screener_puts_good_fits_first() -> None:
    out = risk.screener(metrics_frame(), "conservative")
    fits = out["fit"].tolist()
    assert fits == sorted(fits, key=risk.FIT_ORDER.get)
    assert out.iloc[0]["risk_level"] == "low"
    with pytest.raises(ValueError):
        risk.screener(metrics_frame(), "yolo")


def test_portfolio_caps_sector_and_only_uses_good_fits() -> None:
    df = metrics_frame()
    for profile in risk.PROFILES:
        holdings = risk.pick_portfolio(df, profile)
        assert holdings["sector"].value_counts().max() <= risk.MAX_PER_SECTOR
        assert set(holdings["risk_level"].map(risk.PROFILES[profile].fit)) == {"good"}
        assert holdings["weight"].sum() == pytest.approx(1.0)


def test_basket_is_less_volatile_than_average_holding() -> None:
    rng = np.random.default_rng(3)
    idx = pd.bdate_range("2025-01-01", periods=300)
    market = rng.normal(0, 0.008, len(idx))
    closes = pd.DataFrame(
        {f"S{i}": 100 * np.cumprod(1 + market + rng.normal(0, 0.02, len(idx))) for i in range(10)},
        index=idx,
    )
    holdings = pd.DataFrame(
        {
            "symbol": closes.columns,
            "sector": [f"sec{i % 5}" for i in range(10)],
            "volatility_1y": closes.pct_change().iloc[-252:].std() * np.sqrt(252),
        }
    )
    stats = risk.basket_stats(closes, holdings.reset_index(drop=True))
    assert stats["volatility_1y"] < stats["avg_holding_volatility_1y"]
    assert "diversification" in risk.portfolio_lesson("moderate", stats)


def test_risk_score_is_a_uniform_percentile() -> None:
    rng = np.random.default_rng(5)
    n = 300
    df = risk.add_risk_score(
        pd.DataFrame(
            {
                "volatility_1y": rng.lognormal(-1.2, 0.4, n),
                "beta_1y": rng.normal(1, 0.4, n),
                "max_drawdown_1y": -rng.uniform(0.05, 0.6, n),
            }
        )
    )
    counts = df["risk_level"].value_counts()
    assert counts.max() - counts.min() <= 2  # equal thirds
    assert df["risk_score"].max() == 100.0
