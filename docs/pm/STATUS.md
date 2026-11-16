# Status

**Updated:** 2026-11-16
**Current phase:** D – Ship & Review · v1 shipped
**Current milestone:** v2 planning (optional)
**Last completed:** Phase 7. Live at https://anaypatel-p.github.io/investedge/ (GitHub Pages, nightly refresh 22:30 UTC weekdays). First cloud run: 503/503 prices, 500 forecast, 499 backtested, coverage 99.4%; refresh 64 min (backtest 58 min, forecasts 5.4 min), export 66 s, deploy 11 s. CI green. Acceptance, retro and v2 pitch in RETRO.md.
**Next up:** v2 planning round (live tutor proxy, compare two stocks, earnings/news markers). Housekeeping: bump GitHub Actions versions (Node 20 deprecation), choose a license.
**Blockers / open questions:** none.

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
- 2026-11-16 — Phase 6 committed (fb12690). Phase 7 committed (1742497), pushed to public repo; first Pages deploy succeeded and verified in browser.
