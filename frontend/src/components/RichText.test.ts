import { describe, expect, it } from "vitest";
import { parseBlocks } from "./RichText";

describe("parseBlocks", () => {
  it("splits paragraphs and lists like the tutor writes them", () => {
    const text =
      "**In short: not very reliable.**\n\nInvestEdge tested each model:\n- **ARIMA** tied the guess.\n- **Prophet** did worse.\n\nPast results don't predict the future.";
    expect(parseBlocks(text)).toEqual([
      { kind: "p", lines: ["**In short: not very reliable.**"] },
      { kind: "p", lines: ["InvestEdge tested each model:"] },
      { kind: "ul", items: ["**ARIMA** tied the guess.", "**Prophet** did worse."] },
      { kind: "p", lines: ["Past results don't predict the future."] },
    ]);
  });

  it("handles numbered lists and plain text", () => {
    expect(parseBlocks("1. One\n2. Two")).toEqual([{ kind: "ol", items: ["One", "Two"] }]);
    expect(parseBlocks("Just one line.")).toEqual([{ kind: "p", lines: ["Just one line."] }]);
  });

  it("keeps a half-streamed message renderable", () => {
    expect(parseBlocks("- **Volatil")).toEqual([{ kind: "ul", items: ["**Volatil"] }]);
  });
});
