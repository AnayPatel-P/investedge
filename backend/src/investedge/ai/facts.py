"""Grounding data for the AI tutor, read from the same DuckDB store the UI uses.

Every number the model is allowed to state comes from these functions (via the summary
prompt or the chat tools). Values are rounded so the model quotes them consistently.
"""

from typing import Any

import pandas as pd

from investedge import backtest, risk, storage

PERIODS = {"1m": 22, "6m": 126, "1y": 252, "5y": 1300}


def _r(v: Any, n: int = 4) -> Any:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    return round(float(v), n) if isinstance(v, (int, float)) else v


def known_symbol(symbol: str) -> bool:
    with storage.connect(read_only=True) as con:
        return (
            con.execute("SELECT 1 FROM tickers WHERE symbol = ?", [symbol.upper()]).fetchone()
            is not None
        )


def metrics(symbol: str) -> dict:
    sym = symbol.upper()
    with storage.connect(read_only=True) as con:
        df = con.execute(
            "SELECT m.*, t.name, t.sector FROM metrics m JOIN tickers t USING (symbol) WHERE symbol = ?",
            [sym],
        ).df()
    if df.empty:
        return {"symbol": sym, "error": "no metrics available"}
    row = df.iloc[0]
    out = {
        "symbol": sym,
        "name": row["name"],
        "sector": row["sector"],
        "as_of": str(pd.Timestamp(row["as_of"]).date()),
        "last_close": _r(row["last_close"], 2),
        "return_1y": _r(row["return_1y"]),
        "volatility_1y": _r(row["volatility_1y"]),
        "beta_1y_vs_sp500": _r(row["beta_1y"], 2),
        "max_drawdown_1y": _r(row["max_drawdown_1y"]),
        "max_drawdown_5y": _r(row["max_drawdown_5y"]),
        "dividend_yield_ttm": _r(row["dividend_yield"]),
        "return_per_unit_risk_1y": _r(row["sharpe_1y"], 2),
        "risk_score_percentile": _r(row["risk_score"], 1),
        "risk_level": row["risk_level"],
        "risk_sentence": risk.risk_sentence(row["risk_score"]),
        "profile_fit": {
            k: p.fit.get(str(row["risk_level"]), "outside") for k, p in risk.PROFILES.items()
        },
        "units": "fractions (0.25 = 25%); prices in USD",
    }
    return out


def forecasts(symbol: str) -> dict:
    """End-of-horizon summary per model (not every daily point - keeps tokens low)."""
    sym = symbol.upper()
    with storage.connect(read_only=True) as con:
        df = con.execute(
            "SELECT model, date, mean, lo_80, hi_80, lo_95, hi_95 FROM forecasts WHERE symbol = ? ORDER BY model, date",
            [sym],
        ).df()
    if df.empty:
        return {"symbol": sym, "error": "no forecasts (too little history to model)"}
    models = {}
    for model, g in df.groupby("model"):
        last = g.iloc[-1]
        models[str(model)] = {
            "horizon_end": str(pd.Timestamp(last["date"]).date()),
            "trading_days_ahead": len(g),
            "central_guess": _r(last["mean"], 2),
            "range_80": [_r(last["lo_80"], 2), _r(last["hi_80"], 2)],
            "range_95": [_r(last["lo_95"], 2), _r(last["hi_95"], 2)],
        }
    return {
        "symbol": sym,
        "models": models,
        "notes": "naive = 'price stays the same' baseline. garch forecasts swing size only (flat centre).",
    }


def scorecard(symbol: str) -> dict:
    sym = symbol.upper()
    with storage.connect(read_only=True) as con:
        card = con.execute(
            "SELECT model, n_origins, mae, mape, coverage_80, coverage_95, skill, beats_baseline "
            "FROM scorecard WHERE symbol = ?",
            [sym],
        ).df()
    return {
        "symbol": sym,
        "verdict": backtest.verdict(sym, card),
        "coverage_note": backtest.coverage_note(card),
        "models": [
            {
                "model": r["model"],
                "replays": int(r["n_origins"]),
                "typical_miss_pct_of_price": _r(r["mape"]),
                "caught_by_95_range": _r(r["coverage_95"], 3),
                "caught_by_80_range": _r(r["coverage_80"], 3),
                "skill_vs_naive": _r(r["skill"], 3),
                "beats_naive": bool(r["beats_baseline"]),
            }
            for _, r in card.iterrows()
        ],
        "how_tested": "12 monthly replays over the past year; each model saw only prices up to the replay date, then 30 trading days were compared with reality.",
    }


def price_history(symbol: str, period: str = "1y") -> dict:
    """Summary stats plus a coarse sample of closes (weekly-ish), not the full series."""
    sym = symbol.upper()
    n = PERIODS.get(period, 252)
    with storage.connect(read_only=True) as con:
        df = con.execute(
            "SELECT date, close, high, low FROM prices WHERE symbol = ? ORDER BY date DESC LIMIT ?",
            [sym, n],
        ).df()
    if df.empty:
        return {"symbol": sym, "error": "no prices"}
    df = df.iloc[::-1].reset_index(drop=True)
    step = max(1, len(df) // 26)
    sample = df.iloc[::step]
    return {
        "symbol": sym,
        "period": period,
        "start": {
            "date": str(pd.Timestamp(df["date"].iloc[0]).date()),
            "close": _r(df["close"].iloc[0], 2),
        },
        "end": {
            "date": str(pd.Timestamp(df["date"].iloc[-1]).date()),
            "close": _r(df["close"].iloc[-1], 2),
        },
        "change": _r(df["close"].iloc[-1] / df["close"].iloc[0] - 1),
        "high": _r(df["high"].max(), 2),
        "low": _r(df["low"].min(), 2),
        "sampled_closes": [
            [str(pd.Timestamp(d).date()), _r(c, 2)]
            for d, c in zip(sample["date"], sample["close"], strict=True)
        ],
    }


def summary_facts(symbol: str) -> dict:
    """Everything a summary may cite, in one compact object."""
    return {
        "metrics": metrics(symbol),
        "scorecard": scorecard(symbol),
        "forecasts": forecasts(symbol),
        "past_year": {
            k: v for k, v in price_history(symbol, "1y").items() if k != "sampled_closes"
        },
    }
