import type { Backtest, BacktestPoint, ModelKey } from "../api/types";
import { bandAt } from "./trails";

export interface Tally {
  model: ModelKey;
  origin: string;
  endDate: string;
  predicted: number;
  lo: number;
  hi: number;
  actual: number;
  inside: boolean;
  modelMiss: number;
  naiveMiss: number;
  beatNaive: boolean;
}

/** One replay: where the model said the price would be after the horizon, vs. reality. */
export function tallyRun(
  origin: string,
  run: Partial<Record<ModelKey, BacktestPoint[]>>,
  model: ModelKey,
  level: number,
): Tally | null {
  const pts = run[model];
  const naive = run.naive;
  if (!pts?.length || !naive?.length) return null;
  const last = pts[pts.length - 1];
  const band = bandAt(last, level);
  const modelMiss = Math.abs(last.mean - last.actual);
  const naiveMiss = Math.abs(naive[naive.length - 1].mean - last.actual);
  return {
    model,
    origin,
    endDate: last.date,
    predicted: last.mean,
    lo: band.lo,
    hi: band.hi,
    actual: last.actual,
    inside: last.actual >= band.lo && last.actual <= band.hi,
    modelMiss,
    naiveMiss,
    // GARCH and naive have the same centre line, so "beating" needs a real margin.
    beatNaive: modelMiss < naiveMiss * 0.99,
  };
}

/** Across every replay: how often reality landed inside the range, and how often the model beat naive. */
export function tallyAll(bt: Backtest, model: ModelKey, level: number) {
  const runs = bt.origins.map((o) => tallyRun(o, bt.runs[o], model, level)).filter((t): t is Tally => t !== null);
  return {
    n: runs.length,
    inside: runs.filter((t) => t.inside).length,
    beat: runs.filter((t) => t.beatNaive).length,
  };
}
