"""Forecasting models. Each takes a close-price Series indexed by date and returns a
DataFrame with columns: date, mean, lo_80, hi_80, lo_95, hi_95.

Price models are fit on log prices so bands stay positive and are multiplicative,
which matches how stock prices behave.
"""

import logging
import warnings
from collections.abc import Callable

import numpy as np
import pandas as pd
from pandas.tseries.holiday import USFederalHolidayCalendar
from pandas.tseries.offsets import CustomBusinessDay

FORECAST_COLUMNS = ["date", "mean", "lo_80", "hi_80", "lo_95", "hi_95"]
Z = {80: 1.2815515655446004, 95: 1.959963984540054}

# Approximates the NYSE calendar (misses Good Friday; fine for a 30-day display horizon).
TRADING_DAY = CustomBusinessDay(calendar=USFederalHolidayCalendar())


def future_dates(last: pd.Timestamp, horizon: int) -> pd.DatetimeIndex:
    return pd.date_range(last + TRADING_DAY, periods=horizon, freq=TRADING_DAY)


def _frame(dates: pd.DatetimeIndex, mean, lo80, hi80, lo95, hi95) -> pd.DataFrame:
    return pd.DataFrame(
        {"date": dates, "mean": mean, "lo_80": lo80, "hi_80": hi80, "lo_95": lo95, "hi_95": hi95}
    )[FORECAST_COLUMNS]


def naive(close: pd.Series, horizon: int) -> pd.DataFrame:
    """Random walk ("tomorrow = today") with drift-free bands from historical log-return vol."""
    log_ret = np.log(close).diff().dropna()
    sigma = log_ret.std()
    steps = np.sqrt(np.arange(1, horizon + 1)) * sigma
    last = close.iloc[-1]
    return _frame(
        future_dates(close.index[-1], horizon),
        np.full(horizon, last),
        last * np.exp(-Z[80] * steps),
        last * np.exp(Z[80] * steps),
        last * np.exp(-Z[95] * steps),
        last * np.exp(Z[95] * steps),
    )


def _statsforecast(close: pd.Series, horizon: int, model) -> pd.DataFrame:
    from statsforecast import StatsForecast

    y = np.log(close.to_numpy())
    df = pd.DataFrame({"unique_id": "s", "ds": np.arange(len(y)), "y": y})
    sf = StatsForecast(models=[model], freq=1, n_jobs=1)
    fc = sf.forecast(df=df, h=horizon, level=[80, 95])
    name = repr(model)
    return _frame(
        future_dates(close.index[-1], horizon),
        np.exp(fc[name].to_numpy()),
        np.exp(fc[f"{name}-lo-80"].to_numpy()),
        np.exp(fc[f"{name}-hi-80"].to_numpy()),
        np.exp(fc[f"{name}-lo-95"].to_numpy()),
        np.exp(fc[f"{name}-hi-95"].to_numpy()),
    )


def arima(close: pd.Series, horizon: int) -> pd.DataFrame:
    from statsforecast.models import AutoARIMA

    return _statsforecast(close, horizon, AutoARIMA())


def ets(close: pd.Series, horizon: int) -> pd.DataFrame:
    from statsforecast.models import AutoETS

    return _statsforecast(close, horizon, AutoETS())


def prophet(close: pd.Series, horizon: int) -> pd.DataFrame:
    from prophet import Prophet

    logging.getLogger("cmdstanpy").setLevel(logging.WARNING)
    logging.getLogger("prophet").setLevel(logging.WARNING)
    df = pd.DataFrame({"ds": close.index, "y": np.log(close.to_numpy())})
    out = {}
    for level in (80, 95):
        m = Prophet(interval_width=level / 100, daily_seasonality=False, uncertainty_samples=300)
        m.fit(df)
        future = pd.DataFrame({"ds": future_dates(close.index[-1], horizon)})
        out[level] = m.predict(future)
    return _frame(
        future_dates(close.index[-1], horizon),
        np.exp(out[80]["yhat"].to_numpy()),
        np.exp(out[80]["yhat_lower"].to_numpy()),
        np.exp(out[80]["yhat_upper"].to_numpy()),
        np.exp(out[95]["yhat_lower"].to_numpy()),
        np.exp(out[95]["yhat_upper"].to_numpy()),
    )


def garch(close: pd.Series, horizon: int) -> pd.DataFrame:
    """GARCH(1,1) on daily % returns. Forecasts volatility, shown as an expected-range cone
    around the last price (the mean path is flat: GARCH says how much, not which way)."""
    from arch import arch_model

    returns = 100 * np.log(close).diff().dropna()
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        res = arch_model(returns, vol="garch", p=1, q=1, mean="constant", dist="normal").fit(
            disp="off"
        )
    daily_var = res.forecast(horizon=horizon, reindex=False).variance.to_numpy()[0] / 100**2
    cum_sd = np.sqrt(np.cumsum(daily_var))
    last = close.iloc[-1]
    return _frame(
        future_dates(close.index[-1], horizon),
        np.full(horizon, last),
        last * np.exp(-Z[80] * cum_sd),
        last * np.exp(Z[80] * cum_sd),
        last * np.exp(-Z[95] * cum_sd),
        last * np.exp(Z[95] * cum_sd),
    )


MODELS: dict[str, Callable[[pd.Series, int], pd.DataFrame]] = {
    "naive": naive,
    "arima": arima,
    "ets": ets,
    "prophet": prophet,
    "garch": garch,
}
