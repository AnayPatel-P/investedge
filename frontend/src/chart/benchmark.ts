import type { BenchmarkPoint, PriceBar } from "../api/types";

export interface Comparison {
  /** Date both returns are measured from (the first bar of the chosen time range). */
  start: string;
  end: string;
  stock: number;
  market: number;
  /** stock − market, in fraction points (0.043 = 4.3 points ahead). */
  diff: number;
}

/** Last benchmark close on or before `date` (markets share a calendar, but don't assume it). */
function closeOnOrBefore(bench: BenchmarkPoint[], date: string): number | null {
  let lo = 0;
  let hi = bench.length - 1;
  let found: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bench[mid].date <= date) {
      found = bench[mid].close;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** The S&P 500 line, scaled so it starts at the stock's price on bars[startIndex]: it shows what the
 *  same money would have done in the market. Limited to the stock's own date span. */
export function rebaseBenchmark(bars: PriceBar[], bench: BenchmarkPoint[], startIndex: number): { date: string; value: number }[] {
  if (!bars.length || !bench.length) return [];
  const i = Math.min(Math.max(0, startIndex), bars.length - 1);
  const anchor = closeOnOrBefore(bench, bars[i].date);
  if (!anchor) return [];
  const k = bars[i].close / anchor;
  const first = bars[0].date;
  const last = bars[bars.length - 1].date;
  return bench.filter((p) => p.date >= first && p.date <= last).map((p) => ({ date: p.date, value: p.close * k }));
}

/** Price change of the stock and of the S&P 500 from bars[startIndex] to the last bar. */
export function compareToBenchmark(bars: PriceBar[], bench: BenchmarkPoint[], startIndex: number): Comparison | null {
  if (bars.length < 2 || !bench.length) return null;
  const i = Math.min(Math.max(0, startIndex), bars.length - 2);
  const a = bars[i];
  const b = bars[bars.length - 1];
  const m0 = closeOnOrBefore(bench, a.date);
  const m1 = closeOnOrBefore(bench, b.date);
  if (!m0 || !m1) return null;
  const stock = b.close / a.close - 1;
  const market = m1 / m0 - 1;
  return { start: a.date, end: b.date, stock, market, diff: stock - market };
}
