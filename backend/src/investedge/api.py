"""Read-only HTTP API over the precomputed DuckDB store."""

import json

import pandas as pd
from fastapi import FastAPI, HTTPException, Query

from investedge import backtest, risk, storage
from investedge.config import settings

app = FastAPI(title="InvestEdge API", version="0.1.0")


def _rows(sql: str, params: list) -> list[dict]:
    with storage.connect(read_only=True) as con:
        df = con.execute(sql, params).df()
    for col in df.columns:
        if str(df[col].dtype).startswith("datetime"):
            df[col] = df[col].dt.strftime("%Y-%m-%d")
    return df.to_dict(orient="records")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/tickers")
def tickers(with_data: bool = True) -> list[dict]:
    """Constituents with their last price date; `stale` means the latest session is missing."""
    join = "JOIN" if with_data else "LEFT JOIN"
    return _rows(
        "WITH last AS (SELECT symbol, max(date) AS last_date FROM prices GROUP BY symbol) "
        "SELECT t.symbol, t.name, t.sector, l.last_date, "
        "coalesce(l.last_date < (SELECT max(last_date) FROM last), true) AS stale "
        f"FROM tickers t {join} last l USING (symbol) ORDER BY t.symbol",
        [],
    )


@app.get("/api/runs/latest")
def latest_run() -> dict:
    path = settings.data_dir / "reports" / "latest.json"
    if not path.exists():
        raise HTTPException(404, "No pipeline run yet")
    return json.loads(path.read_text())


@app.get("/api/stocks/{symbol}/prices")
def stock_prices(symbol: str) -> list[dict]:
    rows = _rows(
        "SELECT date, open, high, low, close, volume FROM prices WHERE symbol = ? ORDER BY date",
        [symbol.upper()],
    )
    if not rows:
        raise HTTPException(404, f"No price data for {symbol.upper()}")
    return rows


@app.get("/api/stocks/{symbol}/forecasts")
def stock_forecasts(symbol: str) -> dict[str, list[dict]]:
    rows = _rows(
        "SELECT model, date, mean, lo_80, hi_80, lo_95, hi_95 FROM forecasts "
        "WHERE symbol = ? ORDER BY model, date",
        [symbol.upper()],
    )
    out: dict[str, list[dict]] = {}
    for r in rows:
        out.setdefault(r.pop("model"), []).append(r)
    return out


def _metrics_frame() -> pd.DataFrame:
    with storage.connect(read_only=True) as con:
        return con.execute(
            "SELECT m.*, t.name, t.sector FROM metrics m JOIN tickers t USING (symbol)"
        ).df()


def _records(df: pd.DataFrame) -> list[dict]:
    """JSON-safe records (NaN -> null, dates -> ISO strings)."""
    df = df.astype(object).where(df.notna(), None)
    return [
        {k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in row.items()}
        for row in df.to_dict(orient="records")
    ]


def _profile(key: str) -> risk.Profile:
    try:
        return risk.get_profile(key)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.get("/api/profiles")
def profiles() -> list[dict]:
    """Risk profiles with their fit rules and forecast-view hints for the frontend."""
    return [
        {"key": p.key, "label": p.label, "description": p.description, "fit": p.fit, "view": p.view}
        for p in risk.PROFILES.values()
    ]


@app.get("/api/search")
def search(q: str = Query(min_length=1, max_length=40), limit: int = 10) -> list[dict]:
    """Type-ahead by ticker or company name; exact/prefix ticker matches rank first."""
    needle = q.strip().upper()
    return _rows(
        "SELECT symbol, name, sector FROM tickers "
        "WHERE upper(symbol) LIKE ? || '%' OR upper(name) LIKE '%' || ? || '%' "
        "ORDER BY (upper(symbol) = ?) DESC, (upper(symbol) LIKE ? || '%') DESC, symbol LIMIT ?",
        [needle, needle, needle, needle, min(limit, 50)],
    )


