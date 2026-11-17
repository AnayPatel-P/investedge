import type { Scorecard } from "../api/types";
import { MODEL_BLURB, MODEL_LABEL, pct } from "../format";
import type { GlossaryKey } from "../glossary";
import { Term } from "./Term";
import "./ScorecardPanel.css";

const ORDER = ["naive", "arima", "ets", "prophet", "garch"];

/** "How much should you trust these forecasts?" — the honesty panel. */
export function ScorecardPanel({ card, compact = false }: { card: Scorecard; compact?: boolean }) {
  const rows = [...card.models].sort((a, b) => ORDER.indexOf(a.model) - ORDER.indexOf(b.model));
  const origins = rows[0]?.n_origins ?? 0;
  return (
    <section className={`scorecard${compact ? " compact" : ""}`} aria-labelledby="scorecard-title">
      <p className="kicker">
        The scorecard · {origins} <Term k="backtest">replays</Term> over the past year
      </p>
      <h2 id="scorecard-title" className="visually-hidden">
        Forecast scorecard
      </h2>
      <blockquote className="verdict">{card.verdict}</blockquote>
      {card.coverage_note && (
        <p className="coverage-note" role="note">
          <span aria-hidden="true">⚠</span> {card.coverage_note}
        </p>
      )}

      {rows.length > 0 && (
        <table className="score-table">
          <caption className="visually-hidden">Accuracy of each model compared with the naive guess</caption>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">
                <Term k="skill">vs. naive guess</Term>
              </th>
              <th scope="col">
                <Term k="coverage">Caught by 95% range</Term>
              </th>
              <th scope="col" title="Average miss as a share of the price">
                Typical miss
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const skill = r.skill ?? 0;
              const isBase = r.model === card.baseline;
              const isGarch = r.model === "garch";
              const verdict = isBase ? "the yardstick" : isGarch ? "range only" : r.beats_baseline ? "better" : skill < -0.01 ? "worse" : "no better";
              return (
                <tr key={r.model}>
                  <th scope="row">
                    <span className="score-model">
                      <Term k={r.model as GlossaryKey}>{MODEL_LABEL[r.model]}</Term>
                    </span>
                    {!compact && <span className="score-blurb muted">{MODEL_BLURB[r.model]}</span>}
                  </th>
                  <td>
                    <SkillBar skill={isBase || isGarch ? null : skill} />
                    <span className={`score-word mono ${r.beats_baseline ? "up" : skill < -0.01 && !isBase && !isGarch ? "down" : "muted"}`}>
                      {verdict}
                      {!isBase && !isGarch && ` (${skillText(skill)})`}
                    </span>
                  </td>
                  <td>
                    <CoverageMeter value={r.coverage_95} />
                  </td>
                  <td className="mono">{pct(r.mape, 1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {!compact && (
        <p className="score-explain muted">
          Each replay rewinds to a past date, lets the model see only the prices up to then, and checks its next 30 trading days
          against what really happened. “Naive guess” simply says the price stays put — if a model can't beat that, its
          forecast line isn't telling you much. Try it yourself: drag the chart above sideways to turn back time.
        </p>
      )}
    </section>
  );
}

/** Signed whole percent without a confusing "-0%". */
function skillText(skill: number) {
  const p = Math.round(skill * 100);
  return p === 0 ? "±0%" : `${p > 0 ? "+" : "−"}${Math.abs(p)}%`;
}

/** Diverging bar centred on zero (= as good as the naive guess). Clamped to ±50%. */
function SkillBar({ skill }: { skill: number | null }) {
  if (skill === null) return <span className="skillbar empty" aria-hidden="true" />;
  const w = Math.min(50, Math.abs(skill) * 100);
  return (
    <span className="skillbar" aria-hidden="true">
      <span className="skillbar-zero" />
      <span
        className={`skillbar-fill ${skill >= 0 ? "pos" : "neg"}`}
        style={skill >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
      />
    </span>
  );
}

function CoverageMeter({ value }: { value: number }) {
  const ok = value >= 0.85;
  return (
    <span className="coverage">
      <span className="coverage-track" aria-hidden="true">
        <span className="coverage-fill" style={{ width: `${value * 100}%` }} />
        <span className="coverage-target" style={{ left: "95%" }} />
      </span>
      <span className={`mono ${ok ? "" : "down"}`}>
        {pct(value, 0)}
        {!ok && " ⚠"}
      </span>
    </span>
  );
}
