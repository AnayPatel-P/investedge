"""Daily OHLCV download via yfinance (split/dividend-adjusted).

Incremental strategy
--------------------
* New symbols get full history.
* Known symbols are fetched from (last stored date - OVERLAP_DAYS). Because prices are
  adjusted, a new dividend or split rescales *all* past prices. If the overlapping days
  disagree with what's stored, that symbol's full history is re-downloaded.
* Chunks are retried with exponential backoff; symbols missing from a chunk are retried
  one by one. Anything still failing keeps its last good data and is reported as stale.
"""

import logging
import time
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from datetime import time as dtime
from zoneinfo import ZoneInfo

import pandas as pd
import yfinance as yf

from investedge.universe import to_yahoo

log = logging.getLogger(__name__)

PRICE_COLUMNS = ["symbol", "date", "open", "high", "low", "close", "volume"]
OVERLAP_DAYS = 7  # calendar days re-fetched to detect adjustment changes
ADJUSTMENT_TOLERANCE = 0.002  # 0.2% relative close difference => history was re-adjusted
CHUNK_SIZE = 50
MARKET_TZ = ZoneInfo("America/New_York")
SESSION_FINAL = dtime(16, 30)  # after the 4pm close, with a buffer for final prints
MAX_RETRIES = 3

Downloader = Callable[[list[str], dict], pd.DataFrame]


@dataclass
class FetchResult:
    prices: pd.DataFrame
    full: list[str] = field(default_factory=list)  # full-history downloads
    incremental: list[str] = field(default_factory=list)
    readjusted: list[str] = field(default_factory=list)  # overlap mismatch -> full refetch
    unchanged: list[str] = field(default_factory=list)  # no new rows (e.g. market closed)
    failed: list[str] = field(default_factory=list)


def yf_download(yahoo_symbols: list[str], window: dict) -> pd.DataFrame:
    return yf.download(
        yahoo_symbols,
        interval="1d",
        auto_adjust=True,
        group_by="ticker",
        threads=True,
        progress=False,
        **window,
    )