@app.get("/api/stocks/{symbol}/metrics")
def stock_metrics(symbol: str) -> dict:
    df = _metrics_frame()
    row = df[df["symbol"] == symbol.upper()]
    if row.empty:
        raise HTTPException(404, f"No metrics for {symbol.upper()}")
    rec = _records(row)[0]
    rec["risk_sentence"] = risk.risk_sentence(row["risk_score"].iloc[0])
    rec["fit"] = {k: p.fit.get(str(rec["risk_level"]), "outside") for k, p in risk.PROFILES.items()}
    return rec


@app.get("/api/stocks/{symbol}/scorecard")
def stock_scorecard(symbol: str) -> dict:
    sym = symbol.upper()
    with storage.connect(read_only=True) as con:
        card = con.execute(
            "SELECT model, run_date, n_origins, mae, mape, coverage_80, coverage_95, skill, "
            "beats_baseline FROM scorecard WHERE symbol = ? ORDER BY skill DESC NULLS LAST",
            [sym],
        ).df()
    return {
        "symbol": sym,
        "baseline": backtest.BASELINE,
        "verdict": backtest.verdict(sym, card),
        "coverage_note": backtest.coverage_note(card),
        "models": _records(card),
    }


@app.get("/api/stocks/{symbol}/backtest")
def stock_backtest(symbol: str) -> dict:
    """Past forecasts at each rolling origin vs. what actually happened ("Rewind & Release").
    Shape: {origins: [date], runs: {origin: {model: [{step, date, actual, mean, lo_80, ...}]}}}"""
    sym = symbol.upper()
    rows = _rows(
        "SELECT origin, model, step, date, actual, mean, lo_80, hi_80, lo_95, hi_95 "
        "FROM backtest_forecasts WHERE symbol = ? ORDER BY origin, model, step",
        [sym],
    )
    runs: dict[str, dict[str, list[dict]]] = {}
    for r in rows:
        origin = str(r.pop("origin"))
        runs.setdefault(origin, {}).setdefault(r.pop("model"), []).append(r)
    return {"symbol": sym, "origins": sorted(runs), "runs": runs}


@app.get("/api/screener")
def screen(
    profile: str, sector: str | None = None, fit: str | None = None, limit: int = 50
) -> dict:
    p = _profile(profile)
    df = risk.screener(_metrics_frame(), p.key, sector)
    if fit:
        df = df[df["fit"] == fit]
    cols = [
        "symbol",
        "name",
        "sector",
        "fit",
        "risk_level",
        "risk_score",
        "risk_sentence",
        "volatility_1y",
        "beta_1y",
        "max_drawdown_1y",
        "return_1y",
        "dividend_yield",
        "sharpe_1y",
    ]
    return {"profile": p.key, "total": len(df), "results": _records(df[cols].head(min(limit, 503)))}


@app.get("/api/example-portfolios")
def example_portfolio(profile: str) -> dict:
    p = _profile(profile)
    holdings = risk.pick_portfolio(_metrics_frame(), p.key)
    if holdings.empty:
        raise HTTPException(404, "Not enough data to build an example portfolio")
    with storage.connect(read_only=True) as con:
        px = con.execute(
            "SELECT symbol, date, close FROM prices WHERE list_contains(?, symbol)",
            [holdings["symbol"].tolist()],
        ).df()
    closes = px.pivot(index="date", columns="symbol", values="close").sort_index()
    stats = risk.basket_stats(closes, holdings)
    cols = ["symbol", "name", "sector", "weight", "risk_level", "volatility_1y", "dividend_yield"]
    return {
        "profile": p.key,
        "label": f"Example {p.label.lower()} portfolio",
        "disclaimer": risk.DISCLAIMER,
        "rule": (
            f"Up to {risk.PORTFOLIO_SIZE} stocks that are a 'good fit' for this profile, at most "
            f"{risk.MAX_PER_SECTOR} per sector, ranked by "
            + (
                "lowest risk score"
                if p.portfolio_sort[0] == "risk_score"
                else "past-year return per unit of risk"
            )
            + ", equal weights."
        ),
        "holdings": _records(holdings[cols]),
        "stats": stats,
        "lesson": risk.portfolio_lesson(p.key, stats),
    }
