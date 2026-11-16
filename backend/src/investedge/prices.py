"""Daily OHLCV download via yfinance (split/dividend-adjusted)."""

import logging

import pandas as pd
import yfinance as yf

from investedge.universe import to_yahoo

log = logging.getLogger(__name__)

PRICE_COLUMNS = ["symbol", "date", "open", "high", "low", "close", "volume"]


def fetch_prices(symbols: list[str], years: int) -> tuple[pd.DataFrame, list[str]]:
    """Return (long-format prices, symbols that failed)."""
    yahoo = {to_yahoo(s): s for s in symbols}
    raw = yf.download(
        list(yahoo),
        period=f"{years}y",
        interval="1d",
        auto_adjust=True,
        group_by="ticker",
        threads=True,
        progress=False,
    )
    frames: list[pd.DataFrame] = []
    failed: list[str] = []
    for ysym, sym in yahoo.items():
        try:
            df = raw[ysym] if isinstance(raw.columns, pd.MultiIndex) else raw
        except KeyError:
            failed.append(sym)
            continue
        df = clean_ohlcv(df)
        if df.empty:
            failed.append(sym)
            continue
        df.insert(0, "symbol", sym)
        frames.append(df)
    if failed:
        log.warning("No data for: %s", ", ".join(failed))
    out = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=PRICE_COLUMNS)
    return out[PRICE_COLUMNS], failed


def clean_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize a yfinance frame: lowercase columns, date column, drop empty/invalid rows."""
    df = df.rename(columns=str.lower).dropna(subset=["open", "high", "low", "close"])
    df = df[(df["close"] > 0) & (df["high"] >= df["low"])]
    df = df.reset_index().rename(columns={"Date": "date", "index": "date"})
    df["date"] = pd.to_datetime(df["date"]).dt.tz_localize(None).dt.normalize()
    df["volume"] = df["volume"].fillna(0).astype("int64")
    return df[["date", "open", "high", "low", "close", "volume"]]
