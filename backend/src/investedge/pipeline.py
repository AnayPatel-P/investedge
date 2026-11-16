"""Batch jobs: load universe, fetch prices, run forecasts, time models (spike)."""

import logging
import time
from datetime import date

import pandas as pd

from investedge import prices, storage, universe
from investedge.config import settings
from investedge.models.forecasters import MODELS

log = logging.getLogger(__name__)


def load_universe() -> int:
    df = universe.fetch_constituents()
    with storage.connect() as con:
        con.execute("DELETE FROM tickers")
        storage.replace_rows(con, "tickers", df, ["symbol"])
    return len(df)


def load_prices(symbols: list[str]) -> tuple[int, list[str]]:
    df, failed = prices.fetch_prices(symbols, settings.history_years)
    with storage.connect() as con:
        storage.replace_rows(con, "prices", df, ["symbol", "date"])
    return df["symbol"].nunique(), failed


def close_series(con, symbol: str) -> pd.Series:
    df = con.execute("SELECT date, close FROM prices WHERE symbol = ? ORDER BY date", [symbol]).df()
    return pd.Series(df["close"].to_numpy(), index=pd.to_datetime(df["date"]), name=symbol)


def run_forecasts(symbols: list[str], models: list[str]) -> list[tuple[str, str, str]]:
    """Fit `models` for each symbol and store results. Returns list of (symbol, model, error)."""
    errors: list[tuple[str, str, str]] = []
    today = date.today()
    with storage.connect() as con:
        for sym in symbols:
            close = close_series(con, sym)
            if len(close) < 250:
                errors.append((sym, "*", "fewer than 250 trading days"))
                continue
            for name in models:
                try:
                    fc = MODELS[name](close, settings.forecast_horizon)
                except Exception as exc:  # noqa: BLE001 - record and move on
                    errors.append((sym, name, repr(exc)))
                    continue
                fc.insert(0, "run_date", today)
                fc.insert(0, "model", name)
                fc.insert(0, "symbol", sym)
                con.execute("DELETE FROM forecasts WHERE symbol = ? AND model = ?", [sym, name])
                storage.replace_rows(con, "forecasts", fc, ["symbol", "model", "date"])
    return errors


def time_models(symbols: list[str], models: list[str]) -> pd.DataFrame:
    """Spike: seconds per fit for each model on each symbol (no storage)."""
    rows = []
    with storage.connect(read_only=True) as con:
        series = {s: close_series(con, s) for s in symbols}
    for name in models:
        MODELS[name](series[symbols[0]], settings.forecast_horizon)  # warm-up (imports/JIT)
        for sym, close in series.items():
            t0 = time.perf_counter()
            MODELS[name](close, settings.forecast_horizon)
            rows.append({"model": name, "symbol": sym, "seconds": time.perf_counter() - t0})
    return pd.DataFrame(rows)
