# InvestEdge — PRD

_Version 1.0 · 2026-11-15 · Status: Draft (awaiting approval)_

## 1. Vision
Every new investor should be able to open any S&P 500 stock and understand it: what its price has done, how risky it is for *them*, and how much (or how little) any forecast can be trusted. InvestEdge turns charts and forecasting models into a teacher, not a fortune teller.

**One-liner:** InvestEdge helps new investors understand any S&P 500 stock through interactive charts, honest multi-model forecasts and an AI tutor, unlike typical finance sites that show data without teaching how to read it.

## 2. Problem
- **Who has it:** beginner investors (students, first-time brokerage users).
- **What they do today:** skim Yahoo Finance/TradingView, watch social media "price predictions", or guess.
- **Why that's painful:** tools assume expertise (candlesticks, beta, P/E are unexplained), and prediction content oversells certainty, which leads beginners into risk they don't understand.

## 3. Target users
| Persona | Description | Key need |
|---------|-------------|----------|
| Curious beginner | Just opened a brokerage account, knows little jargon | Plain-English explanations, "is this risky for me?" |
| Student / learner | Studying finance or data science | See how forecasting models work and compare |
| Portfolio reviewer (secondary) | Recruiter/engineer viewing the project | Polished UI, sound ML, honest evaluation |

## 4. Goals and non-goals
**Goals (v1)**
- Cover all ~503 S&P 500 tickers with daily data refreshed nightly.
- Show candlestick and line charts with forecast overlays and confidence bands.
- Forecast with ARIMA/SARIMA, ETS, Prophet (price) and GARCH (volatility), and **evaluate every model against a naive baseline**.
- Personalize the experience by risk profile (conservative / moderate / aggressive).
- Explain each stock and every concept in beginner-friendly language, including a grounded AI chat.

**Non-goals (v1)**
- Personalized investment advice, buy/sell signals, or trade execution.
- User accounts, saved watchlists, portfolio tracking.
- Intraday / real-time data.
- Deep-learning (LSTM/transformer) forecasting.
- Native mobile apps (responsive web only).

## 5. Features (MoSCoW)
| # | Feature | Priority | Notes |
|---|---------|----------|-------|
| F1 | S&P 500 universe + nightly data pipeline (yfinance, Stooq fallback, DuckDB/Parquet cache) | Must | Foundation |
| F2 | Stock page: candlestick + line chart, ranges (1M–5Y), volume, key metrics | Must | |
| F3 | Forecasts: ARIMA/SARIMA, ETS, Prophet; GARCH volatility; confidence bands on chart | Must | Precomputed nightly |
| F4 | Model scorecard: each model vs. naive baseline, rolling-origin error (MAE/MAPE, band coverage) | Must | Core differentiator |
| F5 | Risk profile selector driving screener, forecast view, explanation tone, example portfolios | Must | See §6 F5 |
| F6 | AI stock summary (Claude, cached per ticker per day) | Must | |
| F7 | Grounded AI chat with tool access to the stock's metrics/forecasts and advice guardrails | Must | |
| F8 | "Educational, not financial advice" disclaimers (global + chat + portfolios) | Must | |
| F9 | Search + browse by ticker, name, sector | Must | |
| F10 | Time Machine: pick a past date, compare models' predictions to what happened | Should | Can slip |
| F11 | Candlestick pattern labels (doji, engulfing, hammer…) with click-to-learn | Could | Can slip |
| F12 | Glossary tooltips on every financial term | Could | Cheap; likely lands with polish |
| F13 | LSTM / deep-learning models | Won't (v1) | Future add-on |
| F14 | Accounts, watchlists, alerts | Won't (v1) | Future add-on |

## 6. User stories and acceptance criteria

### F1 — Data pipeline
- **As the system** I fetch and store daily OHLCV for every S&P 500 constituent so pages load instantly.
- **Done when:**
  - [ ] Constituent list loads (~503 tickers) with name and GICS sector.
  - [ ] ≥5 years of daily OHLCV stored for ≥98% of tickers; failures logged and retried via fallback source.
  - [ ] One command (`make refresh` or equivalent) runs the full nightly job end-to-end.
  - [ ] Incremental refresh only fetches missing days.

### F2 — Stock page charts
- **As a** beginner **I want** to see a stock's price as candles or a line **so that** I can understand its history.
- **Done when:**
  - [ ] Toggle between candlestick and line; ranges 1M/6M/1Y/5Y.
  - [ ] Volume shown; hover shows date, O/H/L/C, volume.
  - [ ] Key metrics shown: last price, 1Y return, annualized volatility, beta vs. SPY, max drawdown, sector.
  - [ ] Page loads in < 2s from cache.

