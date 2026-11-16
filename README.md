# InvestEdge

**An almanac of possible futures for every S&P 500 stock** — an educational web app that helps beginner
investors read charts, understand risk, and see how much (or how little) any forecast can be trusted.

**Live demo:** https://anaypatel-p.github.io/investedge/ &nbsp;·&nbsp; data refreshed nightly &nbsp;·&nbsp; free, no sign-up

> Educational project. Not financial advice. InvestEdge never tells anyone to buy or sell.

![InvestEdge stock page: candlestick chart with a fan of possible futures](docs/images/stock-page.jpg)

## The idea

Most "stock prediction" apps sell certainty. InvestEdge does the opposite: it runs four classic forecasting
models on all ~503 S&P 500 stocks, then **replays a year of their past forecasts against what actually
happened** and shows beginners the result — which is usually that no model beat the naive guess
"the price stays where it is."

## Features

- **Rewind & Release** (the signature moment): drag the timeline back to a past date. The model sees only
  the prices up to then, hundreds of possible futures fan out, and the real price draws itself through them
  in ink. A tally card says whether reality landed inside the range and whether the model beat the naive guess.
- **Honest scorecard** for every stock: each model's skill vs. the naive guess, how often its 95% range
  actually caught the price (Prophet's is often overconfident), and a plain-English verdict.
- **Risk in plain English**: volatility, beta vs. the S&P 500, worst drops, dividend yield, and a percentile
  risk score ("riskier than 22% of S&P 500 stocks").
- **Risk profiles** (conservative / moderate / aggressive, or a 3-question quiz) tune the screener, the
  default forecast view, and the explanations.
- **Candlestick patterns** marked on the chart — with each pattern's real track record on that stock
  (e.g. AAPL's "bullish" hammer: higher 5 days later only 27% of the time vs. 55% on any day).
- **Example portfolios** that teach diversification (baskets swung 36–52% less than their average stock),
  built by a visible rule and clearly labelled as examples, not recommendations.
- **Guided ↔ Terminal**: an editorial view for beginners, a dense "night almanac" for power users.
- **Glossary tooltips** on every term, keyboard- and screen-reader-accessible.
- **AI tutor** (full version): a Claude-powered briefing and chat that looks numbers up through read-only
  tools and declines buy/sell questions. Off on the free demo site — see [AI tutor](#ai-tutor-optional).

| Rewind & Release | Tally + scorecard |
|---|---|
| ![Rewound chart with reality drawn through the fan of futures](docs/images/rewind-and-release.jpg) | ![Tally card and model scorecard](docs/images/tally-and-scorecard.jpg) |
| **Terminal mode** | **Candlestick patterns, honestly** |
| ![Dense dark terminal view of NVDA](docs/images/terminal-mode.jpg) | ![Pattern learn cards with track records](docs/images/pattern-cards.jpg) |

## Honest results (past year, 499 stocks)

| Model | Beat "price stays the same" | 95% range caught reality |
|---|---|---|
| ARIMA | 8.8% of stocks | 92% |
| ETS | 2.4% | 93% |
| Prophet | 2.4% (median 41% *worse*) | 58% (overconfident) |
| GARCH | n/a (forecasts swing size, not direction) | 93% |

Backtest: 12 monthly replays per stock, 30-trading-day horizon, each model fit only on data up to the
replay date (enforced by a look-ahead test).

## How it works

```mermaid
flowchart LR
  Y[(Yahoo Finance<br/>daily OHLCV)] --> P
  subgraph Nightly["Nightly (GitHub Actions, 22:30 UTC weekdays)"]
    P[Pipeline<br/>incremental fetch · forecasts<br/>risk metrics · weekly backtest] --> D[(DuckDB)]
    D --> E[Static export<br/>~3,000 JSON files]
  end
  E --> W[React app<br/>GitHub Pages]
  D -. full version .-> A[FastAPI]
  A -. full version .-> W
  A -. tools .-> C[Claude tutor]
```

- **Pipeline** (`backend/`, Python 3.12): S&P 500 constituents → incremental daily prices (re-downloads a
  stock when dividends/splits re-adjust its history) → ARIMA / ETS (statsforecast), Prophet, GARCH (arch)
  and a naive baseline on log prices, in parallel → risk metrics → weekly rolling-origin backtest and
  scorecard → candlestick patterns.
- **Free hosting**: everything is precomputed, so the nightly job exports the read-only API as static JSON and
  deploys the React app to GitHub Pages. If a night's data fetch fails, the last good data is deployed.
- **Web app** (`frontend/`, React + Vite + TypeScript): TradingView Lightweight Charts for candles, plus a
  canvas overlay for the forecast fans and the sampled futures (Brownian paths rescaled to each model's
  stated range; unit-tested to match it).
- **Full version**: the same app talks to a live FastAPI backend, which also hosts the AI tutor.

## Run it locally (full version)

Requires [uv](https://docs.astral.sh/uv/) (installs Python 3.12 for you) and Node 20+.

```bash
make install     # backend (uv) + frontend (npm) deps
make refresh     # all 503 stocks: prices, forecasts, risk metrics; weekly backtest (~1 min, ~8 with backtest)
make dev         # API on :8000 + web app at http://localhost:5173
make test        # backend + frontend tests
```

Other targets: `make build` (production build), `make spike` (time every model).

### AI tutor (optional)

Add `ANTHROPIC_API_KEY=...` to `investedge/.env` (git-ignored) to enable a plain-English briefing and a
grounded chat on each stock page, powered by Claude (`claude-opus-5-5`). The tutor looks numbers up through
four read-only tools, never gives buy/sell advice (system prompt + output filter + refusal handling), and is
capped by per-IP rate limits and a daily budget (`INVESTEDGE_AI_DAILY_BUDGET_USD`, default $3).

Quality check: `cd backend && uv run python evals/tutor_eval.py` (15 real calls, < $1). Last run:
**grounding 10/10, advice declined 5/5**. `--rescore` re-grades saved answers offline.

### Build the static site yourself

```bash
cd backend && uv run investedge export --out ../frontend/public/data
cd ../frontend && npm run build:pages     # → frontend/dist, served from /investedge/
```

## Project layout

```
backend/src/investedge/
  universe.py · prices.py      S&P 500 list, incremental daily prices
  models/forecasters.py        naive, ARIMA, ETS, Prophet, GARCH
  backtest.py · risk.py        rolling-origin scorecard; metrics, profiles, portfolios
  patterns.py                  candlestick patterns + honest hit rates
  pipeline.py · cli.py         nightly job and `investedge` CLI
  api.py · export.py           FastAPI read-only API; static JSON export
  ai/                          Claude tutor: facts, prompts, guardrails, streaming chat
backend/evals/                 tutor eval (grounding + advice)
frontend/src/
  pages/ · chart/ · components/  screens, chart + Rewind & Release, UI pieces
  styles/tokens.css             design tokens: Guided (paper) and Terminal (night)
.github/workflows/              CI; nightly refresh + GitHub Pages deploy
docs/pm/                        PRD, roadmap, decisions log, status
```

## How it was built

Planned and built phase by phase with a written PRD, roadmap and decisions log (48+ decisions with the
reasoning, including the ones that changed course) in [`docs/pm/`](docs/pm/). Tests: 79 backend (incl. a
look-ahead leakage test, fake-client AI tests, eval-grader fabrication tests) and 15 frontend.

## Data & disclaimer

Prices are end-of-day data from Yahoo Finance via `yfinance`, used for education. Figures can be delayed or
wrong. Nothing here is investment advice; past performance doesn't predict future results.
