"""Rolling-origin backtest and model scorecard.

For each origin, a model is fit on prices *up to and including* the origin date only, then
its next `horizon` predictions are compared with what actually happened. Errors are averaged
over all steps and origins. The naive random walk ("tomorrow = today") is the baseline every
model must beat to have shown real skill.
"""

from collections.abc import Callable
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

BASELINE = "naive"
Forecaster = Callable[[pd.Series, int], pd.DataFrame]


def origin_positions(
    n: int, horizon: int, origins: int, spacing: int, min_history: int
) -> list[int]:
    """Integer positions of origins, oldest first. The newest origin's window ends on the
    last observed day; earlier ones step back by `spacing`. Origins without enough history
    to fit are dropped."""
    last = n - 1 - horizon
    pos = [last - k * spacing for k in range(origins)]
    return sorted(p for p in pos if p + 1 >= min_history)


@dataclass
class SymbolBacktest:
    symbol: str
    rows: list[pd.DataFrame] = field(default_factory=list)
    errors: dict[str, str] = field(default_factory=dict)


def backtest_symbol(
    symbol: str,
    close: pd.Series,
    models: dict[str, Forecaster],
    horizon: int,
    origins: int,
    spacing: int,
    min_history: int,
) -> SymbolBacktest:
    """Run every model at every origin. Never raises (errors are recorded per model)."""
    out = SymbolBacktest(symbol)
    for pos in origin_positions(len(close), horizon, origins, spacing, min_history):
        train = close.iloc[: pos + 1]  # <- the only data the model may see
        actual = close.iloc[pos + 1 : pos + 1 + horizon]
        for name, fn in models.items():
            if name in out.errors:
                continue
            try:
                fc = fn(train, horizon)
            except Exception as exc:  # noqa: BLE001
                out.errors[name] = repr(exc)[:300]
                continue
            out.rows.append(
                pd.DataFrame(
                    {
                        "symbol": symbol,
                        "model": name,
                        "origin": train.index[-1],
                        "step": np.arange(1, len(actual) + 1),
                        "date": actual.index,  # real trading dates, not projected ones
                        "actual": actual.to_numpy(),
                        "mean": fc["mean"].to_numpy()[: len(actual)],
                        "lo_80": fc["lo_80"].to_numpy()[: len(actual)],
                        "hi_80": fc["hi_80"].to_numpy()[: len(actual)],
                        "lo_95": fc["lo_95"].to_numpy()[: len(actual)],
                        "hi_95": fc["hi_95"].to_numpy()[: len(actual)],
                    }
                )
            )
    return out


def score(backtest: pd.DataFrame) -> pd.DataFrame:
    """Per (symbol, model): MAE, MAPE, band coverage, skill vs. the naive baseline."""
    df = backtest.assign(
        abs_err=(backtest["mean"] - backtest["actual"]).abs(),
        in_80=(backtest["actual"] >= backtest["lo_80"]) & (backtest["actual"] <= backtest["hi_80"]),
        in_95=(backtest["actual"] >= backtest["lo_95"]) & (backtest["actual"] <= backtest["hi_95"]),
    )
    df["ape"] = df["abs_err"] / df["actual"]
    out = (
        df.groupby(["symbol", "model"])
        .agg(
            n_origins=("origin", "nunique"),
            mae=("abs_err", "mean"),
            mape=("ape", "mean"),
            coverage_80=("in_80", "mean"),
            coverage_95=("in_95", "mean"),
        )
        .reset_index()
    )
    base = out[out["model"] == BASELINE].set_index("symbol")["mae"]
    out["skill"] = 1 - out["mae"] / out["symbol"].map(base)
    # "Beats baseline" needs a meaningful margin (1%), not a rounding-error win.
    out["beats_baseline"] = (out["skill"] > 0.01) & (out["model"] != BASELINE)
    return out


MODEL_NAMES = {
    "naive": "Naive baseline",
    "arima": "ARIMA",
    "ets": "ETS",
    "prophet": "Prophet",
    "garch": "GARCH",
}


def verdict(symbol: str, card: pd.DataFrame) -> str:
    """One plain-English line summarising a symbol's scorecard for beginners."""
    price_models = card[~card["model"].isin([BASELINE, "garch"])]
    winners = price_models[price_models["beats_baseline"]].sort_values("skill", ascending=False)
    if card.empty or price_models.empty:
        return f"Not enough history to test forecasts for {symbol} yet."
    if winners.empty:
        return (
            f"No model beat the simple guess 'the price stays where it is' for {symbol} over the "
            "past year. That's normal: short-term stock moves are mostly unpredictable."
        )
    best = winners.iloc[0]
    return (
        f"{MODEL_NAMES.get(best['model'], best['model'])} was {best['skill']:.0%} more accurate "
        f"than 'the price stays where it is' for {symbol} over the past year. Still, its typical "
        f"miss was {best['mape']:.1%} of the price, so treat forecasts as rough ranges."
    )


def coverage_note(card: pd.DataFrame) -> str | None:
    """Flag models whose 95% band caught the real price far less often than 95%."""
    bad = card[card["coverage_95"] < 0.8]
    if bad.empty:
        return None
    names = ", ".join(MODEL_NAMES.get(m, m) for m in bad["model"])
    return (
        f"Overconfident: the 95% range of {names} contained the real price less than 80% of the "
        "time. Their ranges are too narrow to trust as-is."
    )
