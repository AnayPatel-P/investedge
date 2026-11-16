"""Read-only HTTP API over the precomputed DuckDB store."""

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

from investedge import storage
from investedge.config import PROJECT_ROOT

app = FastAPI(title="InvestEdge API", version="0.1.0")

SKELETON_PAGE = PROJECT_ROOT / "frontend" / "skeleton" / "index.html"


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
    sql = "SELECT t.symbol, t.name, t.sector FROM tickers t"
    if with_data:
        sql += " WHERE EXISTS (SELECT 1 FROM prices p WHERE p.symbol = t.symbol)"
    return _rows(sql + " ORDER BY t.symbol", [])


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


@app.get("/", include_in_schema=False)
def skeleton_page() -> FileResponse:
    """Throwaway Phase 1 page; replaced by the real frontend in Phase 4."""
    return FileResponse(SKELETON_PAGE)
