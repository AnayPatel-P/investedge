import { useQuery } from "@tanstack/react-query";
import type {
  Backtest,
  ExamplePortfolio,
  Forecasts,
  Metrics,
  PriceBar,
  Profile,
  ProfileKey,
  Scorecard,
  Screener,
  Ticker,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

const DAY = 1000 * 60 * 60 * 24;
const sym = (s: string) => encodeURIComponent(s.toUpperCase());

// Data is refreshed nightly, so cache aggressively.
const opts = { staleTime: DAY / 4, retry: (n: number, e: Error) => !(e instanceof ApiError && e.status === 404) && n < 2 };

export const useProfiles = () => useQuery({ queryKey: ["profiles"], queryFn: () => get<Profile[]>("/profiles"), ...opts });
export const useTickers = () => useQuery({ queryKey: ["tickers"], queryFn: () => get<Ticker[]>("/tickers"), ...opts });

export const useSearch = (q: string) =>
  useQuery({
    queryKey: ["search", q],
    queryFn: () => get<Ticker[]>(`/search?q=${encodeURIComponent(q)}&limit=8`),
    enabled: q.trim().length > 0,
    ...opts,
  });

export const usePrices = (s: string) => useQuery({ queryKey: ["prices", s], queryFn: () => get<PriceBar[]>(`/stocks/${sym(s)}/prices`), ...opts });
export const useForecasts = (s: string) => useQuery({ queryKey: ["forecasts", s], queryFn: () => get<Forecasts>(`/stocks/${sym(s)}/forecasts`), ...opts });
export const useBacktest = (s: string) => useQuery({ queryKey: ["backtest", s], queryFn: () => get<Backtest>(`/stocks/${sym(s)}/backtest`), ...opts });
export const useMetrics = (s: string) => useQuery({ queryKey: ["metrics", s], queryFn: () => get<Metrics>(`/stocks/${sym(s)}/metrics`), ...opts });
export const useScorecard = (s: string) => useQuery({ queryKey: ["scorecard", s], queryFn: () => get<Scorecard>(`/stocks/${sym(s)}/scorecard`), ...opts });

export const useScreener = (profile: ProfileKey, sector?: string) =>
  useQuery({
    queryKey: ["screener", profile, sector],
    queryFn: () => get<Screener>(`/screener?profile=${profile}&limit=503${sector ? `&sector=${encodeURIComponent(sector)}` : ""}`),
    ...opts,
  });

export const usePortfolio = (profile: ProfileKey) =>
  useQuery({ queryKey: ["portfolio", profile], queryFn: () => get<ExamplePortfolio>(`/example-portfolios?profile=${profile}`), ...opts });
