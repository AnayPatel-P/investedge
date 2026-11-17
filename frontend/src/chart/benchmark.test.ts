import { describe, expect, it } from "vitest";
import type { PriceBar } from "../api/types";
import { compareToBenchmark, rebaseBenchmark } from "./benchmark";

const bar = (date: string, close: number): PriceBar => ({ date, open: close, high: close, low: close, close, volume: 1 });
const bars = [bar("2026-01-02", 100), bar("2026-01-05", 110), bar("2026-01-06", 120)];
const bench = [
  { date: "2025-12-31", close: 490 },
  { date: "2026-01-02", close: 500 },
  { date: "2026-01-05", close: 505 },
  { date: "2026-01-06", close: 525 },
  { date: "2026-01-07", close: 530 },
];

describe("rebaseBenchmark", () => {
  it("starts the market line at the stock's price on the start bar, within the stock's dates", () => {
    const line = rebaseBenchmark(bars, bench, 0);
    expect(line.map((p) => p.date)).toEqual(["2026-01-02", "2026-01-05", "2026-01-06"]);
    expect(line[0].value).toBeCloseTo(100);
    expect(line[2].value).toBeCloseTo(105);
  });

  it("anchors on a later start bar", () => {
    const line = rebaseBenchmark(bars, bench, 1);
    expect(line[1].value).toBeCloseTo(110);
  });

  it("falls back to the last market close before a date the market didn't trade", () => {
    const gap = [{ date: "2026-01-01", close: 400 }, { date: "2026-01-06", close: 440 }];
    expect(rebaseBenchmark(bars, gap, 0)[0].value).toBeCloseTo(110); // 440 * (100/400)
  });
});

describe("compareToBenchmark", () => {
  it("measures both from the start bar to the last bar", () => {
    const c = compareToBenchmark(bars, bench, 0)!;
    expect(c.stock).toBeCloseTo(0.2);
    expect(c.market).toBeCloseTo(0.05);
    expect(c.diff).toBeCloseTo(0.15);
    expect([c.start, c.end]).toEqual(["2026-01-02", "2026-01-06"]);
  });

  it("clamps a start before the data, and handles missing data", () => {
    expect(compareToBenchmark(bars, bench, -50)!.start).toBe("2026-01-02");
    expect(compareToBenchmark(bars, [], 0)).toBeNull();
    expect(compareToBenchmark([bars[0]], bench, 0)).toBeNull();
  });
});
