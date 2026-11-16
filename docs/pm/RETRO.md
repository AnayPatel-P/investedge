# InvestEdge v1 — Acceptance, retro, and v2 pitch

_2026-11-16 · after Phase 7_

## 1. Acceptance pass against the PRD

Legend: ✅ met and verified · ⚠️ met with a caveat · ❌ not met

### Features (PRD §6)

| # | Requirement | Result | Evidence |
|---|---|---|---|
| F1 | ~503 constituents with sector | ✅ | 503 loaded (D15) |
| F1 | ≥5y OHLCV for ≥98% of tickers; failures retried | ✅ | 503/503 fetched, 0 failed; retries + stale cache (D20) |
| F1 | One-command refresh; incremental | ✅ | `make refresh`; re-run fetched 0 rows, 503 unchanged |
| F2 | Candles ↔ line, 1M–5Y, volume, hover OHLC, key metrics | ✅ | Verified in browser |
| F2 | Stock page < 2s from cache | ⚠️ | API responses 11–26 ms; static page payload ~62 KB gzipped. No formal Lighthouse run |
| F3 | ARIMA/ETS/Prophet 30-day forecasts with 80/95% bands; GARCH cone; toggles; explainers | ✅ | 500/503 stocks (3 too new, labelled) |
| F4 | 12-month rolling backtest vs naive; MAE/MAPE/coverage; verdict | ✅ | 499 stocks; leakage test; plain-English verdicts |
| F5 | Profile picker + quiz (persisted); screener; forecast view; tone; example portfolios | ✅ | Verified in browser; portfolios labelled "example, not a recommendation" |
| F6 | ≤150-word cached AI summary, no buy/sell language | ✅ | Prompt caps at 130 words; cached per stock/profile/day; filter tested |
| F7 | Grounded streaming chat with tools; declines advice; rate limit + cost cap; key server-side | ✅ | Eval: grounding 10/10, advice 5/5 ($0.39) |
| F8 | Disclaimers: footer, tutor, portfolios | ✅ | All three present |
| F9 | Type-ahead search; sector browse; sortable screener | ✅ | Also works in-browser on the static site |
| F10 | Time Machine | ✅ | Shipped early as "Rewind & Release" (D35) |
| F11/12 | ≥5 candlestick patterns + learn cards; glossary tooltips | ✅ | 7 patterns with honest per-stock track records; 19 accessible terms |

### Success metrics (PRD §10)

| Metric | Target | Result |
|---|---|---|
| Ticker coverage | ≥ 98% with data + forecasts | ✅ 99.4% (100% have prices) |
| Page speed | < 2s | ⚠️ Fast in practice; not formally measured |
| Forecast honesty | Scorecard on 100% of forecast stocks, baseline always shown | ✅ |
| Chat grounding | 10/10 grounded, 5/5 advice declined | ✅ 10/10, 5/5 |
| Portfolio quality | Public URL + README | ✅ https://anaypatel-p.github.io/investedge/ |

### Non-functional (PRD §8)

| Requirement | Result |
|---|---|
| Nightly job < 60 min | ⚠️ Locally ~1 min (~8 with backtest). On GitHub's runners: est. ~8 min on normal nights, but the weekly backtest took 58 min (66 min total job) on the first run. Within the 150-min timeout, over the 60-min target on backtest days |
| Responsive to phone width | ✅ Checked at 375 / 800 / 1440 px |
| Keyboard navigable; color never the only signal | ✅ Dial, scrubber, terms, search are keyboard-operable; ▲/▼ glyphs, hollow/filled candles |
| WCAG AA contrast | ⚠️ Designed to AA ratios; no automated axe/Lighthouse audit yet |
| Key never reaches the browser | ✅ |
| Cost < $10/month | ✅ $0 hosting (GitHub Pages + Actions); $0.42 total AI spend so far |

### Known gaps, honestly

- **AI tutor is off on the public demo** — deliberate (D: free hosting can't hold a key safely). Works in the full version.
- No ESLint, no automated accessibility or Lighthouse audit.
- Fraunces "full" font files are heavy (~120–150 KB each).
- Model end-labels crowd together on narrow phones.
- Trading calendar approximates NYSE holidays (misses Good Friday) — D19.
- Tutor sometimes declines twice (before and after lookups) — prompt polish, needs one paid eval run.
- The eval grader can't tell an invented *round* percentage from a hypothetical ("market moves 1%") — D47.
- First cloud run fetched 503/503 from Yahoo with 0 failures; nightly runs still need watching for rate limits.
- The weekly backtest is ~7× slower on GitHub's runners (58 min vs ~8 locally); Prophet dominates CPU time.
- Deep links (e.g. `/investedge/stock/AAPL`) render correctly but return HTTP 404 via the Pages SPA fallback, so search engines won't index stock pages.

## 2. Retro

**What went well**
- **Honesty as the product, validated by data.** The scorecard found ARIMA beat the naive guess on only 8.8% of stocks and Prophet's 95% ranges caught reality 58% of the time. That became the signature moment instead of an embarrassment.
- **Retiring the riskiest assumption first.** The Phase 1 speed spike showed all models × 503 stocks fit in ~7 minutes, so nothing later had to be redesigned for performance.
- **Reading transcripts and outputs, not just scores.** The first eval scored 2/10; reading the answers showed the grader was wrong, and also exposed two real UI bugs a fake client never would have.
- **Gates between phases** caught scope changes cleanly (Time Machine pulled forward, Stooq dropped, free hosting).

**What was harder than expected**
- Data sharp edges: yfinance's in-progress daily bar during market hours (D24), dividend re-adjustments, Stooq's bot wall (D20).
- A subtle statistics bug: averaging percentiles made "riskier than X%" untrue (D29).
- Tooling around the code: a branch switched by another tool mid-commit, a GitHub token missing the `workflow` scope, an Anthropic account with no credits.

**What I'd do differently**
- Add ESLint and an automated accessibility/Lighthouse check in Phase 4, not "later".
- Run a tiny real-model eval as soon as the AI layer exists, instead of relying on fakes for a whole phase.
- Use a separate git worktree for agent work so other tools can't move the branch underneath it.
- Seed CI with a data snapshot so the very first cloud build doesn't depend on a cold, rate-limited fetch.

## 3. v2 pitch

Future add-ons (PRD §13), re-ranked with what v1 taught:

| Rank | Idea | Why now | Size |
|---|---|---|---|
| 1 | **Live AI tutor on the public site** behind a tiny protected proxy (bot check + per-visitor and per-day caps) | The tutor is v1's best feature and the demo can't show it | S–M |
| 2 | **Compare two stocks side by side** (risk, scorecard, Rewind on both) | The most common beginner question; reuses everything built | S |
| 3 | **Earnings & news markers with an AI "why did it move?"** | Explains the jumps that no model predicted — the natural next lesson after the scorecard | M |
| 4 | Paper portfolio simulator | Learn by doing, with the scorecard's humility built in | M |
| 5 | Learning path with short quizzes | Turns the glossary and patterns into a guided course | M |
| 6 | LSTM / transformer models in the scorecard | Good portfolio signal; expect it *not* to beat the baseline — itself a lesson | L |

**Proposed v2 = ranks 1–3** (roughly one S–M phase each). Next step: a short Phase A round for just these three.
