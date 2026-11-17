/**
 * Small physics helpers for the drum (craft §5): damped springs described the way Apple
 * describes them (damping ratio + response), momentum projection, and rubber-banding.
 * Units are whatever the caller uses (here: bars of price history), per second.
 */

export interface SpringSpec {
  /** 1 = critically damped (no overshoot). Below 1 overshoots a little. */
  damping: number;
  /** Seconds for one undamped oscillation; roughly "how long it takes". */
  response: number;
}

export const SPRINGS = {
  /** The drum turning to a date you picked on the ruler: heavy and calm, never overshoots. */
  drum: { damping: 1, response: 0.55 },
  /** Settling onto a month line after a slow drag: no overshoot. */
  settle: { damping: 1, response: 0.35 },
  /** After a flick the drum carries momentum, so a small overshoot is allowed. */
  flick: { damping: 0.82, response: 0.45 },
} satisfies Record<string, SpringSpec>;

/** One semi-implicit Euler step of a unit-mass spring towards `target`. */
export function stepSpring(x: number, v: number, target: number, spec: SpringSpec, dt: number): [number, number] {
  const k = (2 * Math.PI / spec.response) ** 2;
  const c = (4 * Math.PI * spec.damping) / spec.response;
  const a = -k * (x - target) - c * v;
  const v2 = v + a * dt;
  return [x + v2 * dt, v2];
}

/** Where a flick is heading: current + v·r/(1−r)/1000 with UIScrollView's deceleration rate. */
export function project(x: number, vPerSecond: number, rate = 0.998): number {
  return x + ((vPerSecond / 1000) * rate) / (1 - rate);
}

/** Resistance past an edge: the further you pull, the less it moves. */
export function rubberBand(over: number, dim: number, c = 0.55): number {
  if (dim <= 0) return 0;
  return (over * dim * c) / (dim + c * Math.abs(over));
}

/** Index of the stop nearest to `x`. `stops` must be sorted ascending. */
export function nearestStop(stops: number[], x: number): number {
  let best = 0;
  for (let i = 1; i < stops.length; i++) if (Math.abs(stops[i] - x) < Math.abs(stops[best] - x)) best = i;
  return best;
}

/** Simulate a spring until it rests (tests and step budgeting). */
export function settleTime(from: number, to: number, v0: number, spec: SpringSpec, dt = 1 / 120): { t: number; peak: number } {
  let x = from;
  let v = v0;
  let t = 0;
  let peak = from;
  while (t < 5) {
    [x, v] = stepSpring(x, v, to, spec, dt);
    t += dt;
    if (to >= from ? x > peak : x < peak) peak = x;
    if (Math.abs(x - to) < 0.01 && Math.abs(v) < 0.05) break;
  }
  return { t, peak };
}
