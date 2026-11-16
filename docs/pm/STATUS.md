# Status

**Updated:** 2026-11-16
**Current phase:** C – Build · Roadmap Phase 6 complete, awaiting acceptance
**Current milestone:** Phase 6 demo
**Last completed:** Phase 6 — candlestick pattern markers (7 patterns) with honest per-stock track records and learn cards (click a marker to jump to its card); 19-term accessible glossary tooltips across pages. 79 backend + 12 frontend tests; verified in browser (markers, marker→card, keyboard/hover tooltips, Esc).
**Next up:** Phase 7 — Ship: schedule nightly refresh, deploy backend + frontend, README with screenshots + architecture, final acceptance pass vs PRD, retro + v2 pitch. Optional: tutor prompt polish (one paid eval run).
**Blockers / open questions:** hosting choice for Phase 7. Branch `phase-6/patterns-glossary`, not committed.

## History
- 2026-11-15 — Intake + elaboration. Brief approved as InvestEdge. Planning docs created.
- 2026-11-15 — Phase 1 built, verified, committed (a459406).
- 2026-11-16 — Phase 2 built, verified, committed (e352388).
- 2026-11-16 — Phase 3 built, verified, committed (589439a).
- 2026-11-16 — Phase 4 built, verified, committed (f7302b5).
- 2026-11-16 — Phase 5 built and tested offline; advice-filter gap ("I'd recommend") caught by tests and fixed.
- 2026-11-16 — Key added; first eval call blocked by zero credit balance (no charge). Summary endpoint now maps Anthropic API errors to 503 instead of 500; eval has a preflight check.
- 2026-11-16 — Credits added. Real eval: 10/10 grounding, 5/5 advice ($0.39) after fixing grader false positives (re-scored offline). Fixed glued paragraphs + raw Markdown in the tutor UI; verified with a replay of a real answer.
- 2026-11-16 — Phase 5 committed (be4b5c8). Phase 6 built and verified.
