/** Plain-English definitions used by <Term>. One or two sentences each, written for beginners. */
export const GLOSSARY = {
  volatility: {
    term: "Volatility",
    def: "How much a price usually swings up and down in a year. 25% means a typical year's moves are roughly a quarter of the price either way. Bigger means a bumpier ride.",
  },
  beta: {
    term: "Beta",
    def: "How strongly a stock has moved with the whole market (the S&P 500). 1 = in step; 0.5 = half as much; 2 = twice as much. It can even be negative for a while. It describes the past, not a promise.",
  },
  drawdown: {
    term: "Drawdown",
    def: "The fall from a high point to the lowest point after it. The worst drawdown is what holding the stock felt like at the worst possible moment.",
  },
  dividendYield: {
    term: "Dividend yield",
    def: "Cash the company paid shareholders over the last 12 months, as a share of today's price. 2% means about $2 a year for every $100 of stock. Companies can cut dividends.",
  },
  riskScore: {
    term: "Risk score",
    def: "InvestEdge's ranking of how risky a stock has been compared with the rest of the S&P 500, combining swings, market sensitivity (beta) and worst drop. 80 means riskier than 80% of them.",
  },
  return1y: {
    term: "1-year return",
    def: "How much the price changed over the last 12 months (dividends not included). Past returns don't predict future ones.",
  },
  returnPerRisk: {
    term: "Return per unit of risk",
    def: "Last year's return divided by its volatility (a simple Sharpe ratio). It asks: how much did the ride pay for how bumpy it was?",
  },
  candlestick: {
    term: "Candlestick",
    def: "One day's price action. The thick body runs from the open to the close; thin wicks show the day's high and low. Hollow = closed higher than it opened, filled = closed lower.",
  },
  forecastRange: {
    term: "Forecast range",
    def: "The band a model expects the price to land in. An 80% range should contain the real price about 8 times out of 10 — if the model is honest. Wider ranges are safer but less precise.",
  },
  naive: {
    term: "Naive guess",
    def: "The simplest possible forecast: tomorrow's price equals today's. Any model worth listening to should beat it. Most don't, most of the time.",
  },
  arima: {
    term: "ARIMA",
    def: "A classic statistical model that looks for patterns in recent price changes and how past surprises carry forward.",
  },
  ets: {
    term: "ETS",
    def: "Exponential smoothing: averages the price history with more weight on recent days to estimate a level and trend.",
  },
  prophet: {
    term: "Prophet",
    def: "A model from Meta that fits a long-term trend plus repeating weekly and yearly patterns. Built for business data, often overconfident on stocks.",
  },
  garch: {
    term: "GARCH",
    def: "A model that forecasts how much the price will swing, not which way. Its range is a 'how bumpy' estimate around today's price.",
  },
  backtest: {
    term: "Replay (backtest)",
    def: "Rewinding to a past date, letting a model see only the prices up to then, and checking its forecast against what actually happened. InvestEdge does this 12 times over the past year.",
  },
  skill: {
    term: "Skill vs. naive",
    def: "How much smaller a model's typical miss was than the naive guess's. +10% = misses 10% smaller; negative = worse than doing nothing.",
  },
  coverage: {
    term: "Range coverage",
    def: "How often the real price actually landed inside a model's range. A 95% range should catch it about 95% of the time; much less means the model is overconfident.",
  },
  diversification: {
    term: "Diversification",
    def: "Spreading money across different companies and sectors so one company's bad day matters less. It reduces swings; it doesn't remove risk.",
  },
  sector: {
    term: "Sector",
    def: "The broad industry a company belongs to, like Energy or Health Care. Stocks in the same sector often move together.",
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
