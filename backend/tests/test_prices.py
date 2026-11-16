"""fetch_prices logic with a fake downloader (no network)."""

from datetime import date

import numpy as np
import pandas as pd

from investedge import prices
from investedge.pipeline import RunReport, forecast_symbol
from investedge.universe import to_yahoo

DATES = pd.bdate_range("2026-10-01", "2026-11-13")


def ohlc(dates: pd.DatetimeIndex, scale: float = 1.0) -> pd.DataFrame:
    close = scale * (100 + np.arange(len(dates), dtype=float))
    return pd.DataFrame(
        {"Open": close, "High": close + 1, "Low": close - 1, "Close": close, "Volume": 1000},
        index=pd.DatetimeIndex(dates, name="Date"),
    )


class FakeYahoo:
    """Serves per-symbol frames; `broken` symbols are never returned; `fail_batches` makes
    multi-symbol requests raise (simulating one bad ticker poisoning a batch)."""

    def __init__(self, data: dict[str, pd.DataFrame], broken=(), fail_batches=False):
        self.data, self.broken, self.fail_batches = data, set(broken), fail_batches
        self.calls: list[tuple[list[str], dict]] = []

    def __call__(self, ysyms: list[str], window: dict) -> pd.DataFrame:
        self.calls.append((ysyms, window))
        if self.fail_batches and len(ysyms) > 1:
            raise RuntimeError("rate limited")
        start = pd.Timestamp(window["start"]) if "start" in window else DATES[0]
        frames = {
            y: self.data[y][self.data[y].index >= start]
            for y in ysyms
            if y in self.data and y not in self.broken
        }
        if not frames:
            return pd.DataFrame()
        return pd.concat(frames, axis=1)


def stored_from(full: dict[str, pd.DataFrame], upto: str):
    def tail(sym: str, since: date) -> pd.DataFrame:
        df = full[to_yahoo(sym)]
        df = df[(df.index >= pd.Timestamp(since)) & (df.index <= pd.Timestamp(upto))]
        return pd.DataFrame({"date": df.index, "close": df["Close"].to_numpy()})

    return tail


def run(fake, symbols, last_dates, stored):
    sleeps: list[float] = []
    res = prices.fetch_prices(symbols, 5, last_dates, stored, fake, sleeps.append)
    return res, sleeps


def test_new_symbols_get_full_history() -> None:
    data = {"AAPL": ohlc(DATES), "BRK-B": ohlc(DATES)}
    res, _ = run(FakeYahoo(data), ["AAPL", "BRK.B"], {}, stored_from(data, "2000-01-01"))
    assert sorted(res.full) == ["AAPL", "BRK.B"]
    assert set(res.prices["symbol"]) == {"AAPL", "BRK.B"}
    assert len(res.prices) == 2 * len(DATES)


def test_incremental_returns_only_new_rows() -> None:
    data = {"AAPL": ohlc(DATES)}
    last = date(2026, 11, 10)
    fake = FakeYahoo(data)
    res, _ = run(fake, ["AAPL"], {"AAPL": last}, stored_from(data, "2026-11-10"))
    assert res.incremental == ["AAPL"]
    assert res.prices["date"].min().date() > last
    assert len(res.prices) == 3  # Nov 11, 12, 13
    assert "start" in fake.calls[0][1]  # did not re-download full history


def test_readjusted_history_triggers_full_refetch() -> None:
    stored = {"KO": ohlc(DATES, scale=1.0)}
    fresh = {"KO": ohlc(DATES, scale=0.98)}  # dividend re-adjusted every past price by 2%
    res, _ = run(
        FakeYahoo(fresh), ["KO"], {"KO": date(2026, 11, 10)}, stored_from(stored, "2026-11-10")
    )
    assert res.readjusted == ["KO"]
    assert res.full == []  # counted as re-adjusted, not as a new symbol
    assert len(res.prices) == len(DATES)


def test_unchanged_when_no_new_session() -> None:
    data = {"AAPL": ohlc(DATES)}
    res, _ = run(
        FakeYahoo(data), ["AAPL"], {"AAPL": date(2026, 11, 13)}, stored_from(data, "2026-11-13")
    )
    assert res.unchanged == ["AAPL"]
    assert res.prices.empty


def test_failed_symbol_retries_with_backoff_and_is_reported() -> None:
    data = {"AAPL": ohlc(DATES), "XYZ": ohlc(DATES)}
    res, sleeps = run(
        FakeYahoo(data, broken={"XYZ"}), ["AAPL", "XYZ"], {}, stored_from(data, "2000")
    )
    assert res.full == ["AAPL"]
    assert res.failed == ["XYZ"]
    assert sleeps == [1, 2]  # exponential backoff between the 3 attempts


def test_batch_errors_fall_back_to_single_symbol_downloads() -> None:
    data = {"AAPL": ohlc(DATES), "MSFT": ohlc(DATES)}
    res, _ = run(
        FakeYahoo(data, fail_batches=True), ["AAPL", "MSFT"], {}, stored_from(data, "2000")
    )
    assert sorted(res.full) == ["AAPL", "MSFT"]
    assert res.failed == []


def test_adjustment_changed_tolerance() -> None:
    old = pd.DataFrame({"date": DATES[:3], "close": [100.0, 101.0, 102.0]})
    assert not prices.adjustment_changed(old, old.assign(close=old["close"] * 1.001))
    assert prices.adjustment_changed(old, old.assign(close=old["close"] * 0.99))
    assert prices.adjustment_changed(old, old.iloc[0:0])  # no overlap => refetch


def test_forecast_symbol_skips_short_history() -> None:
    close = pd.Series(100.0, index=pd.bdate_range("2026-01-01", periods=100))
    out = forecast_symbol("NEW", close, ["naive"], 30)
    assert out.frames == {}
    assert "*" in out.errors


def test_forecast_symbol_records_model_errors() -> None:
    close = pd.Series(
        100 * np.exp(np.cumsum(np.random.default_rng(1).normal(0, 0.01, 400))),
        index=pd.bdate_range("2024-01-01", periods=400),
    )
    out = forecast_symbol("AAPL", close, ["naive", "does_not_exist"], 30)
    assert "naive" in out.frames
    assert "does_not_exist" in out.errors


def test_run_report_summary_mentions_key_numbers() -> None:
    r = RunReport(
        started="2026-11-16T02:00:00", symbols=503, prices_failed=["XYZ"], coverage_pct=99.4
    )
    text = r.summary()
    assert "503" in text and "failed 1" in text and "99.4%" in text


def test_partial_session_bar_is_dropped_during_market_hours() -> None:
    from datetime import datetime

    today = pd.Timestamp("2026-11-16")
    data = {"AAPL": ohlc(DATES.append(pd.DatetimeIndex([today])))}
    open_hours = datetime(2026, 11, 16, 10, 30, tzinfo=prices.MARKET_TZ)
    after_close = datetime(2026, 11, 16, 17, 0, tzinfo=prices.MARKET_TZ)
    stored = stored_from(data, "2026-11-13")

    during = prices.fetch_prices(
        ["AAPL"],
        5,
        {"AAPL": date(2026, 11, 13)},
        stored,
        FakeYahoo(data),
        lambda s: None,
        open_hours,
    )
    assert during.unchanged == ["AAPL"] and during.prices.empty

    after = prices.fetch_prices(
        ["AAPL"],
        5,
        {"AAPL": date(2026, 11, 13)},
        stored,
        FakeYahoo(data),
        lambda s: None,
        after_close,
    )
    assert after.incremental == ["AAPL"]
    assert after.prices["date"].max() == today
