# Decisions log

| # | Date | Decision | Why | Alternatives considered |
|---|------|----------|-----|-------------------------|
| D1 | 2026-11-15 | Product name: **InvestEdge** | User's choice | Candlewise (working name) |
| D2 | 2026-11-15 | Goal is a portfolio / learning project | Free data, no accounts, focus on polish + sound ML | Launch to real users; personal tool |
| D3 | 2026-11-15 | Positioning: teach forecast *uncertainty*, not sell predictions | Crowded space (Yahoo, TradingView, Simply Wall St); daily prices ≈ random walk, so honest evaluation is both the ethical and the differentiating choice | "Prediction app" framing |
| D4 | 2026-11-15 | Models: ARIMA/SARIMA, ETS, Prophet, GARCH + naive baseline | Explainable, fast, educational; GARCH pairs with risk feature | LSTM (deferred to v2 — slow for 503 tickers, rarely beats baselines) |
| D5 | 2026-11-15 | Risk profile drives screener, forecast view, explanation tone, and example portfolios | User selected all four | — |
| D6 | 2026-11-15 | Example portfolios framed as rule-based learning examples, never recommendations; chat declines buy/sell calls; disclaimers everywhere | Avoid personalized investment advice | Personalized allocations (rejected) |
| D7 | 2026-11-15 | Data: daily end-of-day via yfinance with Stooq fallback, refreshed nightly | Free; sufficient for daily models | Paid intraday API |
| D8 | 2026-11-15 | Architecture: nightly batch precomputes everything into DuckDB/Parquet; API only reads | Fast pages, cheap hosting | On-demand model fits per request |
| D9 | 2026-11-15 | Backend in Python (FastAPI) | User requirement; best time-series ecosystem | Streamlit; Next.js full-stack |
| D10 | 2026-11-15 | UI designed via `original-ui` skill; frontend framework decided in Phase 4 | User requirement; keep design open until concept chosen | Pick React now |
| D11 | 2026-11-15 | AI: Claude-generated cached summaries + grounded live chat with tool use | User wants both; tools keep numbers factual | Templates only |
| D12 | 2026-11-15 | Adopted into v1: model scorecard, grounded chat, Time Machine, candlestick patterns + glossary | User selected all; Time Machine & patterns placed in slippable Phase 6 | — |
| D13 | 2026-11-15 | Own git repo for InvestEdge; work on `phase-N/...` branches | Clean history, publishable as a portfolio repo | Track inside parent ~/Documents/Projects repo |
| D14 | 2026-11-15 | Tooling: uv + Python 3.12, ruff, mypy, pytest; Makefile entry points | Project baseline from tech-stacks guide | Python 3.10 + venv |
| D15 | 2026-11-15 | Constituents from `datasets/s-and-p-500-companies` CSV, Wikipedia fallback (503 loaded) | Maintained, machine-readable; fallback covers outages | Wikipedia only |
| D16 | 2026-11-15 | Model fits via statsforecast (AutoARIMA, AutoETS) on **log prices**; Prophet; arch GARCH(1,1); naive random-walk baseline | Fast fits; log space keeps bands positive and multiplicative | pmdarima (slower, numpy-2 friction) |
| D17 | 2026-11-15 | **Spike result: GO.** Mean seconds/fit on 20 tickers: Prophet 0.72, ARIMA 0.10, ETS 0.04, GARCH 0.01, naive ~0. All models × 503 tickers ≈ 7.3 min single-core (~1 min on 16 cores). Daily full refit is fine | Riskiest assumption retired | Weekly refit (not needed) |
| D18 | 2026-11-15 | Phase 3 note: rolling-origin backtest multiplies fits (e.g. 12 monthly origins ≈ 12× → ~90 min serial). Parallelize and/or refit backtests weekly, not nightly | Keep nightly job < 60 min | — |
| D19 | 2026-11-15 | Trading-day calendar approximated with US federal holidays (misses Good Friday) | Good enough for a 30-day display horizon; revisit with `pandas_market_calendars` if needed | Exact NYSE calendar |
