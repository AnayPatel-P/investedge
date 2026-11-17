import type { ForecastPoint } from "../api/types";

/** Two-sided standard-normal quantiles for the confidence dial's detents. */
export const Z: Record<number, number> = { 50: 0.6744897501960817, 80: 1.2815515655446004, 95: 1.959963984540054 };

/** Log-space sigma at a step, recovered from the stored 80% band.
 *  Bands are (approximately) symmetric in log space because models fit log prices. */
export function sigmaAt(p: ForecastPoint): number {
  if (p.hi_80 <= 0 || p.lo_80 <= 0) return 0;
  return Math.max(0, (Math.log(p.hi_80) - Math.log(p.lo_80)) / (2 * Z[80]));
}

/** Center of the band in price space (geometric mid of the 80% band). */
export function centerAt(p: ForecastPoint): number {
  return Math.sqrt(p.hi_80 * p.lo_80) || p.mean;
}

export function bandAt(p: ForecastPoint, level: number): { lo: number; hi: number } {
  const c = centerAt(p);
  const s = sigmaAt(p);
  const z = Z[level] ?? Z[95];
  return { lo: c * Math.exp(-z * s), hi: c * Math.exp(z * s) };
}

/** Small, fast, seedable PRNG (mulberry32) so trails are stable across re-renders. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number) {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/**
 * Sample `n` possible-future price paths consistent with a forecast's bands.
 * Each path is a Brownian walk W_t rescaled to Z_t = W_t / sqrt(t) ~ N(0, 1), so at every step
 * the cloud of paths has exactly the model's stated spread, while each individual path wanders
 * smoothly like a real price instead of jumping around independently.
 */
export function samplePaths(points: ForecastPoint[], n: number, seed = 1): number[][] {
  const rand = rng(seed);
  const paths: number[][] = [];
  for (let k = 0; k < n; k++) {
    let w = 0;
    const path: number[] = [];
    for (let t = 0; t < points.length; t++) {
      w += gaussian(rand);
      const z = w / Math.sqrt(t + 1);
      path.push(centerAt(points[t]) * Math.exp(sigmaAt(points[t]) * z));
    }
    paths.push(path);
  }
  return paths;
}

/** Share of actual prices that fell inside the band at `level`. */
export function coverage(points: (ForecastPoint & { actual: number })[], level: number): number {
  if (!points.length) return NaN;
  const inside = points.filter((p) => {
    const b = bandAt(p, level);
    return p.actual >= b.lo && p.actual <= b.hi;
  }).length;
  return inside / points.length;
}

/** Was the *final* actual price inside the band at the final step? (the tally card's question) */
export function landedInside(points: (ForecastPoint & { actual: number })[], level: number): boolean {
  const last = points[points.length - 1];
  if (!last) return false;
  const b = bandAt(last, level);
  return last.actual >= b.lo && last.actual <= b.hi;
}

export const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** The possible futures the chart draws for a forecast. Shared so the outlook counts the same paths. */
export const FUTURES = 180;
export function futurePaths(points: ForecastPoint[]): number[][] {
  return points.length ? samplePaths(points, FUTURES, points.length * 31 + Math.round(points[0].mean)) : [];
}
