import type { Fit, RiskLevel } from "../api/types";
import "./Badges.css";

const FIT_TEXT: Record<Fit, { label: string; glyph: string }> = {
  good: { label: "Good fit", glyph: "●" },
  possible: { label: "Possible fit", glyph: "◐" },
  outside: { label: "Outside comfort zone", glyph: "○" },
};

/** Fit badge: shape glyph + words, so it never relies on color alone. */
export function FitBadge({ fit }: { fit: Fit }) {
  const f = FIT_TEXT[fit];
  return (
    <span className={`fit fit-${fit}`}>
      <span aria-hidden="true">{f.glyph}</span> {f.label}
    </span>
  );
}

/** 0–100 percentile scale with tercile ticks and a marker. */
export function RiskMeter({ score, level }: { score: number | null; level: RiskLevel | null }) {
  if (score === null || level === null) return <span className="muted">Not enough history</span>;
  return (
    <span className="riskmeter" role="img" aria-label={`Risk ${level}: riskier than ${Math.round(score)}% of S&P 500 stocks`}>
      <span className="riskmeter-track">
        <span className="riskmeter-tick" style={{ left: "33.3%" }} />
        <span className="riskmeter-tick" style={{ left: "66.6%" }} />
        <span className="riskmeter-mark" style={{ left: `${score}%` }} />
      </span>
      <span className="riskmeter-label mono">
        {level} · {Math.round(score)}
      </span>
    </span>
  );
}