### F3 — Forecasts
- **As a** learner **I want** to see what different models predict **so that** I understand forecasting.
- **Done when:**
  - [ ] ARIMA/SARIMA (auto order), ETS, and Prophet produce a 30-trading-day forecast with 80% and 95% bands for every ticker.
  - [ ] GARCH(1,1) produces a 30-day volatility forecast shown as an expected-range cone.
  - [ ] Each model can be toggled on/off on the chart.
  - [ ] A one-paragraph "how this model works" explainer for each model.

### F4 — Model scorecard
- **As a** beginner **I want** to know how accurate each model has been **so that** I don't over-trust forecasts.
- **Done when:**
  - [ ] Rolling-origin backtest over the last 12 months for each model and the naive (random-walk) baseline.
  - [ ] Scorecard shows MAE, MAPE, and confidence-band coverage, with "beats baseline? yes/no".
  - [ ] Plain-English verdict line (e.g. "No model beat 'tomorrow = today' for AAPL this year — that's normal.").

### F5 — Risk profile
- **As a** beginner **I want** to choose my risk appetite **so that** the app highlights what fits me.
- **Done when:**
  - [ ] Profile picker (conservative / moderate / aggressive) with a 3-question quiz option; persists in the browser.
  - [ ] **Screener:** stocks ranked/filtered by volatility, beta, drawdown thresholds per profile; each stock shows a fit badge.
  - [ ] **Forecast view:** conservative shows wider bands and downside scenario emphasized; aggressive shows full model spread.
  - [ ] **Explanation tone:** AI summary and chat emphasize stability/dividends vs. growth/volatility by profile.
  - [ ] **Example portfolios:** one illustrative diversified basket per profile (sector-diversified, rule-based), labelled "example for learning, not a recommendation", each with a short lesson on diversification.

### F6 — AI summary
- **Done when:**
  - [ ] Each stock page shows a ≤150-word plain-English summary generated from real metrics + company description.
  - [ ] Summaries cached per ticker per day per profile; regenerated only when stale.
  - [ ] No buy/sell language (checked by prompt + a simple output filter).

### F7 — Grounded AI chat
- **As a** beginner **I want** to ask questions about the stock I'm viewing **so that** I learn in context.
- **Done when:**
  - [ ] Chat panel on the stock page; streamed responses.
  - [ ] Model uses tools (`get_metrics`, `get_forecasts`, `get_scorecard`, `get_price_history`) — numbers in answers come from tools, not memory.
  - [ ] Asking "should I buy X?" gets a polite decline + an educational reframe.
  - [ ] Per-session rate limit and cost cap; API key server-side only.

### F8 — Disclaimers
- **Done when:** global footer, chat header, and example portfolios each show an "educational, not financial advice" notice.

### F9 — Search & browse
- **Done when:** type-ahead search by ticker/name; browse by sector; screener table sortable.

### F10 — Time Machine (Should)
- **Done when:** user picks a date ≥ 1 year ago; chart hides data after it, shows what each model forecast then, and reveals actual prices with an error readout.

### F11 / F12 — Patterns & glossary (Could)
- **Done when:** ≥5 classic candlestick patterns detected and labelled on chart with click-to-learn cards; glossary tooltip on every metric label.

## 7. Core user flow
1. Land on home → pick risk profile (or take 3-question quiz).
2. See screener ranked for that profile, or search a ticker.
3. Open stock page → chart (candles/line) + AI summary + metrics with tooltips.
4. Toggle model forecasts → read scorecard ("how much to trust this").
5. Ask the chat a question → grounded answer.
6. (Optional) Time Machine → replay a past forecast.

## 8. Non-functional requirements
- **Performance:** stock page < 2s; all forecasts precomputed; API responses served from DuckDB/Parquet.
- **Batch runtime:** full nightly refresh + model fits for ~503 tickers in < 60 min on a laptop (parallelized).
- **Platforms:** modern desktop browsers; responsive down to phone width.
- **Privacy/security:** no accounts, no PII; Claude API key only on the server; rate-limited chat endpoint.
- **Accessibility:** keyboard navigable, color is never the only signal (up/down candles also differ in fill), WCAG AA contrast.
- **Cost:** data free; Claude spend capped (cached summaries, prompt caching, small model for summaries, per-session limits). Target < $10/month at demo traffic.

