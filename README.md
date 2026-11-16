# InvestEdge

Educational web app that helps new investors understand any S&P 500 stock through candlestick and line charts, honest multi-model forecasts (ARIMA, ETS, Prophet, GARCH vs. a naive baseline), risk-profile personalization, and an AI tutor.

> Educational project. Not financial advice.

Planning docs: [`docs/pm/`](docs/pm/) — PRD, roadmap, decisions, status.

## Status
Phase 4 (the web app) complete: profile picker, screener, stock pages with **Rewind & Release**, example portfolios. See [`docs/pm/STATUS.md`](docs/pm/STATUS.md).

## Run locally
Requires [uv](https://docs.astral.sh/uv/) (it installs Python 3.12 for you) and Node 20+.

```bash
make install     # backend (uv) + frontend (npm) deps
make refresh     # all 503 tickers: prices, forecasts, risk metrics; weekly backtest (~1 min, ~8 with backtest)
make dev         # API on :8000 + web app at http://localhost:5173
make test        # backend + frontend tests
make build       # production build of the web app
make spike       # time every model; extrapolates to all 503 tickers
```

## Layout
```
backend/src/investedge/
  config.py        settings (.env, INVESTEDGE_*)
  universe.py      S&P 500 constituents
  prices.py        daily OHLCV via yfinance
  models/          forecasters (naive, ARIMA, ETS, Prophet, GARCH)
  backtest.py      rolling-origin backtest + scorecard + plain-English verdicts
  risk.py          risk metrics, risk profiles, screener, example portfolios
  patterns.py      candlestick pattern detection + honest hit rates
  pipeline.py      batch jobs
  storage.py       DuckDB store (batch writes, API reads)
  api.py           FastAPI read-only API
  cli.py           `investedge` CLI
frontend/src/
  pages/           Home (profile picker + screener), Stock, Portfolios
  chart/           FuturesChart (Lightweight Charts + canvas overlay), trails, tally, Scrubber
  components/      Dial, Masthead/Search, ScorecardPanel, MetricsLedger, badges
  styles/tokens.css  design tokens: Guided (almanac paper) and Terminal (night almanac)
data/              local DuckDB file (git-ignored)
```

## Design
"Almanac of Possible Futures": warm almanac paper, Fraunces + IBM Plex, and one signature moment.
**Rewind & Release**: drag the timeline back to a past date, watch hundreds of possible futures fan out
from what a model knew then, and see the real price draw itself through them. A tally card says whether
reality landed inside the range and whether the model beat the naive guess. Toggle **Guided ↔ Terminal**
for an editorial or a dense view.

## AI tutor (optional)
Add `ANTHROPIC_API_KEY=...` to `investedge/.env` (git-ignored) to enable a plain-English briefing and a
grounded chat on each stock page, powered by Claude (`claude-opus-5-5`). The tutor looks numbers up through
read-only tools, never gives buy/sell advice, and is capped by per-IP rate limits and a daily budget
(`INVESTEDGE_AI_DAILY_BUDGET_USD`, default $3). Without a key, everything else works and the panel says so.
Quality check: `cd backend && uv run python evals/tutor_eval.py` (real API calls, < $1).

## API
| Endpoint | What it returns |
|----------|-----------------|
| `GET /api/tickers` | Constituents with last price date and `stale` flag |
| `GET /api/search?q=` | Type-ahead by ticker or name |
| `GET /api/profiles` | Risk profiles, fit rules, forecast-view hints |
| `GET /api/stocks/{s}/prices` | Daily OHLCV |
| `GET /api/stocks/{s}/forecasts` | 30-day forecasts with 80/95% bands per model |
| `GET /api/stocks/{s}/metrics` | Risk metrics, risk score/level, profile fit |
| `GET /api/stocks/{s}/scorecard` | Backtest accuracy vs. naive baseline + verdict |
| `GET /api/stocks/{s}/patterns` | Candlestick patterns + each pattern's track record on this stock |
| `GET /api/stocks/{s}/backtest` | Past forecasts at each replay date vs. what happened |
| `GET /api/screener?profile=` | Stocks ranked by fit for a profile |
| `GET /api/example-portfolios?profile=` | Rule-based example basket + diversification lesson |
| `GET /api/runs/latest` | Latest pipeline run report |
| `GET /api/ai/status` | Whether the AI tutor is configured |
| `GET /api/stocks/{s}/summary?profile=` | Cached AI briefing (needs key) |
| `POST /api/stocks/{s}/chat` | Streaming tutor chat, NDJSON events (needs key) |

## Honest results (past year, 499 stocks)
ARIMA beat the "price stays the same" baseline on 8.8% of stocks; ETS and Prophet on 2.4%.
Prophet's 95% ranges caught the real price only 58% of the time. InvestEdge shows this to users on purpose.
