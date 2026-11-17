import { describe, expect, it } from "vitest";
import type { ForecastPoint } from "../api/types";
import { lineShape } from "./lineShape";

const pts = (means: number[]): ForecastPoint[] =>
  means.map((mean, i) => ({ date: `2026-01-${String(i + 1).padStart(2, "0")}`, mean, lo_80: mean, hi_80: mean, lo_95: mean, hi_95: mean }));

describe("lineShape", () => {
  it("recognises a flat best guess", () => {
    expect(lineShape(pts([100, 100, 100]), 100)).toEqual({ kind: "flat", change: 0, startGap: 0 });
  });
  it("recognises a straight drift", () => {
    const s = lineShape(pts([101, 102, 103, 104]), 100)!;
    expect(s.kind).toBe("slope");
    expect(s.change).toBeCloseTo(0.04);
  });
  it("recognises a curve and a line that starts away from today's price", () => {
    const s = lineShape(pts([130, 120, 128, 125]), 100)!;
    expect(s.kind).toBe("curve");
    expect(s.startGap).toBeCloseTo(0.3);
  });
  it("returns null without data", () => {
    expect(lineShape([], 100)).toBeNull();
  });
});
