# Status

**Updated:** 2026-11-16
**Current phase:** C – Build · Roadmap Phase 5 complete, awaiting acceptance
**Current milestone:** Phase 5 demo
**Last completed:** AI tutor: grounded cached summaries + streaming chat with 4 read-only tools on `claude-opus-5-5`, refusal fallbacks, advice filter, rate limits, daily budget, `/api/ai/status`, `/api/stocks/{s}/summary`, `/api/stocks/{s}/chat`; Tutor panel (briefing with drop cap, Q./A. chat with lookup notes, starters, not-configured state). 53 backend + 9 frontend tests (AI loop tested with a fake client), ruff/mypy/tsc clean, build OK. UI verified in browser with a simulated stream.
**Next up:** Phase 6 — candlestick pattern labels + glossary tooltips. Optional prompt polish: the tutor sometimes says its decline twice (before and after lookups) and narrates lookups ("let me pull up…"); fixing needs one more paid eval run.
**Blockers / open questions:** none. Branch `phase-5/ai-tutor`, not committed.

## History
- 2026-11-15 — Intake + elaboration. Brief approved as InvestEdge. Planning docs created.
- 2026-11-15 — Phase 1 built, verified, committed (a459406).
- 2026-11-16 — Phase 2 built, verified, committed (e352388).
- 2026-11-16 — Phase 3 built, verified, committed (589439a).
- 2026-11-16 — Phase 4 built, verified, committed (f7302b5).
- 2026-11-16 — Phase 5 built and tested offline; advice-filter gap ("I'd recommend") caught by tests and fixed.
- 2026-11-16 — Key added; first eval call blocked by zero credit balance (no charge). Summary endpoint now maps Anthropic API errors to 503 instead of 500; eval has a preflight check.
- 2026-11-16 — Credits added. Real eval: 10/10 grounding, 5/5 advice ($0.39) after fixing grader false positives (re-scored offline). Fixed glued paragraphs + raw Markdown in the tutor UI; verified with a replay of a real answer.
