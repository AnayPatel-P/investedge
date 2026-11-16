# InvestEdge

Educational web app that helps new investors understand any S&P 500 stock through candlestick and line charts, honest multi-model forecasts (ARIMA, ETS, Prophet, GARCH vs. a naive baseline), risk-profile personalization, and an AI tutor.

> Educational project. Not financial advice.

Planning docs: [`docs/pm/`](docs/pm/) — PRD, roadmap, decisions, status.

## Status
Phase 3 (backtest scorecard, risk metrics, profiles, example portfolios) complete. See [`docs/pm/STATUS.md`](docs/pm/STATUS.md).

## Run locally
Requires [uv](https://docs.astral.sh/uv/) (it installs Python 3.12 for you).

```bash
make install     # backend deps
make refresh     # all 503 tickers: prices, forecasts, risk metrics; weekly backtest (~1 min, ~8 with backtest)
make dev         # API + skeleton page at http://localhost:8000
make test        # unit tests
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
  pipeline.py      batch jobs
  storage.py       DuckDB store (batch writes, API reads)
  api.py           FastAPI read-only API
  cli.py           `investedge` CLI
frontend/skeleton/ throwaway Phase 1 page (real UI comes in Phase 4)
data/              local DuckDB file (git-ignored)
```

## API (read-only)
| Endpoint | What it returns |
|----------|-----------------|
| `GET /api/tickers` | Constituents with last price date and `stale` flag |
| `GET /api/search?q=` | Type-ahead by ticker or name |
| `GET /api/profiles` | Risk profiles, fit rules, forecast-view hints |
| `GET /api/stocks/{s}/prices` | Daily OHLCV |
| `GET /api/stocks/{s}/forecasts` | 30-day forecasts with 80/95% bands per model |
| `GET /api/stocks/{s}/metrics` | Risk metrics, risk score/level, profile fit |
| `GET /api/stocks/{s}/scorecard` | Backtest accuracy vs. naive baseline + verdict |
| `GET /api/screener?profile=` | Stocks ranked by fit for a profile |
| `GET /api/example-portfolios?profile=` | Rule-based example basket + diversification lesson |
| `GET /api/runs/latest` | Latest pipeline run report |

## Honest results (past year, 499 stocks)
ARIMA beat the "price stays the same" baseline on 8.8% of stocks; ETS and Prophet on 2.4%.
Prophet's 95% ranges caught the real price only 58% of the time. InvestEdge shows this to users on purpose.
