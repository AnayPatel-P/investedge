import { describe, expect, it } from "vitest";
import { SPRINGS, nearestStop, project, rubberBand, settleTime } from "./spring";

describe("springs", () => {
  it("critically damped springs never overshoot", () => {
    for (const spec of [SPRINGS.drum, SPRINGS.settle]) {
      const { peak } = settleTime(0, 100, 0, spec);
      expect(peak).toBeLessThanOrEqual(100.01);
    }
  });

  it("the flick spring overshoots a little when thrown, and still settles", () => {
    const { peak, t } = settleTime(0, 100, 400, SPRINGS.flick);
    expect(peak).toBeGreaterThan(100);
    expect(peak).toBeLessThan(115);
    expect(t).toBeLessThan(2);
  });

  it("a long turn rests in well under two seconds", () => {
    expect(settleTime(0, 250, 0, SPRINGS.drum).t).toBeLessThan(1.5);
  });
});

describe("momentum", () => {
  it("projects a flick forward in the direction of travel", () => {
    expect(project(10, 0)).toBe(10);
    expect(project(10, 100)).toBeCloseTo(10 + 49.9, 1);
    expect(project(10, -100)).toBeCloseTo(10 - 49.9, 1);
  });

  it("rubber-bands: resistance grows the further you pull", () => {
    const a = rubberBand(50, 500);
    const b = rubberBand(500, 500);
    expect(a).toBeLessThan(50);
    expect(b).toBeLessThan(500 * 0.55);
    expect(b / 500).toBeLessThan(a / 50);
    expect(rubberBand(-50, 500)).toBeCloseTo(-a);
  });

  it("snaps to the nearest stop", () => {
    expect(nearestStop([0, 21, 42, 63], 30)).toBe(1);
    expect(nearestStop([0, 21, 42, 63], 33)).toBe(2);
    expect(nearestStop([0, 21, 42, 63], 999)).toBe(3);
  });
});
