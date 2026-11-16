# InvestEdge

Educational web app that helps new investors understand any S&P 500 stock through candlestick and line charts, honest multi-model forecasts (ARIMA, ETS, Prophet, GARCH vs. a naive baseline), risk-profile personalization, and an AI tutor.

> Educational project. Not financial advice.

Planning docs: [`docs/pm/`](docs/pm/) — PRD, roadmap, decisions, status.

## Status
Phase 2 (full 503-ticker pipeline) complete. See [`docs/pm/STATUS.md`](docs/pm/STATUS.md).

## Run locally
Requires [uv](https://docs.astral.sh/uv/) (it installs Python 3.12 for you).

```bash
make install     # backend deps
make refresh     # all 503 tickers: incremental prices + every model (~1 min on 16 cores)
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
  pipeline.py      batch jobs
  storage.py       DuckDB store (batch writes, API reads)
  api.py           FastAPI read-only API
  cli.py           `investedge` CLI
frontend/skeleton/ throwaway Phase 1 page (real UI comes in Phase 4)
data/              local DuckDB file (git-ignored)
```
