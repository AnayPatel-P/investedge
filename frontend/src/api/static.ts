import type { Ticker } from "./types";

/** Built for a static host (GitHub Pages): data comes from pre-exported JSON, no live API. */
export const STATIC = import.meta.env.VITE_STATIC === "1";

/** Map an API path (as the live client would call it) to its pre-exported JSON file.
 *  Returns null for endpoints that have no static form (search, AI). */
export function staticUrl(path: string, base = `${import.meta.env.BASE_URL}data`): string | null {
  const [route, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  const fixed: Record<string, string> = {
    "/tickers": "/tickers.json",
    "/profiles": "/profiles.json",
    "/runs/latest": "/runs/latest.json",
    "/ai/status": "/ai/status.json",
  };
  if (fixed[route]) return base + fixed[route];
  const stock = route.match(/^\/stocks\/([^/]+)\/(prices|forecasts|metrics|scorecard|backtest|patterns)$/);
  if (stock) return `${base}/stocks/${stock[1]}/${stock[2]}.json`;
  const profile = params.get("profile");
  if (route === "/screener" && profile) return `${base}/screener/${encodeURIComponent(profile)}.json`;
  if (route === "/example-portfolios" && profile) return `${base}/example-portfolios/${encodeURIComponent(profile)}.json`;
  return null;
}

/** Same ordering as the API's /search: exact ticker, then ticker prefix, then name match. */
export function searchTickers(all: Ticker[], q: string, limit = 8): Ticker[] {
  const needle = q.trim().toUpperCase();
  if (!needle) return [];
  const rank = (t: Ticker) => (t.symbol === needle ? 0 : t.symbol.startsWith(needle) ? 1 : 2);
  return all
    .filter((t) => t.symbol.startsWith(needle) || t.name.toUpperCase().includes(needle))
    .sort((a, b) => rank(a) - rank(b) || a.symbol.localeCompare(b.symbol))
    .slice(0, limit);
}
