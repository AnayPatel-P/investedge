import type { Metrics } from "../api/types";
import { num, pct, signedPct } from "../format";
import type { GlossaryKey } from "../glossary";
import { Term } from "./Term";
import "./MetricsLedger.css";

/** Almanac-style ledger: number, then what it means, in plain English. */
export function MetricsLedger({ m, compact = false }: { m: Metrics; compact?: boolean }) {
  const r1y = signedPct(m.return_1y);
  const beta = m.beta_1y;
  const betaLine =
    beta === null
      ? "Not enough history."
      : beta < 0
        ? `Over the past year it tended to move slightly against the market — when the S&P 500 rose, it often dipped. Unusual, and it can change.`
        : beta < 0.8
          ? `Moved less than the market: a 10% market swing came with roughly a ${Math.abs(beta * 10).toFixed(0)}% swing here.`
          : beta <= 1.2
            ? "Moved roughly in step with the market."
            : `Amplified the market: a 10% market swing came with roughly a ${(beta * 10).toFixed(0)}% swing here.`;

  const items: { label: string; term: GlossaryKey; value: string; cls?: string; note: string }[] = [
    { label: "Past year", term: "return1y", value: r1y.text, cls: r1y.dir, note: "How much the price changed over the last 12 months. Past moves don't predict future ones." },
    {
      label: "Typical yearly swing",
      term: "volatility",
      value: pct(m.volatility_1y, 0),
      note: "Volatility: how far the price usually wanders in a year, up or down. Bigger = bumpier ride.",
    },
    { label: "Beta vs. S&P 500", term: "beta", value: num(beta), note: betaLine },
    {
      label: "Worst drop, 1 year",
      term: "drawdown",
      value: pct(m.max_drawdown_1y, 0),
      cls: "down",
      note: "The biggest fall from a high point to a later low in the past year — what holding it at the worst moment felt like.",
    },
    { label: "Worst drop, 5 years", term: "drawdown", value: pct(m.max_drawdown_5y, 0), cls: "down", note: "The same, over five years." },
    {
      label: "Dividend yield",
      term: "dividendYield",
      value: pct(m.dividend_yield, 2),
      note:
        (m.dividend_yield ?? 0) > 0
          ? "Cash paid to shareholders over the last 12 months, as a share of today's price."
          : "This company paid no dividends in the last 12 months.",
    },
  ];
  return (
    <dl className={`ledger-metrics${compact ? " compact" : ""}`}>
      {items.map((it) => (
        <div key={it.label} className="lm-row">
          <dt className="kicker">
            <Term k={it.term}>{it.label}</Term>
          </dt>
          <dd className={`lm-value mono ${it.cls ?? ""}`}>{it.value}</dd>
          {!compact && <dd className="lm-note">{it.note}</dd>}
        </div>
      ))}
    </dl>
  );
}
