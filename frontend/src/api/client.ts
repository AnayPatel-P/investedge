import { useQuery } from "@tanstack/react-query";
import type {
  AiStatus,
  Backtest,
  ChatEvent,
  ExamplePortfolio,
  Forecasts,
  Metrics,
  Patterns,
  PriceBar,
  Profile,
  RunReport,
  ProfileKey,
  Scorecard,
  Screener,
  Summary,
  Ticker,
} from "./types";
import { STATIC, searchTickers, staticUrl } from "./static";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function get<T>(path: string): Promise<T> {
  let url = `/api${path}`;
  if (STATIC) {
    const file = staticUrl(path);
    if (!file) throw new ApiError(404, "Not available in the static site");
    url = file;
  }
  const res = await fetch(url);
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
    queryFn: async () =>
      STATIC ? searchTickers(await get<Ticker[]>("/tickers"), q) : get<Ticker[]>(`/search?q=${encodeURIComponent(q)}&limit=8`),
    enabled: q.trim().length > 0,
    ...opts,
  });

export const usePrices = (s: string) => useQuery({ queryKey: ["prices", s], queryFn: () => get<PriceBar[]>(`/stocks/${sym(s)}/prices`), ...opts });
export const useForecasts = (s: string) => useQuery({ queryKey: ["forecasts", s], queryFn: () => get<Forecasts>(`/stocks/${sym(s)}/forecasts`), ...opts });
export const useBacktest = (s: string) => useQuery({ queryKey: ["backtest", s], queryFn: () => get<Backtest>(`/stocks/${sym(s)}/backtest`), ...opts });
export const usePatterns = (s: string, enabled: boolean) =>
  useQuery({ queryKey: ["patterns", s], queryFn: () => get<Patterns>(`/stocks/${sym(s)}/patterns?days=1300`), enabled, ...opts });
export const useMetrics = (s: string) => useQuery({ queryKey: ["metrics", s], queryFn: () => get<Metrics>(`/stocks/${sym(s)}/metrics`), ...opts });
export const useScorecard = (s: string) => useQuery({ queryKey: ["scorecard", s], queryFn: () => get<Scorecard>(`/stocks/${sym(s)}/scorecard`), ...opts });

export const useScreener = (profile: ProfileKey, sector?: string) =>
  useQuery({
    queryKey: ["screener", profile, sector],
    queryFn: async () => {
      const data = await get<Screener>(`/screener?profile=${profile}&limit=503${sector ? `&sector=${encodeURIComponent(sector)}` : ""}`);
      if (!STATIC || !sector) return data;
      // The static file holds the full ranked list; filter the sector in the browser.
      const results = data.results.filter((r) => r.sector.toLowerCase() === sector.toLowerCase());
      return { ...data, total: results.length, results };
    },
    ...opts,
  });

export const usePortfolio = (profile: ProfileKey) =>
  useQuery({ queryKey: ["portfolio", profile], queryFn: () => get<ExamplePortfolio>(`/example-portfolios?profile=${profile}`), ...opts });

export const useLatestRun = () => useQuery({ queryKey: ["run"], queryFn: () => get<RunReport>("/runs/latest"), ...opts, retry: false });

export const useAiStatus = () => useQuery({ queryKey: ["ai-status"], queryFn: () => get<AiStatus>("/ai/status"), ...opts });

export const useSummary = (s: string, profile: ProfileKey, enabled: boolean) =>
  useQuery({
    queryKey: ["summary", s, profile],
    queryFn: () => get<Summary>(`/stocks/${sym(s)}/summary?profile=${profile}`),
    enabled,
    ...opts,
    retry: false,
  });

/** POST a chat turn and stream NDJSON events back. */
export async function streamChat(
  symbol: string,
  body: { profile: ProfileKey | null; messages: { role: "user" | "assistant"; content: string }[] },
  onEvent: (e: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api/stocks/${sym(symbol)}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, typeof detail === "string" ? detail : "Request failed");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as ChatEvent);
    }
  }
}
