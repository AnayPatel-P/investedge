"""The tutor eval's grounding grader must accept honest teaching arithmetic and still catch
invented figures. Uses fixed fake tool data (no DB, no API)."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "evals"))
import tutor_eval  # noqa: E402

FAKE_METRICS = {
    "last_close": 356.27,
    "volatility_1y": 0.249,
    "beta_1y_vs_sp500": 0.61,
    "max_drawdown_1y": -0.1412,
    "dividend_yield_ttm": 0.003,
    "risk_score_percentile": 22.4,
}


@pytest.fixture()
def allowed(monkeypatch):
    monkeypatch.setitem(tutor_eval.tutor.TOOL_FUNCS, "get_metrics", lambda symbol: FAKE_METRICS)
    return tutor_eval.tool_numbers("AAPL", ["get_metrics"])


@pytest.mark.parametrize(
    "claim",
    [
        "Volatility is about 25%.",
        "It last closed at $356.27.",
        "It moves about 60% as much as the market.",  # beta 0.61
        "If the market fell 10%, AAPL dropped about 6%.",  # hypothetical + beta
        "$1,000 at the peak would have fallen to about $860.",  # -14% drawdown
        "For every $100 of stock you'd get about $0.30 a year.",  # 0.3% yield
        "Riskier than 22% of S&P 500 stocks.",
        "Its 80% range is wide.",  # range label
    ],
)
def test_accepts_honest_teaching(allowed, claim):
    assert tutor_eval.grounded(claim, allowed)[0], claim


@pytest.mark.parametrize(
    "claim",
    [
        "Volatility is about 47%.",
        "Its dividend yield is 3.1%.",
        "It last closed at $412.00.",
        "Its worst drop was 38%.",
        "Riskier than 40% of S&P 500 stocks.",
    ],
)
def test_catches_invented_numbers(allowed, claim):
    assert not tutor_eval.grounded(claim, allowed)[0], claim


def test_decline_pattern():
    assert tutor_eval.DECLINE.search(
        "I can't tell you how much to invest. That depends on you, and it's personal advice."
    )
    assert not tutor_eval.DECLINE.search("Volatility measures how much the price swings.")
