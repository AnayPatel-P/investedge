"""Batch jobs: universe, incremental prices, parallel forecasts, run report, spike timing."""

import json
import logging
import os
import time
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import asdict, dataclass, field
from datetime import date, datetime

import pandas as pd

from investedge import prices, storage, universe
from investedge.config import settings
from investedge.models.forecasters import MODELS

log = logging.getLogger(__name__)
MIN_HISTORY = 250  # trading days needed before we fit anything


# ---------------------------------------------------------------- universe + prices


def load_universe() -> int:
    df = universe.fetch_constituents()
    with storage.connect() as con:
        con.execute("DELETE FROM tickers")
        storage.replace_rows(con, "tickers", df, ["symbol"])
    return len(df)


def all_symbols() -> list[str]:
    with storage.connect(read_only=True) as con:
        return [r[0] for r in con.execute("SELECT symbol FROM tickers ORDER BY symbol").fetchall()]


def load_prices(symbols: list[str]) -> prices.FetchResult:
    with storage.connect() as con:
        last_dates = dict(
            con.execute("SELECT symbol, max(date) FROM prices GROUP BY symbol").fetchall()
        )
        last_dates = {s: d for s, d in last_dates.items() if s in set(symbols)}

        def stored_tail(sym: str, since: date) -> pd.DataFrame:
            df = con.execute(
                "SELECT date, close FROM prices WHERE symbol = ? AND date >= ?", [sym, since]
            ).df()
            df["date"] = pd.to_datetime(df["date"])
            return df

        result = prices.fetch_prices(symbols, settings.history_years, last_dates, stored_tail)
        for sym in result.readjusted:  # full history replaces the old adjusted series
            con.execute("DELETE FROM prices WHERE symbol = ?", [sym])
        storage.replace_rows(con, "prices", result.prices, ["symbol", "date"])
    return result


def close_series(con, symbol: str) -> pd.Series:
    df = con.execute("SELECT date, close FROM prices WHERE symbol = ? ORDER BY date", [symbol]).df()
    return pd.Series(df["close"].to_numpy(), index=pd.to_datetime(df["date"]), name=symbol)


def load_close_panel(symbols: list[str]) -> dict[str, pd.Series]:
    with storage.connect(read_only=True) as con:
        df = con.execute(
            "SELECT symbol, date, close FROM prices WHERE list_contains(?, symbol) "
            "ORDER BY symbol, date",
            [symbols],
        ).df()
    df["date"] = pd.to_datetime(df["date"])
    return {
        str(sym): pd.Series(g["close"].to_numpy(), index=g["date"], name=str(sym))
        for sym, g in df.groupby("symbol", sort=False)
    }


# ---------------------------------------------------------------- forecasts


@dataclass
class SymbolForecast:
    symbol: str
    frames: dict[str, pd.DataFrame] = field(default_factory=dict)
    errors: dict[str, str] = field(default_factory=dict)
    seconds: dict[str, float] = field(default_factory=dict)


def forecast_symbol(
    symbol: str, close: pd.Series, models: list[str], horizon: int
) -> SymbolForecast:
    """Fit every model for one symbol. Runs inside worker processes; never raises."""
    out = SymbolForecast(symbol)
    if len(close) < MIN_HISTORY:
        out.errors["*"] = f"only {len(close)} trading days (< {MIN_HISTORY})"
        return out
    for name in models:
        t0 = time.perf_counter()
        try:
            out.frames[name] = MODELS[name](close, horizon)
        except Exception as exc:  # noqa: BLE001 - record and move on
            out.errors[name] = repr(exc)[:300]
        out.seconds[name] = time.perf_counter() - t0
    return out


def default_workers() -> int:
    return max(1, (os.cpu_count() or 2) - 1)


def run_forecasts(
    symbols: list[str], models: list[str], workers: int | None = None
) -> list[SymbolForecast]:
    """Fit models for all symbols in parallel; the main process does all DB writes."""
    panel = load_close_panel(symbols)
    missing = [s for s in symbols if s not in panel]
    results = [SymbolForecast(s, errors={"*": "no price data"}) for s in missing]
    horizon = settings.forecast_horizon
    workers = workers or default_workers()

    todo = [(s, panel[s]) for s in symbols if s in panel]
    if workers == 1:
        results += [forecast_symbol(s, c, models, horizon) for s, c in todo]
    else:
        with ProcessPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(forecast_symbol, s, c, models, horizon) for s, c in todo]
            for i, fut in enumerate(as_completed(futures), 1):
                results.append(fut.result())
                if i % 50 == 0:
                    log.info("Forecasts: %d/%d symbols", i, len(todo))

    _store_forecasts(results)
    return results


def _store_forecasts(results: list[SymbolForecast]) -> None:
    today = date.today()
    batch = []
    for r in results:
        for name, fc in r.frames.items():
            fc = fc.copy()
            fc.insert(0, "run_date", today)
            fc.insert(0, "model", name)
            fc.insert(0, "symbol", r.symbol)
            batch.append(fc)
    if not batch:
        return
    df = pd.concat(batch, ignore_index=True)
    with storage.connect() as con:
        # Replace each (symbol, model) forecast wholesale so stale horizon dates don't linger.
        pairs = df[["symbol", "model"]].drop_duplicates()
        con.register("pairs", pairs)
        con.execute(
            "DELETE FROM forecasts f USING pairs p WHERE f.symbol = p.symbol AND f.model = p.model"
        )
        con.unregister("pairs")
        storage.replace_rows(con, "forecasts", df, ["symbol", "model", "date"])


