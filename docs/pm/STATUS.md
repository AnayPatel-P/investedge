# Status

**Updated:** 2026-11-17

**Where things stand:** v1 is live at https://anaypatel-p.github.io/investedge/. GitHub Actions refreshes
the data every weeknight at 22:30 UTC and redeploys. CI is green.

**Since launch:** added the S&P 500 comparison and the "Meet the models" guide, and compared the AI tutor
against local models (Claude won clearly; see the README).

**Next:** record the tutor demo video ([../DEMO.md](../DEMO.md)) and link it from the README and the site.
After that, maybe the side-by-side stock comparison.

**Housekeeping:** update the GitHub Actions versions (Node 20 deprecation warnings) and pick a license.

**Blockers:** none.

## Log

- **2026-11-15:** Settled the idea and scope, wrote the PRD and roadmap. Built Phase 1 (fc6a42f).
- **2026-11-16:** Phase 2, full data pipeline (f56445d).
- **2026-11-16:** Phase 3, scorecard, risk metrics and profiles (0133328).
- **2026-11-16:** Phase 4, the web app and Rewind & Release (66c47f2).
- **2026-11-16:** Phase 5, AI tutor. Tests caught a gap in the advice filter ("I'd recommend") before
  anything shipped. The first real eval call failed because the account had no credits, so the summary
  endpoint now returns a clean 503 instead of a 500, and the eval checks access before it starts. With
  credits added the eval scored 10/10 and 5/5 ($0.39), after I fixed false positives in the grader and
  re-scored the saved answers offline. Also fixed paragraphs running together and raw Markdown in the
  tutor UI (7874a5a).
- **2026-11-16:** Phase 6, candlestick patterns and glossary (eae57ab).
- **2026-11-16:** Phase 7, free hosting on GitHub Pages (01f6804). The first cloud run fetched all 503
  stocks, forecast 500 and backtested 499 (99.4% coverage). It took 66 min, 58 of them on the backtest.
- **2026-11-17:** Redesigned the UI as "The Recording Drum" (D56): drag-to-rewind chart with spring physics,
  outlook strip, calibration tag, system type and a new palette; dropped the web fonts.
- **2026-11-17:** S&P 500 comparison and "Meet the models" shipped. Ran the tutor eval against Qwen3 4B,
  Qwen3-Coder 30B and Mistral 7B through Ollama, and decided against a live chat on the free demo.
