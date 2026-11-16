"""AI tutor tests with a fake Anthropic client (no network, no spend)."""

import asyncio
import json
from types import SimpleNamespace as NS

import pytest

from investedge.ai import guard, tutor
from investedge.config import settings

# ---------------------------------------------------------------- fakes


def usage(i=100, o=50):
    return NS(
        input_tokens=i, output_tokens=o, cache_creation_input_tokens=0, cache_read_input_tokens=0
    )


def msg(content, stop="end_turn"):
    return NS(content=content, stop_reason=stop, model="claude-opus-5-5", usage=usage())


def text(t):
    return NS(type="text", text=t)


def tool_use(name, **inp):
    return NS(type="tool_use", id=f"tu_{name}", name=name, input=inp)


class FakeStream:
    def __init__(self, final):
        self.final = final

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    def __aiter__(self):
        async def gen():
            for b in self.final.content:
                if b.type == "text":
                    yield NS(type="text", text=b.text)

        return gen()

    async def get_final_message(self):
        return self.final


class FakeAI:
    """Returns scripted responses in order and records the kwargs of every call."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []
        fake = self

        class Messages:
            def stream(self, **kw):
                fake.calls.append(kw)
                return FakeStream(fake.responses.pop(0))

            async def create(self, **kw):
                fake.calls.append(kw)
                return fake.responses.pop(0)

        self.beta = NS(messages=Messages())


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    monkeypatch.setattr(tutor, "_store", None)
    monkeypatch.setattr(tutor.facts, "known_symbol", lambda s: s.upper() in {"AAPL", "KO"})
    monkeypatch.setattr(
        tutor.facts,
        "scorecard",
        lambda s: {"symbol": s.upper(), "verdict": "No model beat the naive guess."},
    )
    monkeypatch.setattr(
        tutor.facts,
        "metrics",
        lambda s: {"symbol": s.upper(), "as_of": "2026-11-13", "volatility_1y": 0.25},
    )
    monkeypatch.setattr(
        tutor.facts,
        "summary_facts",
        lambda s: {"metrics": {"symbol": s.upper(), "as_of": "2026-11-13"}},
    )


def collect(gen):
    async def run():
        return [e async for e in gen]

    return asyncio.run(run())


USER = [{"role": "user", "content": "How reliable are the forecasts for AAPL?"}]


# ---------------------------------------------------------------- chat loop


def test_chat_runs_tools_and_grounds_answer():
    ai = FakeAI(
        [
            msg(
                [text("Let me check the scorecard."), tool_use("get_scorecard", symbol="aapl")],
                stop="tool_use",
            ),
            msg([text("No model beat the naive guess for AAPL.")]),
        ]
    )
    events = collect(tutor.chat("AAPL", "moderate", USER, ai=ai))
    kinds = [e["type"] for e in events]
    assert kinds == ["text", "tool", "text", "text", "done"]  # 2nd "text" = paragraph break
    assert events[2] == {"type": "text", "text": "\n\n"}
    assert events[1] == {"type": "tool", "name": "get_scorecard", "symbol": "AAPL", "ok": True}
    # Second request carries the assistant tool_use turn and the tool_result with real data.
    second = ai.calls[1]["messages"]
    result = second[-1]["content"][0]
    assert result["tool_use_id"] == "tu_get_scorecard"
    assert json.loads(result["content"])["verdict"].startswith("No model beat")
    # Guardrail settings on every call.
    for call in ai.calls:
        assert call["model"] == settings.ai_model
        assert call["fallbacks"] == "default"
        assert call["cache_control"] == {"type": "ephemeral"}
        assert call["system"][0]["text"] == tutor.prompts.SYSTEM
        assert all(t["strict"] for t in call["tools"])
    # Usage recorded for both calls.
    assert tutor.store().spent_today() > 0


def test_unknown_symbol_returns_tool_error():
    ai = FakeAI(
        [
            msg([tool_use("get_metrics", symbol="ZZZZ")], stop="tool_use"),
            msg([text("InvestEdge doesn't cover ZZZZ.")]),
        ]
    )
    events = collect(tutor.chat("AAPL", None, USER, ai=ai))
    assert {"type": "tool", "name": "get_metrics", "symbol": "ZZZZ", "ok": False} in events
    result = ai.calls[1]["messages"][-1]["content"][0]
    assert result["is_error"] is True


def test_advice_is_replaced():
    ai = FakeAI([msg([text("Honestly, you should buy AAPL now.")])])
    events = collect(tutor.chat("AAPL", None, USER, ai=ai))
    assert {"type": "replace", "text": guard.SAFE_REPLACEMENT} in events
    assert events[-1] == {"type": "done"}


def test_refusal_is_handled():
    ai = FakeAI([msg([], stop="refusal")])
    events = collect(tutor.chat("AAPL", None, USER, ai=ai))
    assert events[0]["type"] == "replace"


def test_budget_stops_calls(monkeypatch):
    monkeypatch.setattr(settings, "ai_daily_budget_usd", 0.0)
    ai = FakeAI([msg([text("hi")])])
    with pytest.raises(guard.BudgetExceeded):
        collect(tutor.chat("AAPL", None, USER, ai=ai))
    assert ai.calls == []


def test_clean_history_rules():
    ok = tutor.clean_history(
        [{"role": "assistant", "content": "x"}, {"role": "user", "content": "hi"}]
    )
    assert ok == [{"role": "user", "content": "hi"}]
    with pytest.raises(ValueError):
        tutor.clean_history(
            [{"role": "user", "content": "a"}, {"role": "assistant", "content": "b"}]
        )
    with pytest.raises(ValueError):
        tutor.clean_history([{"role": "user", "content": "x" * 2000}])


# ---------------------------------------------------------------- summaries


def test_summary_is_cached_per_day():
    ai = FakeAI([msg([text("AAPL swings about 25% a year.")])])
    first = asyncio.run(tutor.summarize("AAPL", "moderate", ai=ai))
    second = asyncio.run(tutor.summarize("AAPL", "moderate", ai=ai))
    assert first["text"] == second["text"] == "AAPL swings about 25% a year."
    assert first["cached"] is False and second["cached"] is True
    assert len(ai.calls) == 1
    assert ai.calls[0]["output_config"] == {"effort": "low"}


def test_summary_advice_is_replaced():
    ai = FakeAI([msg([text("It's a great buy for conservative investors.")])])
    out = asyncio.run(tutor.summarize("KO", "conservative", ai=ai))
    assert "buy" not in out["text"].lower() or "doesn't say whether to buy" in out["text"]


# ---------------------------------------------------------------- guards


@pytest.mark.parametrize(
    "s",
    [
        "You should buy NVDA.",
        "I'd recommend selling it.",
        "This is a great investment.",
        "Price target of $500",
        "Strong buy.",
    ],
)
def test_advice_filter_catches(s):
    assert guard.looks_like_advice(s)


@pytest.mark.parametrize(
    "s",
    [
        "I can't tell you whether to buy or sell.",
        "Beta measures how much it moves with the market.",
        "Some investors ask whether a stock is worth buying; here is what to consider.",
    ],
)
def test_advice_filter_allows_education(s):
    assert not guard.looks_like_advice(s)


def test_rate_limiter_window():
    rl = guard.RateLimiter()
    assert all(rl.allow("ip", "chat", 2, now=t) for t in (0, 1))
    assert not rl.allow("ip", "chat", 2, now=2)
    assert rl.allow("ip", "chat", 2, now=3601)


def test_cost_accounting():
    st = guard.Store()
    cost = st.record(
        "chat",
        "m",
        NS(
            input_tokens=1_000_000,
            output_tokens=100_000,
            cache_creation_input_tokens=0,
            cache_read_input_tokens=1_000_000,
        ),
    )
    assert cost == pytest.approx(4.0 + 2.0 + 0.2)


def test_text_after_a_lookup_starts_a_new_paragraph():
    ai = FakeAI(
        [
            msg(
                [text("Let me pull up NVDA."), tool_use("get_metrics", symbol="AAPL")],
                stop="tool_use",
            ),
            msg([text("I can't give you a yes or no.")]),
        ]
    )
    events = collect(tutor.chat("AAPL", None, USER, ai=ai))
    streamed = "".join(e["text"] for e in events if e["type"] == "text")
    assert streamed == "Let me pull up NVDA.\n\nI can't give you a yes or no."
