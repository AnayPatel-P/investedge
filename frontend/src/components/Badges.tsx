import type { Fit, RiskLevel } from "../api/types";
import { Icon, type IconName } from "./Icon";
import "./Badges.css";

const FIT_TEXT: Record<Fit, { label: string; icon: IconName }> = {
  good: { label: "Good fit", icon: "fitGood" },
  possible: { label: "Possible fit", icon: "fitPossible" },
  outside: { label: "Outside comfort zone", icon: "fitOutside" },
};

/** Fit badge: shape mark + words, so it never relies on colour alone. */
export function FitBadge({ fit }: { fit: Fit }) {
  const f = FIT_TEXT[fit];
  return (
    <span className={`fit fit-${fit}`}>
      <Icon name={f.icon} /> {f.label}
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
