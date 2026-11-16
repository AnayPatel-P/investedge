import numpy as np
import pandas as pd
import pytest

from investedge import patterns


def candles(rows: list[tuple[float, float, float, float]], trend: str = "down") -> pd.DataFrame:
    """25 quiet lead-in days ending in a 5-day trend, then `rows` (o, h, l, c)."""
    lead = []
    price = 100.0
    for i in range(25):
        step = 0 if i < 19 else (-1.2 if trend == "down" else 1.2)
        o = price
        price = price + step + (0.1 if i % 2 else -0.1)
        lead.append((o, max(o, price) + 0.3, min(o, price) - 0.3, price))
    allrows = lead + rows
    return pd.DataFrame(
        {
            "date": pd.bdate_range("2026-01-01", periods=len(allrows)),
            "open": [r[0] for r in allrows],
            "high": [r[1] for r in allrows],
            "low": [r[2] for r in allrows],
            "close": [r[3] for r in allrows],
        }
    )


def last_pattern(df: pd.DataFrame) -> str | None:
    found = patterns.detect(df)
    hit = found[found["date"] == df["date"].iloc[-1]]
    return None if hit.empty else hit["pattern"].iloc[0]


def test_hammer_after_decline():
    # small body at the top, long lower wick
    assert last_pattern(candles([(92.6, 93.0, 89.0, 92.9)], "down")) == "hammer"


def test_shooting_star_after_rise():
    assert last_pattern(candles([(107.4, 111.4, 107.1, 107.2)], "up")) == "shooting_star"


def test_bullish_engulfing_after_decline():
    df = candles([(93.0, 93.2, 91.8, 92.0), (91.8, 93.8, 91.6, 93.6)], "down")
    assert last_pattern(df) == "bullish_engulfing"


def test_bearish_engulfing_after_rise():
    df = candles([(107.0, 108.2, 106.8, 108.0), (108.2, 108.4, 106.3, 106.5)], "up")
    assert last_pattern(df) == "bearish_engulfing"


def test_doji():
    assert last_pattern(candles([(93.0, 94.0, 92.0, 93.02)], "down")) == "doji"


def test_marubozu_split_by_direction():
    assert last_pattern(candles([(93.0, 96.05, 92.98, 96.0)], "down")) == "bullish_marubozu"
    assert last_pattern(candles([(107.0, 107.03, 104.0, 104.05)], "up")) == "bearish_marubozu"


def test_hammer_needs_a_prior_decline():
    assert last_pattern(candles([(107.6, 108.0, 104.0, 107.9)], "up")) != "hammer"


def test_hit_rates_use_only_complete_forward_windows():
    closes = [100, 101, 99, 102, 103, 104, 105, 106]
    df = pd.DataFrame({"date": pd.bdate_range("2026-01-01", periods=8), "close": closes})
    found = pd.DataFrame(
        {
            "date": [df["date"][0], df["date"][1], df["date"][6]],
            "pattern": ["hammer", "hammer", "hammer"],
        }
    )
    stats = patterns.hit_rates(df, found, forward=2)["hammer"]
    # day0: 99 > 100? no. day1: 102 > 101? yes. day6 has no 2-day window -> excluded.
    assert stats["count"] == 2
    assert stats["higher_after"] == pytest.approx(0.5)
    fwd = [closes[i + 2] > closes[i] for i in range(6)]
    assert stats["base_rate"] == pytest.approx(np.mean(fwd))


def test_verdict_wording():
    info = patterns.PATTERNS["hammer"]
    assert "too few" in patterns.verdict(info, {"count": 3, "higher_after": 1.0, "base_rate": 0.5})
    same = patterns.verdict(info, {"count": 40, "higher_after": 0.56, "base_rate": 0.55})
    assert "didn't help" in same
    opposite = patterns.verdict(info, {"count": 15, "higher_after": 0.27, "base_rate": 0.55})
    assert "opposite way" in opposite
