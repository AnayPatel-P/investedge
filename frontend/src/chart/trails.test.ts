import { describe, expect, it } from "vitest";
import type { ForecastPoint } from "../api/types";
import { Z, bandAt, coverage, landedInside, samplePaths, sigmaAt } from "./trails";

const point = (mean: number, sigma: number, date = "2026-01-02"): ForecastPoint => ({
  date,
  mean,
  lo_80: mean * Math.exp(-Z[80] * sigma),
  hi_80: mean * Math.exp(Z[80] * sigma),
  lo_95: mean * Math.exp(-Z[95] * sigma),
  hi_95: mean * Math.exp(Z[95] * sigma),
});

describe("trails", () => {
  it("recovers sigma from the 80% band", () => {
    expect(sigmaAt(point(100, 0.05))).toBeCloseTo(0.05, 10);
  });

  it("reconstructs the stored 95% band from the 80% band", () => {
    const p = point(100, 0.08);
    const b = bandAt(p, 95);
    expect(b.lo).toBeCloseTo(p.lo_95, 8);
    expect(b.hi).toBeCloseTo(p.hi_95, 8);
  });

  it("50% band is narrower than 80% which is narrower than 95%", () => {
    const p = point(100, 0.1);
    const w = (l: number) => bandAt(p, l).hi - bandAt(p, l).lo;
    expect(w(50)).toBeLessThan(w(80));
    expect(w(80)).toBeLessThan(w(95));
  });

  it("sampled paths match the model's stated spread at the last step", () => {
    const pts = Array.from({ length: 30 }, (_, t) => point(100, 0.02 * Math.sqrt(t + 1)));
    const paths = samplePaths(pts, 4000, 42);
    const last = pts[pts.length - 1];
    const inside95 = paths.filter((p) => p[29] >= last.lo_95 && p[29] <= last.hi_95).length / paths.length;
    const inside80 = paths.filter((p) => p[29] >= last.lo_80 && p[29] <= last.hi_80).length / paths.length;
    expect(inside95).toBeGreaterThan(0.93);
    expect(inside95).toBeLessThan(0.97);
    expect(inside80).toBeGreaterThan(0.77);
    expect(inside80).toBeLessThan(0.83);
  });

  it("is deterministic for a seed", () => {
    const pts = [point(10, 0.05), point(10, 0.07)];
    expect(samplePaths(pts, 3, 7)).toEqual(samplePaths(pts, 3, 7));
  });

  it("scores coverage and the final landing", () => {
    const pts = [
      { ...point(100, 0.05), actual: 100 },
      { ...point(100, 0.05), actual: 200 },
    ];
    expect(coverage(pts, 95)).toBe(0.5);
    expect(landedInside(pts, 95)).toBe(false);
  });
});
