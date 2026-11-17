"""Export the read-only API as static JSON files for a free static host (GitHub Pages).

The files are produced by calling the real FastAPI app in-process, so they are byte-for-byte the
same shapes the live API returns. Layout (mirrors the API paths):

    data/tickers.json, profiles.json, benchmark.json, runs/latest.json, ai/status.json
    data/stocks/{SYMBOL}/{prices,forecasts,metrics,scorecard,backtest,patterns}.json
    data/screener/{profile}.json            (full ranked list; the browser filters sectors)
    data/example-portfolios/{profile}.json

Search and the AI tutor have no static equivalent: the browser searches tickers.json itself, and
the tutor reports "not available in the static site".
"""

import json
import logging
import shutil
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi.testclient import TestClient

from investedge import risk
from investedge.api import app

log = logging.getLogger(__name__)

STOCK_KINDS = {
    "prices": "",
    "forecasts": "",
    "metrics": "",
    "scorecard": "",
    "backtest": "",
    "patterns": "?days=1300",
}


def compact(x):
    """Trim float noise: prices (|x| >= 10) to cents, small values (fractions, betas) to 4 dp.

    Shapes are unchanged, so the frontend reads static files exactly like API responses."""
    if isinstance(x, float):
        return round(x, 2) if abs(x) >= 10 else round(x, 4)
    if isinstance(x, dict):
        return {k: compact(v) for k, v in x.items()}
    if isinstance(x, list):
        return [compact(v) for v in x]
    return x


def _write(path: Path, data) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(compact(data), separators=(",", ":"), allow_nan=False)
    path.write_text(text)
    return len(text)


def export(out: Path, workers: int = 8) -> dict:
    """Write the static API under `out` (replaced atomically). Returns a small report."""
    t0 = time.perf_counter()
    tmp = out.with_name(out.name + ".tmp")
    if tmp.exists():
        shutil.rmtree(tmp)
    client = TestClient(app)
    sizes: list[int] = []
    missing: list[str] = []

    def get(path: str):
        r = client.get(f"/api{path}")
        return r.json() if r.status_code == 200 else None

    tickers = get("/tickers")
    sizes.append(_write(tmp / "tickers.json", tickers))
    sizes.append(_write(tmp / "profiles.json", get("/profiles")))
    bench = get("/benchmark")
    if bench is not None:
        sizes.append(_write(tmp / "benchmark.json", bench))
    else:
        missing.append("benchmark")
    latest = get("/runs/latest")
    if latest is not None:
        sizes.append(_write(tmp / "runs" / "latest.json", latest))
    sizes.append(
        _write(tmp / "ai" / "status.json", {"configured": False, "static": True, "model": None})
    )

    for p in risk.PROFILES:
        sizes.append(
            _write(tmp / "screener" / f"{p}.json", get(f"/screener?profile={p}&limit=503"))
        )
        port = get(f"/example-portfolios?profile={p}")
        if port is not None:
            sizes.append(_write(tmp / "example-portfolios" / f"{p}.json", port))

    def one(symbol: str) -> list[int]:
        out_sizes = []
        for kind, query in STOCK_KINDS.items():
            data = get(f"/stocks/{symbol}/{kind}{query}")
            if data is None:
                missing.append(f"{symbol}/{kind}")
                continue
            out_sizes.append(_write(tmp / "stocks" / symbol / f"{kind}.json", data))
        return out_sizes

    with ThreadPoolExecutor(max_workers=workers) as pool:
        for s in pool.map(one, [t["symbol"] for t in tickers]):
            sizes.extend(s)

    if out.exists():
        shutil.rmtree(out)
    tmp.rename(out)
    report = {
        "files": len(sizes),
        "megabytes": round(sum(sizes) / 1e6, 1),
        "symbols": len(tickers),
        "missing": missing,
        "seconds": round(time.perf_counter() - t0, 1),
    }
    log.info("Static export: %s", report)
    return report
