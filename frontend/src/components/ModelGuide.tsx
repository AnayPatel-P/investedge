import { useRef, useState, type KeyboardEvent } from "react";
import type { Forecasts, ModelKey, Scorecard } from "../api/types";
import { lineShape, type LineShape } from "../chart/lineShape";
import { MODEL_LABEL, pct, price } from "../format";
import { MODEL_GUIDE } from "./modelGuideContent";
import "./ModelGuide.css";

const ORDER: ModelKey[] = ["naive", "arima", "ets", "prophet", "garch"];

/** One sentence on what this model's line looks like right now, for this stock. */
export function describeLine(model: ModelKey, s: LineShape, lastClose: number): string {
  const label = MODEL_LABEL[model];
  if (model === "naive") return `A flat line at today's ${price(lastClose)}, as always.`;
  if (model === "garch") return `A flat line at ${price(lastClose)}: GARCH never guesses direction, only how wide the swings will be.`;
  const dir = s.change >= 0 ? "higher" : "lower";
  const end = `ends ${pct(Math.abs(s.change))} ${dir}`;
  if (s.kind === "flat") return `A flat line: ${label} found no trend worth following, so its best guess is about today's price.`;
  if (s.kind === "slope") return `A straight slope that ${end}: ${label} found a steady drift and extends it.`;
  const gap = Math.abs(s.startGap) >= 0.02 ? ` It starts ${pct(Math.abs(s.startGap))} ${s.startGap > 0 ? "above" : "below"} today's price because it follows its smoothed trend, not the latest close.` : "";
  return `A curve that ${end}, shaped by the trend and seasonal patterns ${label} fitted.${gap}`;
}

interface Props {
  sym: string;
  lastClose: number;
  forecasts: Forecasts;
  scorecard?: Scorecard;
  focus: ModelKey;
  onShow: (m: ModelKey) => void;
  defaultOpen: boolean;
}

/** "Meet the models": what each forecasting model is, how it differs, and how it did on this stock. */
export function ModelGuide({ sym, lastClose, forecasts, scorecard, focus, onShow, defaultOpen }: Props) {
  const rows = new Map(scorecard?.models.map((r) => [r.model, r]) ?? []);
  const [tab, setTab] = useState<ModelKey>(focus);
  const tabRefs = useRef<Partial<Record<ModelKey, HTMLButtonElement | null>>>({});
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = ORDER[(ORDER.indexOf(tab) + d + ORDER.length) % ORDER.length];
    setTab(next);
    tabRefs.current[next]?.focus();
  };
  const m = tab;
  const g = MODEL_GUIDE[m];
  const pts = forecasts[m] ?? [];
  const shape = lineShape(pts, lastClose);
  const row = rows.get(m);
  return (
    <details className="model-guide" id="model-guide" open={defaultOpen}>
      <summary>
        <span className="kicker">Meet the models</span>
        <span className="mg-summary">What each line means, and how the five models differ</span>
      </summary>
      <p className="mg-lede">
        Each model is a different way of guessing the future from past prices. None of them knows anything about the company, the news
        or the economy. Only Prophet draws curves; the others usually draw a flat line because they found nothing reliable to follow.
        That's an honest answer, not a bug. The <strong>shaded range</strong> around each line matters more than the line itself.
      </p>
      <div className="mg-tabs" role="tablist" aria-label="Forecasting models" onKeyDown={onKey}>
        {ORDER.map((k) => (
          <button
            key={k}
            ref={(el) => {
              tabRefs.current[k] = el;
            }}
            type="button"
            role="tab"
            id={`mg-tab-${k}`}
            aria-selected={tab === k}
            aria-controls="mg-panel"
            tabIndex={tab === k ? 0 : -1}
            className="mg-tab"
            onClick={() => setTab(k)}
          >
            <span className="mg-tab-name">{MODEL_LABEL[k]}</span>
            <span className="mg-tab-nick">{MODEL_GUIDE[k].nickname}</span>
            {focus === k && <span className="mg-tab-drawn">on the chart</span>}
          </button>
        ))}
      </div>
      <article className="mg-panel" id="mg-panel" role="tabpanel" aria-labelledby={`mg-tab-${m}`}>
        <div className="mg-main">
          <p className="mg-analogy">{g.analogy}</p>
          <dl className="mg-facts">
            <div>
              <dt>How it works</dt>
              <dd>{g.how}</dd>
            </div>
            <div>
              <dt>Its line on the chart</dt>
              <dd>{g.line}</dd>
            </div>
            <div>
              <dt>Good at</dt>
              <dd>{g.good}</dd>
            </div>
            <div>
              <dt>Watch out</dt>
              <dd>{g.watch}</dd>
            </div>
          </dl>
        </div>
        <aside className="mg-live">
          <p className="kicker">On {sym} right now</p>
          <p>{shape ? describeLine(m, shape, lastClose) : "No forecast for this stock."}</p>
          {row && (
            <p className="muted">
              Past year: {m === "naive" || m === "garch" ? "its" : `${row.beats_baseline ? "beat" : "did not beat"} the naive guess; its`} 95%
              range caught the real price {pct(row.coverage_95, 0)} of the time.
            </p>
          )}
          {pts.length > 0 && (
            <button type="button" className="btn mg-show" aria-pressed={focus === m} onClick={() => onShow(m)}>
              {focus === m ? "Drawn on the chart" : "Draw its futures on the chart"}
            </button>
          )}
        </aside>
      </article>
    </details>
  );
}
