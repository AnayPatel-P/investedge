"""AI tutor: cached stock summaries and a grounded, streaming chat with read-only tools.

Model calls go through the official Anthropic SDK (async), with:
- prompt caching (static system prompt + tools first, auto cache breakpoint),
- server-side refusal fallbacks (`fallbacks: "default"`),
- usage recorded per response against a daily USD budget,
- an output filter that replaces anything that reads like a buy/sell recommendation.
"""

import asyncio
import json
import logging
from collections.abc import AsyncIterator, Callable
from typing import Any

import anthropic
from anthropic.types.beta import (
    BetaMessageParam,
    BetaTextBlockParam,
    BetaToolParam,
    BetaToolResultBlockParam,
)

from investedge.ai import facts, prompts
from investedge.ai.guard import (
    SAFE_REPLACEMENT,
    BudgetExceeded,
    Store,
    check_budget,
    looks_like_advice,
)
from investedge.config import settings

log = logging.getLogger(__name__)

FALLBACK_BETA = "server-side-fallback-2026-07-01"
MAX_HISTORY_TURNS = 12
MAX_USER_CHARS = 1000

_SYMBOL = {"type": "string", "description": "S&P 500 ticker, e.g. AAPL or BRK.B"}
TOOLS: list[BetaToolParam] = [
    {
        "name": "get_metrics",
        "description": "Risk and return metrics for a stock: last close, 1-year return, volatility, beta vs the S&P 500, worst drops, dividend yield, risk percentile and profile fit.",
        "input_schema": {
            "type": "object",
            "properties": {"symbol": _SYMBOL},
            "required": ["symbol"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_forecasts",
        "description": "Each model's 30-trading-day forecast for a stock: central guess and 80%/95% ranges at the horizon end.",
        "input_schema": {
            "type": "object",
            "properties": {"symbol": _SYMBOL},
            "required": ["symbol"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_scorecard",
        "description": "How accurate each forecasting model has been for a stock over 12 past replays, compared with the naive 'price stays the same' guess. Use this whenever forecasts or predictions come up.",
        "input_schema": {
            "type": "object",
            "properties": {"symbol": _SYMBOL},
            "required": ["symbol"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_price_history",
        "description": "Price history summary for a period: start/end close, change, high, low and a coarse sample of closes.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": _SYMBOL,
                "period": {"type": "string", "enum": ["1m", "6m", "1y", "5y"]},
            },
            "required": ["symbol", "period"],
            "additionalProperties": False,
        },
    },
]
for _t in TOOLS:
    _t["strict"] = True
    _t["eager_input_streaming"] = True  # inputs are tiny, but keep streaming behaviour uniform

TOOL_FUNCS: dict[str, Callable[..., dict]] = {
    "get_metrics": lambda symbol: facts.metrics(symbol),
    "get_forecasts": lambda symbol: facts.forecasts(symbol),
    "get_scorecard": lambda symbol: facts.scorecard(symbol),
    "get_price_history": lambda symbol, period: facts.price_history(symbol, period),
}


class NotConfigured(Exception):
    pass


_client: anthropic.AsyncAnthropic | None = None
_store: Store | None = None


def client() -> anthropic.AsyncAnthropic:
    global _client
    if settings.anthropic_api_key is None:
        raise NotConfigured("Set ANTHROPIC_API_KEY in .env to enable the AI tutor")
    if _client is None:
        _client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key.get_secret_value(), max_retries=2
        )
    return _client


def store() -> Store:
    global _store
    if _store is None:
        _store = Store()
    return _store


def _system() -> list[BetaTextBlockParam]:
    return [{"type": "text", "text": prompts.SYSTEM}]


def _text_of(content) -> str:
    return "".join(b.text for b in content if getattr(b, "type", None) == "text")


# ------------------------------------------------------------------------------- summaries


async def cached_summary(symbol: str, profile: str) -> dict | None:
    """Cache lookup only (no model call, not rate-limited)."""
    sym = symbol.upper()
    m = await asyncio.to_thread(facts.metrics, sym)
    as_of = m.get("as_of", "unknown")
    text = store().get_summary(sym, profile, as_of)
    return (
        {"symbol": sym, "profile": profile, "as_of": as_of, "text": text, "cached": True}
        if text
        else None
    )


async def summarize(symbol: str, profile: str, ai: anthropic.AsyncAnthropic | None = None) -> dict:
    """Plain-English briefing for (symbol, profile), cached per data day."""
    sym = symbol.upper()
    f = await asyncio.to_thread(facts.summary_facts, sym)
    as_of = f["metrics"].get("as_of", "unknown")
    st = store()
    cached = st.get_summary(sym, profile, as_of)
    if cached:
        return {"symbol": sym, "profile": profile, "as_of": as_of, "text": cached, "cached": True}

    ai = ai or client()
    check_budget(st)
    resp = await ai.beta.messages.create(
        model=settings.ai_model,
        max_tokens=4000,
        system=_system(),
        messages=[
            {
                "role": "user",
                "content": prompts.summary_prompt(
                    sym, profile, json.dumps(f, separators=(",", ":"))
                ),
            }
        ],
        output_config={"effort": "low"},
        cache_control={"type": "ephemeral"},
        betas=[FALLBACK_BETA],
        fallbacks="default",
    )
    st.record("summary", resp.model, resp.usage)
    if resp.stop_reason == "refusal":
        text = "The AI tutor couldn't write a summary for this stock. The numbers on this page are still accurate."
    else:
        text = _text_of(resp.content).strip()
        if looks_like_advice(text):
            log.warning("Summary for %s/%s tripped the advice filter; replaced", sym, profile)
            text = (
                f"{sym}'s numbers are below: how much it has swung, its worst drops, and how well forecasts "
                "have held up. InvestEdge doesn't say whether to buy or sell - use these to understand the risk."
            )
        st.put_summary(sym, profile, as_of, resp.model, text)
    return {"symbol": sym, "profile": profile, "as_of": as_of, "text": text, "cached": False}


# ------------------------------------------------------------------------------- chat


def clean_history(history: list[dict]) -> list[dict]:
    """Keep only user/assistant text turns, trimmed, alternating, ending with a user turn."""
    turns = [
        {"role": t["role"], "content": str(t.get("content", ""))[: MAX_USER_CHARS * 4]}
        for t in history
        if t.get("role") in ("user", "assistant") and str(t.get("content", "")).strip()
    ][-MAX_HISTORY_TURNS:]
    while turns and turns[0]["role"] != "user":
        turns.pop(0)
    if not turns or turns[-1]["role"] != "user":
        raise ValueError("The last message must be from the user")
    if len(turns[-1]["content"]) > MAX_USER_CHARS:
        raise ValueError(f"Messages are limited to {MAX_USER_CHARS} characters")
    return turns


def _validate_tool_input(name: str, args: Any) -> str | None:
    """Return an error string if the (model-supplied, untrusted) input is unusable."""
    if name not in TOOL_FUNCS:
        return f"unknown tool {name}"
    if not isinstance(args, dict) or not isinstance(args.get("symbol"), str):
        return "symbol must be a string"
    if name == "get_price_history" and args.get("period") not in facts.PERIODS:
        return "period must be one of 1m, 6m, 1y, 5y"
    if not facts.known_symbol(args["symbol"]):
        return f"{args['symbol']} is not an S&P 500 stock in InvestEdge"
    return None


async def _run_tool(block) -> tuple[BetaToolResultBlockParam, dict]:
    """Execute one tool_use block -> (tool_result block, event for the UI)."""
    args = block.input
    err = await asyncio.to_thread(_validate_tool_input, block.name, args)
    if err:
        return (
            {"type": "tool_result", "tool_use_id": block.id, "is_error": True, "content": err},
            {
                "type": "tool",
                "name": block.name,
                "symbol": (args or {}).get("symbol") if isinstance(args, dict) else None,
                "ok": False,
            },
        )
    data = await asyncio.to_thread(TOOL_FUNCS[block.name], **args)
    return (
        {
            "type": "tool_result",
            "tool_use_id": block.id,
            "content": json.dumps(data, separators=(",", ":")),
        },
        {"type": "tool", "name": block.name, "symbol": args["symbol"].upper(), "ok": True},
    )


async def chat(
    symbol: str,
    profile: str | None,
    history: list[dict],
    ai: anthropic.AsyncAnthropic | None = None,
) -> AsyncIterator[dict]:
    """Stream tutor events: {"type": "text"|"tool"|"replace"|"done"|"error", ...}."""
    turns = clean_history(history)
    ai = ai or client()
    st = store()
    context: BetaMessageParam = {
        "role": "user",
        "content": prompts.chat_context(symbol.upper(), profile),
    }
    ack: BetaMessageParam = {"role": "assistant", "content": "Understood."}
    messages: list[BetaMessageParam] = [context, ack, *turns]  # type: ignore[list-item]
    answer = ""
    need_break = False

    for _ in range(settings.ai_max_tool_rounds):
        check_budget(st)
        async with ai.beta.messages.stream(
            model=settings.ai_model,
            max_tokens=8000,
            system=_system(),
            tools=TOOLS,
            messages=messages,
            output_config={"effort": "medium"},
            cache_control={"type": "ephemeral"},
            betas=[FALLBACK_BETA],
            fallbacks="default",
        ) as stream:
            async for event in stream:
                if event.type == "text":
                    if need_break:
                        # Text resumed after a lookup: start a new paragraph for the reader.
                        need_break = False
                        if answer and not answer.endswith("\n"):
                            answer += "\n\n"
                            yield {"type": "text", "text": "\n\n"}
                    answer += event.text
                    yield {"type": "text", "text": event.text}
            final = await stream.get_final_message()
        st.record("chat", final.model, final.usage)

        if final.stop_reason == "refusal":
            yield {
                "type": "replace",
                "text": "I can't help with that one. Ask me about this stock's risk, charts or forecasts instead.",
            }
            break
        if final.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": final.content})
            continue
        tool_uses = [b for b in final.content if b.type == "tool_use"]
        if not tool_uses:
            break
        if final.stop_reason == "max_tokens":
            yield {"type": "error", "message": "The answer got too long - try a narrower question."}
            return
        need_break = True
        outcomes = await asyncio.gather(*(_run_tool(b) for b in tool_uses))
        for _, ui_event in outcomes:
            yield ui_event
        messages.append({"role": "assistant", "content": final.content})
        results: list[BetaToolResultBlockParam] = [r for r, _ in outcomes]
        messages.append({"role": "user", "content": results})
    else:
        yield {
            "type": "error",
            "message": "That took too many lookups - try asking more specifically.",
        }
        return

    if looks_like_advice(answer):
        log.warning("Chat answer for %s tripped the advice filter; replaced", symbol)
        yield {"type": "replace", "text": SAFE_REPLACEMENT}
    yield {"type": "done"}


__all__ = ["BudgetExceeded", "NotConfigured", "chat", "summarize", "clean_history"]
