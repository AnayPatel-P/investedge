# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Curious beginner** (primary, tied): someone who just opened a brokerage account, knows little jargon, and wants to understand one S&P 500 stock (what the price has done, how risky it is for them, and how far any forecast can be trusted). Usually arrives on a laptop or phone, alone, with a ticker in mind.
- **Portfolio reviewer** (primary, tied): a recruiter or engineer judging the project as a portfolio piece, usually in under a minute. They should see real craft and sound, honest ML.

When the two conflict, the task stays clear for the beginner and the signature moment carries the showpiece.

## Product Purpose

InvestEdge uses charts and forecasting models to teach, not to predict. For any of ~503 S&P 500 stocks it shows price history, risk in plain English, what four models (ARIMA, ETS, Prophet, GARCH) expect next, and how often those models were actually right compared with the naive guess that "the price stays where it is." Success means a beginner leaves less fooled by confident predictions and able to read a forecast's range and track record.

## Positioning

Every forecast InvestEdge shows comes with its own replayed record: a year of past forecasts per stock, refit only on data available at the time, checked against what really happened and against the naive baseline. Most models lose to that baseline, and the product says so. Finance sites show data without teaching; prediction content sells certainty. This product makes the uncertainty and the track record the main thing on screen.

## Operating Context

- Static site on GitHub Pages; data refreshed every weeknight by GitHub Actions (~3,000 precomputed JSON files). No accounts, no sign-up.
- Surfaces: Home (search, browse by sector, risk-profile screener), Stock page (chart with forecast futures, rewind/replay of past forecasts, outlook in words, scorecard, risk metrics, candlestick patterns with their track record, model guide, S&P 500 comparison), Portfolios (example baskets teaching diversification), Profile picker / 3-question risk quiz.
- Two density views exist today: Guided (spacious, explained) and Terminal (dense).
- Full version only: AI tutor (Claude) with briefing and grounded chat; switched off on the public demo.

## Capabilities and Constraints

- React 18 + Vite + TypeScript, TanStack Query, Lightweight Charts 4.2, Vitest. Static build with `VITE_STATIC=1`.
- Daily bars only; no intraday or real-time data.
- Never gives buy/sell advice; "educational, not financial advice" appears globally, in the tutor, and on portfolios.
- Forecasts and backtests are precomputed; the client renders, it does not fit models.
- Must work on phones (responsive web; no native app).

## Brand Commitments

- Name: InvestEdge.
- Voice: plain English, first-person-honest, never hype; numbers stated with their uncertainty ("97 of 180 futures end higher, a coin flip").
- Reality versus forecast must always be visually distinct.

## Evidence on Hand

- Real backtest results (README "Results from the past year"): ARIMA beat the naive guess on 8.8% of stocks, ETS 2.4%, Prophet 2.4% with 58% band coverage.
- Real pattern track records (e.g. AAPL hammer followed by a higher price 5 days later 27% of the time vs 55% baseline).
- Real portfolio diversification figures (baskets swung 36–52% less than their average stock).
- Screenshots in `docs/images/`. No testimonials, users, or press exist; do not invent any.

## Product Principles

1. Show the record next to every forecast; never a prediction without its track record.
2. Uncertainty is the content: ranges, counts of futures, and calibration lead, point forecasts follow.
3. Teach in place: every term is explainable where it appears.
4. Honest over impressive: when the naive guess wins, say it plainly.
5. Beginner-clear task, showpiece signature moment.

## Accessibility & Inclusion

Keyboard and screen-reader access for glossary terms and chart controls; reduced-motion, reduced-transparency and high-contrast handling are already in place and must be kept.
