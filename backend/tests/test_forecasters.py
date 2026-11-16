import numpy as np
import pandas as pd
import pytest

from investedge.models.forecasters import FORECAST_COLUMNS, MODELS, future_dates
from investedge.prices import clean_ohlcv
from investedge.universe import to_yahoo


@pytest.fixture(scope="module")
def close() -> pd.Series:
    rng = np.random.default_rng(0)
    idx = pd.bdate_range("2022-01-03", periods=600)
    return pd.Series(100 * np.exp(np.cumsum(rng.normal(0.0003, 0.015, len(idx)))), index=idx)


@pytest.mark.parametrize("name", ["naive", "arima", "ets", "garch"])
def test_forecast_shape_and_band_order(close: pd.Series, name: str) -> None:
    fc = MODELS[name](close, 30)
    assert list(fc.columns) == FORECAST_COLUMNS
    assert len(fc) == 30
    assert fc["date"].min() > close.index[-1]
    assert (fc["lo_95"] <= fc["lo_80"]).all()
    assert (fc["lo_80"] <= fc["mean"]).all()
    assert (fc["mean"] <= fc["hi_80"]).all()
    assert (fc["hi_80"] <= fc["hi_95"]).all()
    assert (fc["lo_95"] > 0).all()


def test_naive_bands_widen_over_time(close: pd.Series) -> None:
    fc = MODELS["naive"](close, 30)
    width = fc["hi_95"] - fc["lo_95"]
    assert width.is_monotonic_increasing


def test_future_dates_skip_weekends_and_holidays() -> None:
    dates = future_dates(pd.Timestamp("2026-12-23"), 3)  # Wed before Christmas
    assert [d.strftime("%Y-%m-%d") for d in dates] == ["2026-12-24", "2026-12-28", "2026-12-29"]


def test_clean_ohlcv_drops_bad_rows() -> None:
    raw = pd.DataFrame(
        {
            "Open": [10, np.nan, 10, 10],
            "High": [11, 11, 9, 11],
            "Low": [9, 9, 10, 9],
            "Close": [10.5, 10, 10, 0],
            "Volume": [100, 100, 100, np.nan],
        },
        index=pd.DatetimeIndex(pd.bdate_range("2024-01-02", periods=4), name="Date"),
    )
    out = clean_ohlcv(raw)
    assert len(out) == 1  # NaN open, high<low, and zero close are dropped
    assert list(out.columns) == ["date", "open", "high", "low", "close", "volume"]


def test_to_yahoo_share_class() -> None:
    assert to_yahoo("BRK.B") == "BRK-B"
    assert to_yahoo("AAPL") == "AAPL"
