"""Classic candlestick patterns, plus an honest check of whether they meant anything.

Detection uses textbook rules on daily OHLC with a short trend context. For every pattern we
also measure, on this stock's own history, how often the close was higher N days later after
the pattern, versus on any ordinary day (the base rate). That comparison is the lesson: most
patterns barely move the odds.
"""

from dataclasses import dataclass

import numpy as np
import pandas as pd

TREND_DAYS = 5  # context window for "after a decline/rise"
FORWARD_DAYS = 5  # horizon for the hit-rate check


@dataclass(frozen=True)
class PatternInfo:
    key: str
    name: str
    bias: str  # "bullish" | "bearish" | "neutral": what traders *expect*, not what happens
    shape: str


PATTERNS: dict[str, PatternInfo] = {
    p.key: p
    for p in [
        PatternInfo(
            "doji",
            "Doji",
            "neutral",
            "Open and close almost equal: a tug-of-war that ended in a tie.",
        ),
        PatternInfo(
            "hammer",
            "Hammer",
            "bullish",
            "Small body near the top, long lower wick, after a decline: sellers pushed down, buyers pushed back.",
        ),
        PatternInfo(
            "shooting_star",
            "Shooting star",
            "bearish",
            "Small body near the bottom, long upper wick, after a rise: buyers pushed up, sellers pushed back.",
        ),
        PatternInfo(
            "bullish_engulfing",
            "Bullish engulfing",
            "bullish",
            "An up day whose body fully covers the previous down day's body, after a decline.",
        ),
        PatternInfo(
            "bearish_engulfing",
            "Bearish engulfing",
            "bearish",
            "A down day whose body fully covers the previous up day's body, after a rise.",
        ),
        PatternInfo(
            "bullish_marubozu",
            "Bullish marubozu",
            "bullish",
            "A long up candle with almost no wicks: buyers were in control from open to close.",
        ),
        PatternInfo(
            "bearish_marubozu",
            "Bearish marubozu",
            "bearish",
            "A long down candle with almost no wicks: sellers were in control from open to close.",
        ),
    ]
}


def detect(ohlc: pd.DataFrame) -> pd.DataFrame:
    """ohlc: columns date, open, high, low, close (sorted). Returns date, pattern, direction.

    At most one pattern per day; engulfing (two-candle) patterns win over single-candle ones.
    """
    df = ohlc.reset_index(drop=True)
    o, h, lo, c = (df[k].to_numpy(float) for k in ("open", "high", "low", "close"))
    body = np.abs(c - o)
    rng = np.maximum(h - lo, 1e-9)
    upper = h - np.maximum(o, c)
    lower = np.minimum(o, c) - lo
    avg_body = pd.Series(body).rolling(20, min_periods=5).mean().to_numpy()
    # Trend = close vs close TREND_DAYS ago (computed before today, so no peeking).
    prior = pd.Series(c).shift(1)
    trend = (prior / pd.Series(c).shift(1 + TREND_DAYS) - 1).to_numpy()
    down_before = trend < -0.02
    up_before = trend > 0.02
    up = c > o
    down = c < o

    po, pc = np.roll(o, 1), np.roll(c, 1)
    prev_up, prev_down = pc > po, pc < po
    first = np.arange(len(df)) == 0

    labels: list[str | None] = [None] * len(df)
    for i in range(len(df)):
        if first[i] or np.isnan(avg_body[i]):
            continue
        small = body[i] <= 0.35 * rng[i]
        if (
            up[i]
            and prev_down[i]
            and o[i] <= pc[i]
            and c[i] >= po[i]
            and body[i] > body[i - 1]
            and down_before[i]
        ):
            labels[i] = "bullish_engulfing"
        elif (
            down[i]
            and prev_up[i]
            and o[i] >= pc[i]
            and c[i] <= po[i]
            and body[i] > body[i - 1]
            and up_before[i]
        ):
            labels[i] = "bearish_engulfing"
        elif small and lower[i] >= 2 * body[i] and upper[i] <= 0.15 * rng[i] and down_before[i]:
            labels[i] = "hammer"
        elif small and upper[i] >= 2 * body[i] and lower[i] <= 0.15 * rng[i] and up_before[i]:
            labels[i] = "shooting_star"
        elif body[i] <= 0.05 * rng[i] and rng[i] > 0.5 * avg_body[i]:
            labels[i] = "doji"
        elif body[i] >= 0.92 * rng[i] and body[i] >= 1.6 * avg_body[i]:
            labels[i] = "bullish_marubozu" if up[i] else "bearish_marubozu"

    out = pd.DataFrame({"date": df["date"], "pattern": labels}).dropna(subset=["pattern"])
    out["direction"] = [PATTERNS[p].bias for p in out["pattern"]]
    return out.reset_index(drop=True)


def hit_rates(
    ohlc: pd.DataFrame, found: pd.DataFrame, forward: int = FORWARD_DAYS
) -> dict[str, dict]:
    """For each pattern: occurrences, share of times the close was higher `forward` days later,
    and the same share for every day (base rate). Only occurrences with a full forward window
    count, so recent patterns don't bias the result."""
    closes = ohlc.reset_index(drop=True)["close"].to_numpy(float)
    dates = pd.to_datetime(ohlc.reset_index(drop=True)["date"])
    fwd_up = np.full(len(closes), np.nan)
    fwd_up[:-forward] = (closes[forward:] > closes[:-forward]).astype(float)
    base = float(np.nanmean(fwd_up)) if np.isfinite(fwd_up).any() else float("nan")
    pos = {d: i for i, d in enumerate(dates)}
    stats: dict[str, dict] = {}
    for key in PATTERNS:
        idx = [
            pos[d] for d in pd.to_datetime(found.loc[found["pattern"] == key, "date"]) if d in pos
        ]
        vals = fwd_up[idx] if idx else np.array([])
        vals = vals[np.isfinite(vals)]
        stats[key] = {
            "count": int(len(vals)),
            "higher_after": float(vals.mean()) if len(vals) else None,
            "base_rate": base,
        }
    return stats


def verdict(info: PatternInfo, s: dict) -> str:
    """Plain-English reading of a pattern's track record on this stock."""
    n, hit, base = s["count"], s["higher_after"], s["base_rate"]
    if n < 8 or hit is None:
        return f"Only {n} complete examples here — too few to say whether it means anything for this stock."
    diff = hit - base
    rel = f"{hit:.0%} of the time, versus {base:.0%} on an ordinary day"
    if abs(diff) < 0.05:
        return f"After a {info.name.lower()}, the price was higher {FORWARD_DAYS} days later {rel}. That's about the same — the pattern didn't help predict anything here."
    if info.bias == "neutral":
        lean = "upward" if diff > 0 else "downward"
    else:
        better = (diff > 0) == (info.bias == "bullish")
        lean = (
            "in the direction traders expect"
            if better
            else "the opposite way to what traders expect"
        )
    return f"After a {info.name.lower()}, the price was higher {FORWARD_DAYS} days later {rel} — a lean {lean}, from just {n} examples, so it could easily be luck."