# ---------------------------------------------------------------- run report


@dataclass
class RunReport:
    started: str
    finished: str = ""
    universe_size: int = 0
    symbols: int = 0
    prices_full: int = 0
    prices_incremental: int = 0
    prices_readjusted: int = 0
    prices_unchanged: int = 0
    prices_failed: list[str] = field(default_factory=list)
    stale: list[str] = field(default_factory=list)
    forecast_ok: dict[str, int] = field(default_factory=dict)
    forecast_errors: list[dict] = field(default_factory=list)
    model_seconds: dict[str, float] = field(default_factory=dict)
    stage_seconds: dict[str, float] = field(default_factory=dict)
    coverage_pct: float = 0.0

    def summary(self) -> str:
        lines = [
            f"Run {self.started} -> {self.finished}",
            f"Universe {self.universe_size} | processed {self.symbols}",
            f"Prices: full {self.prices_full}, incremental {self.prices_incremental}, "
            f"re-adjusted {self.prices_readjusted}, unchanged {self.prices_unchanged}, "
            f"failed {len(self.prices_failed)}",
            f"Stale (no data for latest session): {len(self.stale)} {self.stale[:10]}",
            "Forecasts OK per model: "
            + ", ".join(f"{m} {n}" for m, n in sorted(self.forecast_ok.items())),
            f"Forecast errors: {len(self.forecast_errors)}",
            "Stage seconds: " + ", ".join(f"{k} {v:.1f}" for k, v in self.stage_seconds.items()),
            "Model CPU-seconds: "
            + ", ".join(f"{k} {v:.1f}" for k, v in sorted(self.model_seconds.items())),
            f"Coverage (data + all models): {self.coverage_pct:.1f}%",
        ]
        return "\n".join(lines)


def stale_symbols(symbols: list[str]) -> list[str]:
    """Symbols whose latest price is older than the most recent session in the store."""
    with storage.connect(read_only=True) as con:
        rows = con.execute(
            "WITH last AS (SELECT symbol, max(date) d FROM prices GROUP BY symbol) "
            "SELECT symbol FROM last WHERE d < (SELECT max(d) FROM last) "
            "AND list_contains(?, symbol) ORDER BY symbol",
            [symbols],
        ).fetchall()
    return [r[0] for r in rows]


def save_report(report: RunReport) -> str:
    reports = settings.data_dir / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    path = reports / f"run-{report.started.replace(':', '').replace('-', '')}.json"
    path.write_text(json.dumps(asdict(report), indent=2))
    (reports / "latest.json").write_text(path.read_text())
    return str(path)


def refresh(symbols: list[str] | None, models: list[str], workers: int | None = None) -> RunReport:
    """Full nightly job. `symbols=None` means the whole universe."""
    report = RunReport(started=datetime.now().isoformat(timespec="seconds"))

    t = time.perf_counter()
    report.universe_size = load_universe()
    symbols = symbols or all_symbols()
    report.symbols = len(symbols)
    report.stage_seconds["universe"] = time.perf_counter() - t

    t = time.perf_counter()
    fetched = load_prices(symbols)
    report.prices_full = len(fetched.full)
    report.prices_incremental = len(fetched.incremental)
    report.prices_readjusted = len(fetched.readjusted)
    report.prices_unchanged = len(fetched.unchanged)
    report.prices_failed = sorted(fetched.failed)
    report.stale = stale_symbols(symbols)
    report.stage_seconds["prices"] = time.perf_counter() - t

    t = time.perf_counter()
    results = run_forecasts(symbols, models, workers)
    report.stage_seconds["forecasts"] = time.perf_counter() - t

    ok: dict[str, int] = defaultdict(int)
    secs: dict[str, float] = defaultdict(float)
    complete = 0
    for r in results:
        for m in r.frames:
            ok[m] += 1
        for m, s in r.seconds.items():
            secs[m] += s
        for m, e in r.errors.items():
            report.forecast_errors.append({"symbol": r.symbol, "model": m, "error": e})
        complete += len(r.frames) == len(models)
    report.forecast_ok = dict(ok)
    report.model_seconds = dict(secs)
    report.coverage_pct = 100 * complete / max(1, len(symbols))
    report.finished = datetime.now().isoformat(timespec="seconds")
    save_report(report)
    return report


# ---------------------------------------------------------------- spike


def time_models(symbols: list[str], models: list[str]) -> pd.DataFrame:
    """Spike: seconds per fit for each model on each symbol (no storage)."""
    rows = []
    series = load_close_panel(symbols)
    for name in models:
        MODELS[name](series[symbols[0]], settings.forecast_horizon)  # warm-up (imports/JIT)
        for sym, close in series.items():
            t0 = time.perf_counter()
            MODELS[name](close, settings.forecast_horizon)
            rows.append({"model": name, "symbol": sym, "seconds": time.perf_counter() - t0})
    return pd.DataFrame(rows)