def clean_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize a yfinance frame: lowercase columns, date column, drop empty/invalid rows."""
    df = df.rename(columns=str.lower).dropna(subset=["open", "high", "low", "close"])
    df = df[(df["close"] > 0) & (df["high"] >= df["low"])]
    df = df.reset_index().rename(columns={"Date": "date", "index": "date"})
    df["date"] = pd.to_datetime(df["date"]).dt.tz_localize(None).dt.normalize()
    df["volume"] = df["volume"].fillna(0).astype("int64")
    return df[["date", "open", "high", "low", "close", "volume"]]


def split_frame(raw: pd.DataFrame, symbols: list[str]) -> dict[str, pd.DataFrame]:
    """Split a (possibly multi-ticker) yfinance frame into clean per-symbol frames."""
    out: dict[str, pd.DataFrame] = {}
    if raw is None or raw.empty:
        return out
    for sym in symbols:
        ysym = to_yahoo(sym)
        if isinstance(raw.columns, pd.MultiIndex):
            if ysym not in raw.columns.get_level_values(0):
                continue
            sub = pd.DataFrame(raw[ysym])
        elif len(symbols) == 1:
            sub = raw
        else:
            continue
        df = clean_ohlcv(sub)
        if not df.empty:
            df.insert(0, "symbol", sym)
            out[sym] = df.loc[:, PRICE_COLUMNS]
    return out


def _download_with_retry(
    symbols: list[str], window: dict, downloader: Downloader, sleep: Callable[[float], None]
) -> dict[str, pd.DataFrame]:
    got: dict[str, pd.DataFrame] = {}
    pending = list(symbols)
    for attempt in range(MAX_RETRIES):
        if not pending:
            break
        try:
            got.update(split_frame(downloader([to_yahoo(s) for s in pending], window), pending))
        except Exception as exc:  # noqa: BLE001 - network/rate-limit errors vary
            log.warning(
                "Download attempt %d failed for %d symbols: %s", attempt + 1, len(pending), exc
            )
        pending = [s for s in pending if s not in got]
        if pending and attempt < MAX_RETRIES - 1:
            sleep(2**attempt)
    # Last resort: one at a time (a single bad symbol can poison a batch request).
    if len(pending) > 1:
        for sym in pending:
            try:
                got.update(split_frame(downloader([to_yahoo(sym)], window), [sym]))
            except Exception as exc:  # noqa: BLE001
                log.warning("Single download failed for %s: %s", sym, exc)
    return got


def chunks(items: list[str], size: int) -> Iterable[list[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def adjustment_changed(stored: pd.DataFrame, fresh: pd.DataFrame) -> bool:
    """True if overlapping closes differ by more than the tolerance (dividend/split re-adjust)."""
    merged = stored[["date", "close"]].merge(
        fresh[["date", "close"]], on="date", suffixes=("_old", "_new")
    )
    if merged.empty:
        return True  # no overlap to compare against: safest to refetch everything
    rel = (merged["close_new"] - merged["close_old"]).abs() / merged["close_old"]
    return bool((rel > ADJUSTMENT_TOLERANCE).any())


def last_complete_session(now: datetime | None = None) -> date:
    """Latest date whose daily bar is final. During market hours yfinance returns a partial
    bar for today; storing it would put an unfinished 'close' into every model."""
    now_et = (now or datetime.now(MARKET_TZ)).astimezone(MARKET_TZ)
    today = now_et.date()
    return today if now_et.time() >= SESSION_FINAL else today - timedelta(days=1)


def fetch_prices(
    symbols: list[str],
    years: int,
    last_dates: dict[str, date],
    stored_tail: Callable[[str, date], pd.DataFrame],
    downloader: Downloader = yf_download,
    sleep: Callable[[float], None] = time.sleep,
    now: datetime | None = None,
) -> FetchResult:
    """Fetch new prices for `symbols`.

    last_dates: last stored date per symbol (missing => new symbol).
    stored_tail(symbol, since): stored prices for `symbol` from `since` (for overlap checks).
    """
    result = FetchResult(prices=pd.DataFrame(columns=PRICE_COLUMNS))
    frames: list[pd.DataFrame] = []
    full_window = {"period": f"{years}y"}

    cutoff = pd.Timestamp(last_complete_session(now))

    def fetch(chunk: list[str], window: dict) -> dict[str, pd.DataFrame]:
        got = _download_with_retry(chunk, window, downloader, sleep)
        final = {s: df[df["date"] <= cutoff] for s, df in got.items()}
        return {s: df for s, df in final.items() if not df.empty}

    new = [s for s in symbols if s not in last_dates]
    known = [s for s in symbols if s in last_dates]

    # Incremental: group by start date so each request shares a window.
    starts: dict[date, list[str]] = {}
    for s in known:
        starts.setdefault(last_dates[s] - timedelta(days=OVERLAP_DAYS), []).append(s)

    for start, group in sorted(starts.items()):
        for chunk in chunks(group, CHUNK_SIZE):
            got = fetch(chunk, {"start": start.isoformat()})
            for sym in chunk:
                if sym not in got:
                    result.failed.append(sym)
                    continue
                fresh = got[sym]
                if adjustment_changed(stored_tail(sym, start), fresh):
                    new.append(sym)
                    result.readjusted.append(sym)
                    continue
                fresh = fresh[fresh["date"].dt.date > last_dates[sym]]
                if fresh.empty:
                    result.unchanged.append(sym)
                else:
                    frames.append(fresh)
                    result.incremental.append(sym)

    for chunk in chunks(new, CHUNK_SIZE):
        got = fetch(chunk, full_window)
        for sym in chunk:
            if sym in got:
                frames.append(got[sym])
                if sym not in result.readjusted:
                    result.full.append(sym)
            else:
                result.failed.append(sym)

    if result.failed:
        log.warning("Price fetch failed (keeping stale data) for: %s", ", ".join(result.failed))
    if frames:
        result.prices = pd.concat(frames, ignore_index=True)[PRICE_COLUMNS]
    return result
