import type { ForecastPoint } from "../api/types";
import { bandAt } from "./trails";

export interface OutlookTile {
  /** "In 1 week" … */
  label: string;
  date: string;
  /** How many of the sampled futures end above the starting price. */
  higher: number;
  total: number;
  /** higher / total */
  chance: number;
  lo: number;
  hi: number;
  /** What really happened at that step (replays only). */
  actual?: number;
}

const HORIZONS = [
  { steps: 5, label: "In 1 week" },
  { steps: 10, label: "In 2 weeks" },
  { steps: 30, label: "In 6 weeks" },
];

/**
 * Plain-language outlook, counted from the same possible futures the chart draws:
 * "higher in 97 of 180 futures", plus the stated range at `level`.
 */
export function outlook(
  points: ForecastPoint[],
  paths: number[][],
  start: number,
  level: number,
  reality?: { date: string; close: number }[],
): OutlookTile[] {
  if (!points.length || !paths.length) return [];
  const seen = new Set<number>();
  const tiles: OutlookTile[] = [];
  for (const h of HORIZONS) {
    const i = Math.min(points.length, h.steps) - 1;
    if (seen.has(i)) continue;
    seen.add(i);
    const higher = paths.filter((p) => p[i] > start).length;
    const band = bandAt(points[i], level);
    const label = i === points.length - 1 && h.steps !== points.length ? `In ${points.length} trading days` : h.label;
    tiles.push({
      label,
      date: points[i].date,
      higher,
      total: paths.length,
      chance: higher / paths.length,
      lo: band.lo,
      hi: band.hi,
      actual: reality?.find((r) => r.date === points[i].date)?.close,
    });
  }
  return tiles;
}

/** "About even", "Leans higher" … : the chance in words, so 52% is never read as a prediction. */
export function chanceWords(chance: number): string {
  if (chance >= 0.65) return "Leans higher";
  if (chance <= 0.35) return "Leans lower";
  if (chance >= 0.45 && chance <= 0.55) return "A coin flip";
  return chance > 0.5 ? "Slightly more often higher" : "Slightly more often lower";
}
