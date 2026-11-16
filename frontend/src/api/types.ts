// Mirrors the FastAPI responses in backend/src/investedge/api.py.

export type ProfileKey = "conservative" | "moderate" | "aggressive";
export type Fit = "good" | "possible" | "outside";
export type RiskLevel = "low" | "medium" | "high";
export type ModelKey = "naive" | "arima" | "ets" | "prophet" | "garch";

export interface Ticker {
  symbol: string;
  name: string;
  sector: string;
  last_date?: string;
  stale?: boolean;
}

export interface Profile {
  key: ProfileKey;
  label: string;
  description: string;
  fit: Record<RiskLevel, Fit>;
  view: {
    bands: number[];
    emphasis: string;
    default_models: ModelKey[];
    explanation_focus: string[];
  };
}

export interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ForecastPoint {
  date: string;
  mean: number;
  lo_80: number;
  hi_80: number;
  lo_95: number;
  hi_95: number;
}
export type Forecasts = Partial<Record<ModelKey, ForecastPoint[]>>;

export interface BacktestPoint extends ForecastPoint {
  step: number;
  actual: number;
}
export interface Backtest {
  symbol: string;
  origins: string[];
  runs: Record<string, Partial<Record<ModelKey, BacktestPoint[]>>>;
}

export interface Metrics {
  symbol: string;
  name: string;
  sector: string;
  as_of: string;
  last_close: number;
  return_1y: number | null;
  volatility_1y: number | null;
  beta_1y: number | null;
  max_drawdown_1y: number | null;
  max_drawdown_5y: number | null;
  dividend_yield: number | null;
  sharpe_1y: number | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  risk_sentence: string;
  fit: Record<ProfileKey, Fit>;
}

export interface ScoreRow {
  model: ModelKey;
  run_date: string;
  n_origins: number;
  mae: number;
  mape: number;
  coverage_80: number;
  coverage_95: number;
  skill: number | null;
  beats_baseline: boolean;
}
export interface Scorecard {
  symbol: string;
  baseline: ModelKey;
  verdict: string;
  coverage_note: string | null;
  models: ScoreRow[];
}

export interface ScreenerRow {
  symbol: string;
  name: string;
  sector: string;
  fit: Fit;
  risk_level: RiskLevel | null;
  risk_score: number | null;
  risk_sentence: string;
  volatility_1y: number | null;
  beta_1y: number | null;
  max_drawdown_1y: number | null;
  return_1y: number | null;
  dividend_yield: number | null;
  sharpe_1y: number | null;
}
export interface Screener {
  profile: ProfileKey;
  total: number;
  results: ScreenerRow[];
}

export interface ExamplePortfolio {
  profile: ProfileKey;
  label: string;
  disclaimer: string;
  rule: string;
  holdings: {
    symbol: string;
    name: string;
    sector: string;
    weight: number;
    risk_level: RiskLevel;
    volatility_1y: number;
    dividend_yield: number;
  }[];
  stats: {
    volatility_1y: number;
    return_1y: number;
    max_drawdown_1y: number;
    avg_holding_volatility_1y: number;
    sectors: number;
  };
  lesson: string;
}
