import type { ModelKey } from "../api/types";

export interface ModelGuideEntry {
  nickname: string;
  analogy: string;
  how: string;
  line: string;
  good: string;
  watch: string;
}

/** Plain-English guide to each forecasting model, written for someone who has never heard of them. */
export const MODEL_GUIDE: Record<ModelKey, ModelGuideEntry> = {
  naive: {
    nickname: "The yardstick",
    analogy: "Like guessing that tomorrow's weather will be the same as today's.",
    how: "Takes today's price as its best guess for every future day. Its range comes from how much the stock has typically moved day to day.",
    line: "Always a flat line at today's price.",
    good: "Surprisingly hard to beat. Prices are close to unpredictable from one day to the next, so “no change” is a strong guess.",
    watch: "It knows nothing about the company or the market. It's the baseline every other model has to beat, not an opinion.",
  },
  arima: {
    nickname: "The pattern-spotter",
    analogy: "Like a coach studying the last few plays to guess the next one.",
    how: "Looks for patterns in recent day-to-day changes, such as a steady drift, or moves that tend to echo or reverse the next day, and picks the simplest pattern that fits.",
    line: "Usually flat (it found no reliable pattern), sometimes a gentle straight slope (it found a steady drift).",
    good: "Honest about uncertainty: its ranges usually catch the real price.",
    watch: "Patterns in past prices are weak and fade fast. On most stocks it does no better than the naive guess.",
  },
  ets: {
    nickname: "The smoother",
    analogy: "Like judging a runner's pace by their last few laps more than their first.",
    how: "Averages the price history, counting recent days more, to estimate where the price “really” is and whether there's a steady trend.",
    line: "Usually flat at its smoothed price; it only slopes if it finds a steady trend.",
    good: "Calm and sensible: it doesn't overreact to one wild day.",
    watch: "On stocks it rarely finds a trend worth following, so in practice it behaves much like the naive guess.",
  },
  prophet: {
    nickname: "The trend-and-seasons fitter",
    analogy: "Like predicting a shop's sales from its long-term growth plus the usual weekend and holiday bumps.",
    how: "Draws a smooth long-term trend through the whole history and adds repeating weekly and yearly patterns. Meta built it for business data like sales and website traffic.",
    line: "Curvy. It can start away from today's price, because it follows its smoothed trend rather than the latest price.",
    good: "Excellent on data with real seasons, like store sales or electricity use.",
    watch: "Stocks don't have dependable seasons, so its curves are mostly noise, and its ranges are often too narrow (overconfident).",
  },
  garch: {
    nickname: "The swing forecaster",
    analogy: "Like a storm forecast: it predicts how rough the ride will be, not which way the wind blows.",
    how: "Measures how bumpy the stock has been lately (calm and stormy stretches tend to cluster together) and forecasts how big the coming swings will be.",
    line: "Flat at today's price. What matters is the width of its range, which grows faster after turbulent weeks.",
    good: "Reacts quickly when a stock gets more volatile, which is useful for thinking about risk.",
    watch: "It never says whether the price will go up or down.",
  },
};
