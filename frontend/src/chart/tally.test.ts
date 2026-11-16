import { describe, expect, it } from "vitest";
import type { Backtest, BacktestPoint } from "../api/types";
import { tallyAll, tallyRun } from "./tally";
import { Z } from "./trails";

const pt = (mean: number, actual: number, sigma = 0.05): BacktestPoint => ({
  step: 1,
  date: "2026-02-01",
  mean,
  actual,
  lo_80: mean * Math.exp(-Z[80] * sigma),
  hi_80: mean * Math.exp(Z[80] * sigma),
  lo_95: mean * Math.exp(-Z[95] * sigma),
  hi_95: mean * Math.exp(Z[95] * sigma),
});

describe("tally", () => {
  it("scores a replay against reality and the naive guess", () => {
    const t = tallyRun("2026-01-01", { arima: [pt(105, 104)], naive: [pt(100, 104)] }, "arima", 95)!;
    expect(t.inside).toBe(true);
    expect(t.modelMiss).toBeCloseTo(1);
    expect(t.naiveMiss).toBeCloseTo(4);
    expect(t.beatNaive).toBe(true);
  });

  it("flags reality landing outside the range", () => {
    const t = tallyRun("2026-01-01", { arima: [pt(100, 130)], naive: [pt(100, 130)] }, "arima", 95)!;
    expect(t.inside).toBe(false);
    expect(t.beatNaive).toBe(false);
  });

  it("aggregates across replays", () => {
    const bt: Backtest = {
      symbol: "X",
      origins: ["a", "b"],
      runs: {
        a: { arima: [pt(105, 104)], naive: [pt(100, 104)] },
        b: { arima: [pt(100, 130)], naive: [pt(100, 130)] },
      },
    };
    expect(tallyAll(bt, "arima", 95)).toEqual({ n: 2, inside: 1, beat: 1 });
  });
});