## 9. Tech approach (summary)
- **Backend:** Python 3.12, FastAPI, pandas, statsmodels (ARIMA/ETS), pmdarima or statsforecast for auto-ARIMA, prophet, arch (GARCH), DuckDB + Parquet storage.
- **Batch:** a CLI job (`investedge refresh`) using multiprocessing; scheduled via cron / GitHub Actions.
- **AI:** Anthropic Python SDK; summaries + chat with tool use; prompt caching.
- **Frontend:** designed with the `original-ui` skill in the UI phase; framework chosen then (likely React + Vite with TradingView Lightweight Charts or ECharts for candlesticks).
- **Deploy:** backend on Render/Fly.io, frontend on Vercel/Netlify (decided in Ship phase).
- Detailed reasons in `DECISIONS.md`.

## 9b. Design
**Concept:** "Almanac of Possible Futures" with an Instrument-Bench confidence dial (D33).
- **Signature moment — Rewind & Release (D34):** scrub back to a past date; hundreds of possible-future trails sampled from each model's forecast range fan out; the real price draws through them in ink; a tally card says whether reality stayed inside the range and whether the model beat the naive guess.
- **Confidence dial:** a detented control (50 / 80 / 95%) that widens the bands, captioned "wider range = more honest, less precise".
- **Density toggle (D36):** Guided (editorial, captions) ↔ Terminal (dense night almanac).
- **Visual language:** warm paper `#F4EDE1`, ink `#1F2A30`, ochre `#C98A2E`, teal `#2E6E72` (up/reality), rust `#B4472F` (down); Fraunces + IBM Plex Sans/Mono; hollow vs. filled candles and ▲/▼ glyphs so color is never the only signal.

## 10. Success metrics
| Metric | Target | How measured |
|--------|--------|--------------|
| Ticker coverage | ≥ 98% of S&P 500 with data + forecasts | Pipeline report |
| Page speed | < 2s stock page load | Browser devtools |
| Forecast honesty | Scorecard present for 100% of tickers, baseline always shown | Spot check |
| Chat grounding | 10/10 test questions answer with tool-sourced numbers; 5/5 advice prompts declined | Manual eval script |
| Portfolio quality | Deployed public URL + README a recruiter can follow | Review |

## 11. Risks and assumptions
| Risk / assumption | Impact | Likelihood | Mitigation / early test |
|-------------------|--------|------------|-------------------------|
| Fitting 4 model families × 503 tickers nightly is too slow (Prophet especially) | High | Med | **Phase 1 spike**: time all models on 20 tickers; fall back to statsforecast, fewer refits (weekly refit, daily update), or parallelism |
| yfinance breaks / rate-limits | High | Med | Cache, incremental fetch, Stooq fallback, backoff |
| Chat or portfolios read as investment advice | High | Med | Guardrail prompt, refusal tests, disclaimers, "example for learning" framing |
| Forecasts mislead beginners | Med | High | Baseline + scorecard always visible; bands always shown; verdict copy |
| Claude API costs run up | Med | Low | Caching, small model for summaries, rate limits |
| Scope too big for a few weeks | Med | Med | Time Machine & patterns are late, slippable phases |
| S&P constituent list changes | Low | Med | Refresh list weekly from source |

## 12. Open questions
- [ ] Source for S&P 500 constituents (Wikipedia table vs. a maintained CSV) — decide in Phase 1.
- [ ] Frontend framework and charting library — decide in UI phase with `original-ui`.
- [ ] Hosting target — decide in Ship phase.
- [ ] Which Claude model for summaries vs. chat — decide in AI phase based on cost/quality.

## 13. Future add-ons (backlog)
| Idea | Why it's valuable | Size | Suggested version |
|------|-------------------|------|-------------------|
| LSTM / Temporal Fusion Transformer models | Shows deep learning; compare honestly vs. baselines in scorecard | L | v2 |
| Accounts + watchlists + email digests | Retention | M | v2 |
| "Paper portfolio" simulator | Learn by doing without real money | M | v2 |
| Learning path / mini-lessons with quizzes | Structured education, gamified streaks | M | v2 |
| Earnings & news annotations on chart (with AI explanation) | Explains *why* price moved | M | v2 |
| Compare two stocks side by side | Common beginner question | S | v2 |
| Sector / index-level dashboards | Big-picture context | S | v2 |
| Beyond S&P 500 (ETFs, Nasdaq-100) | Coverage | S–M | v3 |
| Intraday data | More granular charts | L | v3 |
| Shareable stock "explainer cards" (image) | Organic sharing | S | v2 |
