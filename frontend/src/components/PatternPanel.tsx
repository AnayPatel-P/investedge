import { useEffect, useRef } from "react";
import type { Patterns, PatternInfo } from "../api/types";
import { pct, shortDate } from "../format";
import { Term } from "./Term";
import "./PatternPanel.css";

/** Candle glyphs: [open, high, low, close] in a 0-10 box (10 = top). */
const GLYPHS: Record<string, [number, number, number, number][]> = {
  doji: [[5, 8.5, 1.5, 5.1]],
  hammer: [
    [8.2, 9.2, 7.6, 7.8],
    [7.0, 7.6, 6.6, 6.8],
    [7.4, 7.9, 1.5, 7.8],
  ],
  shooting_star: [
    [2.2, 2.6, 1.8, 2.4],
    [3.0, 3.4, 2.8, 3.2],
    [3.4, 9.0, 3.1, 3.2],
  ],
  bullish_engulfing: [
    [6.5, 6.9, 4.6, 4.9],
    [4.5, 7.6, 4.2, 7.2],
  ],
  bearish_engulfing: [
    [4.6, 6.6, 4.3, 6.3],
    [6.8, 7.1, 3.4, 3.8],
  ],
  bullish_marubozu: [[2, 8.1, 1.9, 8]],
  bearish_marubozu: [[8, 8.1, 1.9, 2]],
};

function Glyph({ k }: { k: string }) {
  const cs = GLYPHS[k] ?? [];
  const w = 14;
  const gap = 6;
  const width = cs.length * w + (cs.length - 1) * gap + 8;
  const y = (v: number) => 4 + (10 - v) * 5.2;
  return (
    <svg className="glyph" viewBox={`0 0 ${width} 60`} width={width} height={60} aria-hidden="true">
      {cs.map(([o, h, l, c], i) => {
        const x = 4 + i * (w + gap);
        const upC = c >= o;
        const top = y(Math.max(o, c));
        const bh = Math.max(1.5, Math.abs(y(o) - y(c)));
        const last = i === cs.length - 1;
        return (
          <g key={i} className={`${upC ? "g-up" : "g-down"}${last ? " g-focus" : ""}`}>
            <line x1={x + w / 2} x2={x + w / 2} y1={y(h)} y2={y(l)} />
            <rect x={x} y={top} width={w} height={bh} />
          </g>
        );
      })}
    </svg>
  );
}

function Track({ info, days }: { info: PatternInfo; days: number }) {
  if (info.higher_after === null || info.count === 0)
    return <p className="muted pc-track-none">No complete examples on this stock yet.</p>;
  return (
    <div className="pc-track" role="img" aria-label={`Higher ${days} days later ${pct(info.higher_after, 0)} after this pattern versus ${pct(info.base_rate, 0)} on any day`}>
      <div className="pc-bar">
        <span className="pc-bar-label">After this pattern</span>
        <span className="pc-bar-track">
          <span className="pc-bar-fill" style={{ width: `${info.higher_after * 100}%` }} />
        </span>
        <span className="mono">{pct(info.higher_after, 0)}</span>
      </div>
      <div className="pc-bar base">
        <span className="pc-bar-label">Any day</span>
        <span className="pc-bar-track">
          <span className="pc-bar-fill" style={{ width: `${info.base_rate * 100}%` }} />
        </span>
        <span className="mono">{pct(info.base_rate, 0)}</span>
      </div>
      <p className="pc-n muted mono">
        share of times the price was higher {days} days later · {info.count} examples in 5 years
      </p>
    </div>
  );
}

export function PatternPanel({ data, selected, symbol }: { data: Patterns; selected: string | null; symbol: string }) {
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const recentByKey = new Map<string, string[]>();
  for (const o of data.occurrences) recentByKey.set(o.pattern, [...(recentByKey.get(o.pattern) ?? []), o.date]);
  const selectedKey = selected ? data.occurrences.find((o) => o.date === selected)?.pattern ?? null : null;

  useEffect(() => {
    if (selectedKey) refs.current[selectedKey]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedKey, selected]);

  return (
    <section className="patterns" aria-labelledby="patterns-title">
      <header>
        <p className="kicker">Candlestick patterns</p>
        <h2 id="patterns-title">Do the famous shapes mean anything for {symbol}?</h2>
        <p className="patterns-lede muted">
          Traders give names to certain <Term k="candlestick">candle</Term> shapes and expect the price to move a certain way afterwards. Below, each shape is
          checked against {symbol}'s own five-year history. Click a marker on the chart to jump to its card.
        </p>
      </header>
      <div className="pattern-grid">
        {data.library.map((p) => {
          const dates = recentByKey.get(p.key) ?? [];
          return (
            <article
              key={p.key}
              ref={(el) => {
                refs.current[p.key] = el;
              }}
              className={`pattern-card${selectedKey === p.key ? " selected" : ""}`}
              aria-current={selectedKey === p.key ? "true" : undefined}
            >
              <div className="pc-head">
                <Glyph k={p.key} />
                <div>
                  <h3>{p.name}</h3>
                  <p className={`pc-bias mono ${p.bias === "bullish" ? "up" : p.bias === "bearish" ? "down" : "muted"}`}>
                    {p.bias === "bullish" ? "▲ traders expect a rise" : p.bias === "bearish" ? "▼ traders expect a fall" : "■ traders read it as indecision"}
                  </p>
                </div>
              </div>
              <p className="pc-shape">{p.shape}</p>
              <Track info={p} days={data.forward_days} />
              <p className="pc-verdict">{p.verdict}</p>
              {selectedKey === p.key && selected && <p className="pc-selected mono">Marker you clicked: {shortDate(selected)}</p>}
              {dates.length > 0 && selectedKey !== p.key && (
                <p className="pc-recent muted mono">Most recent: {shortDate(dates[dates.length - 1])}</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
