import type { ForecastPoint } from "../api/types";

export interface LineShape {
  kind: "flat" | "slope" | "curve";
  /** Last forecast point vs. today's close (0.04 = ends 4% higher). */
  change: number;
  /** First forecast point vs. today's close: how far the line starts from today's price. */
  startGap: number;
}

/** Describe a forecast's best-guess line so it can be explained in words. */
export function lineShape(points: ForecastPoint[], lastClose: number): LineShape | null {
  if (!points.length || !(lastClose > 0)) return null;
  const first = points[0].mean;
  const last = points[points.length - 1].mean;
  const n = points.length - 1;
  // Largest gap between the line and a straight line from its first to its last point.
  let bend = 0;
  points.forEach((p, i) => {
    const straight = n ? first + ((last - first) * i) / n : first;
    bend = Math.max(bend, Math.abs(p.mean - straight) / lastClose);
  });
  const change = last / lastClose - 1;
  const startGap = first / lastClose - 1;
  const kind = bend > 0.003 ? "curve" : Math.abs(last - first) / lastClose < 0.001 ? "flat" : "slope";
  return { kind, change, startGap };
}
