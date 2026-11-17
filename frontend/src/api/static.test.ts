import { describe, expect, it } from "vitest";
import { searchTickers, staticUrl } from "./static";

const B = "/investedge/data";

describe("staticUrl", () => {
  it("maps every read-only endpoint to its exported file", () => {
    expect(staticUrl("/tickers", B)).toBe(`${B}/tickers.json`);
    expect(staticUrl("/profiles", B)).toBe(`${B}/profiles.json`);
    expect(staticUrl("/benchmark", B)).toBe(`${B}/benchmark.json`);
    expect(staticUrl("/ai/status", B)).toBe(`${B}/ai/status.json`);
    expect(staticUrl("/stocks/BRK.B/prices", B)).toBe(`${B}/stocks/BRK.B/prices.json`);
    expect(staticUrl("/stocks/AAPL/patterns?days=1300", B)).toBe(`${B}/stocks/AAPL/patterns.json`);
    expect(staticUrl("/screener?profile=moderate&limit=503&sector=Energy", B)).toBe(`${B}/screener/moderate.json`);
    expect(staticUrl("/example-portfolios?profile=aggressive", B)).toBe(`${B}/example-portfolios/aggressive.json`);
  });

  it("has no static form for search or the AI tutor", () => {
    expect(staticUrl("/search?q=ko", B)).toBeNull();
    expect(staticUrl("/stocks/AAPL/summary?profile=moderate", B)).toBeNull();
  });
});

describe("searchTickers", () => {
  const all = [
    { symbol: "MSFT", name: "Microsoft", sector: "IT" },
    { symbol: "MS", name: "Morgan Stanley", sector: "Financials" },
    { symbol: "MSCI", name: "MSCI Inc.", sector: "Financials" },
    { symbol: "KO", name: "Coca-Cola Company (The)", sector: "Staples" },
  ];
  it("ranks exact, then prefix, then name matches like the API", () => {
    expect(searchTickers(all, "ms").map((t) => t.symbol)).toEqual(["MS", "MSCI", "MSFT"]);
    expect(searchTickers(all, "coca").map((t) => t.symbol)).toEqual(["KO"]);
    expect(searchTickers(all, "  ")).toEqual([]);
  });
});
