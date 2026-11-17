import { describe, expect, it } from "vitest";
import type { ForecastPoint } from "../api/types";
import { chanceWords, outlook } from "./outlook";
import { futurePaths } from "./trails";

const flat = (n: number, price = 100, drift = 0): ForecastPoint[] =>
  Array.from({ length: n }, (_, i) => {
    const c = price * Math.exp(drift * (i + 1));
    const s = 0.01 * Math.sqrt(i + 1);
    return {
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      mean: c,
      lo_80: c * Math.exp(-1.2816 * s),
      hi_80: c * Math.exp(1.2816 * s),
      lo_95: c * Math.exp(-1.96 * s),
      hi_95: c * Math.exp(1.96 * s),
    };
  });

describe("outlook", () => {
  it("a flat forecast is about a coin flip at every horizon", () => {
    const pts = flat(30);
    const tiles = outlook(pts, futurePaths(pts), 100, 80);
    expect(tiles.map((t) => t.label)).toEqual(["In 1 week", "In 2 weeks", "In 6 weeks"]);
    for (const t of tiles) {
      expect(t.total).toBe(180);
      expect(t.chance).toBeGreaterThan(0.38);
      expect(t.chance).toBeLessThan(0.62);
      expect(t.lo).toBeLessThan(100);
      expect(t.hi).toBeGreaterThan(100);
    }
  });

  it("an upward drift leans higher, more so further out", () => {
    const pts = flat(30, 100, 0.004);
    const tiles = outlook(pts, futurePaths(pts), 100, 80);
    expect(tiles[2].chance).toBeGreaterThan(0.75);
    expect(tiles[2].chance).toBeGreaterThan(tiles[0].chance);
  });

  it("short forecasts don't repeat a tile, and pick up reality on replays", () => {
    const pts = flat(8);
    const tiles = outlook(pts, futurePaths(pts), 100, 95, [{ date: "2026-01-05", close: 104 }]);
    expect(tiles).toHaveLength(2);
    expect(tiles[0].actual).toBe(104);
    expect(tiles[1].label).toBe("In 8 trading days");
  });

  it("puts the chance into words", () => {
    expect(chanceWords(0.5)).toBe("A coin flip");
    expect(chanceWords(0.8)).toBe("Leans higher");
    expect(chanceWords(0.2)).toBe("Leans lower");
    expect(chanceWords(0.6)).toBe("Slightly more often higher");
  });
});
