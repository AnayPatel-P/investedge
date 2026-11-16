const isNum = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export const price = (v: number | null | undefined) =>
  isNum(v) ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

export const pct = (v: number | null | undefined, digits = 1) => (isNum(v) ? `${(v * 100).toFixed(digits)}%` : "—");

/** Signed percent with a direction glyph, so direction never depends on color alone. */
export const signedPct = (v: number | null | undefined, digits = 1) => {
  if (!isNum(v)) return { text: "—", dir: "flat" as const };
  const dir = v > 0 ? ("up" as const) : v < 0 ? ("down" as const) : ("flat" as const);
  const glyph = dir === "up" ? "▲" : dir === "down" ? "▼" : "■";
  return { text: `${glyph} ${Math.abs(v * 100).toFixed(digits)}%`, dir };
};

export const num = (v: number | null | undefined, digits = 2) => (isNum(v) ? v.toFixed(digits) : "—");

export const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const MODEL_LABEL: Record<string, string> = {
  naive: "Naive guess",
  arima: "ARIMA",
  ets: "ETS",
  prophet: "Prophet",
  garch: "GARCH",
};

export const MODEL_BLURB: Record<string, string> = {
  naive: "Assumes tomorrow's price equals today's. The yardstick every model has to beat.",
  arima: "Looks for patterns in recent price changes and how past surprises echo forward.",
  ets: "Smooths the price history, weighting recent days more, to estimate the trend.",
  prophet: "Fits a long-term trend plus repeating weekly and yearly patterns.",
  garch: "Doesn't guess direction. It forecasts how much the price is likely to swing.",
};
