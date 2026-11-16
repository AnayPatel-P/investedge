# InvestEdge — Roadmap

**Stack:** Python 3.12 · FastAPI · pandas/statsmodels/statsforecast/prophet/arch · DuckDB + Parquet · Claude API · frontend chosen with `original-ui` in Phase 4   (reasons in DECISIONS.md)
**Riskiest assumption:** all model families can be fitted for ~503 tickers nightly in < 60 min → **tested in Phase 1 spike**

Timeline target: a few weeks, solo. Phases 1–5 are v1-critical; Phase 6 can slip; Phase 7 ships.

---

## Phase 1 — Walking skeleton + model speed spike
**Goal:** thinnest end-to-end slice: 20 tickers → stored → one forecast → API → a chart in the browser. Prove model runtime is viable.
**Demo:** open a local page, pick one of 20 tickers, see a candlestick chart with an ARIMA forecast band.
- [x] 1.1 Repo scaffold: `backend/` (uv/poetry project), `frontend/` placeholder, `.gitignore`, `.env.example`, Makefile, README stub
- [x] 1.2 Load S&P 500 constituent list (decide source) → `tickers` table
- [x] 1.3 Fetch 5Y daily OHLCV for 20 sample tickers via yfinance → Parquet/DuckDB
- [x] 1.4 Fit auto-ARIMA for one ticker; store forecast + 80/95% bands
- [x] 1.5 FastAPI: `GET /stocks/{ticker}/prices`, `GET /stocks/{ticker}/forecasts`
- [x] 1.6 Throwaway HTML page with a candlestick chart + forecast band (to be replaced in Phase 4)
- [x] 1.7 **Spike:** time ARIMA, ETS, Prophet, GARCH fits on 20 tickers; extrapolate to 503; write findings to DECISIONS.md
**Done when:**
- [x] `make dev` starts the API and the page shows a real chart + forecast
- [x] Spike numbers recorded and a go/adjust decision logged

## Phase 2 — Full data pipeline + forecasting engine
**Goal:** all ~503 tickers, all model families, one-command nightly refresh.
**Demo:** run `make refresh`, see a report: N tickers updated, M models fitted, failures, runtime.
- [x] 2.1 Full-universe fetch with incremental updates, retries/backoff, stale-cache fallback (Stooq dropped — D20)
- [x] 2.2 Model runners: ARIMA/SARIMA, ETS, Prophet (30-day horizon, 80/95% bands); naive baseline
- [x] 2.3 GARCH(1,1) volatility forecast → expected-range cone
- [x] 2.4 Parallelized batch (multiprocessing) + refit strategy chosen from spike
- [x] 2.5 Pipeline run report (coverage, failures, timings) saved per run
- [x] 2.6 Unit tests: data cleaning, forecast output shape, band ordering
**Done when:**
- [x] ≥98% tickers have data + all forecasts; full run < 60 min locally
- [x] Tests pass

## Phase 3 — Scorecard, risk metrics & risk-profile logic
**Goal:** the "honesty" and "personalization" brains, exposed via API.
**Demo:** API returns a scorecard for AAPL (with beats-baseline verdict), a ranked screener for "conservative", and three example portfolios.
- [x] 3.1 Rolling-origin backtest (last 12 months) for each model + naive; MAE, MAPE, band coverage
- [x] 3.2 Risk metrics per ticker: annualized volatility, beta vs. SPY, max drawdown, 1Y return, dividend yield
- [x] 3.3 Risk-profile thresholds + fit score per ticker (conservative/moderate/aggressive)
- [x] 3.4 Rule-based example portfolios per profile (sector-diversified, labelled as examples)
- [x] 3.5 API: `/scorecard`, `/metrics`, `/screener?profile=`, `/example-portfolios?profile=`, `/search`
- [x] 3.6 Tests for metric math and backtest (no look-ahead leakage)
**Done when:**
- [x] All endpoints return data for every covered ticker
- [x] Backtest verified leak-free by test

## Phase 4 — UI design & build (with `original-ui`)
**Goal:** a distinctive, beginner-friendly interface for the core flow.
**Demo:** pick a risk profile → screener → stock page with candles/line, model toggles, bands, scorecard, metrics.
- [x] 4.1 Run `original-ui`: discovery questions, research, 2–3 concept directions → user picks one
- [x] 4.2 Choose frontend framework + charting library; log decision
- [x] 4.3 Risk-profile picker + 3-question quiz (persist in localStorage)
- [x] 4.4 Home / screener with fit badges, sector browse, search
- [x] 4.5 Stock page: candlestick/line toggle, ranges, volume, hover OHLC, model toggles + bands, GARCH cone
- [x] 4.6 Scorecard panel with plain-English verdict; model explainers
- [x] 4.7 Profile-dependent forecast view; example portfolios page; disclaimers
- [x] 4.8 Responsive + accessibility pass
- [x] 4.9 Rewind & Release: `/api/stocks/{s}/backtest` + scrubber, trail release, reality draw, tally card (pulled from Phase 6, D35)
- [x] 4.10 Guided ↔ Terminal density toggle
**Done when:**
- [x] Full core flow works in the browser against real API data
- [x] Stock page < 2s; works at phone width

## Phase 5 — AI layer: summaries + grounded chat
**Goal:** the AI tutor.
**Demo:** stock page shows an AI summary tuned to the profile; chat answers "how volatile is NVDA vs. the market?" with real numbers and declines "should I buy?".
- [ ] 5.1 Choose Claude models for summary vs. chat (cost/quality); log decision
- [ ] 5.2 Summary generation from metrics + description, cached per ticker/day/profile
- [ ] 5.3 Chat endpoint with streaming + tools (`get_metrics`, `get_forecasts`, `get_scorecard`, `get_price_history`)
- [ ] 5.4 Guardrails: system prompt, advice-refusal behaviour, output filter, rate limit + cost cap
- [ ] 5.5 Chat UI panel on stock page
- [ ] 5.6 Eval script: 10 grounding questions + 5 advice prompts
**Done when:**
- [ ] Eval: 10/10 grounded, 5/5 advice prompts declined
- [ ] API key never reaches the browser

## Phase 6 — Learning extras (can slip)
**Goal:** Time Machine, candlestick patterns, glossary.
**Demo:** rewind MSFT to a date a year ago and watch predictions vs. reality; click a labelled "hammer" candle to learn it.
- [x] 6.1 ~~Time Machine~~ → moved to Phase 4 as "Rewind & Release" (D35)
- [ ] 6.2 Candlestick pattern detection (≥5 patterns) + chart markers + learn cards
- [ ] 6.3 Glossary data + tooltips on every metric/term
**Done when:**
- [ ] All three work on any covered ticker

## Phase 7 — Ship
- [ ] 7.1 Schedule nightly refresh (cron / GitHub Actions)
- [ ] 7.2 Deploy backend + frontend; env/secrets configured
- [ ] 7.3 README: what it is, screenshots, architecture diagram, how to run, model methodology & honesty notes
- [ ] 7.4 Final acceptance pass against PRD §6 and §10
- [ ] 7.5 Retro + v2 pitch

## Later (post-v1)
See PRD §13 Future add-ons.
