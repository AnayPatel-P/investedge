import { useMemo, useState } from "react";
import type { ProfileKey } from "../api/types";
import { usePrefs } from "../state/prefs";
import { Dial } from "./Dial";
import "./ProfilePicker.css";

const OPTIONS: { value: ProfileKey; label: string; short: string }[] = [
  { value: "conservative", label: "Conservative", short: "Calm" },
  { value: "moderate", label: "Moderate", short: "Mid" },
  { value: "aggressive", label: "Aggressive", short: "Bold" },
];

const COPY: Record<ProfileKey, { line: string; swing: string; vol: number }> = {
  conservative: {
    line: "You'd rather grow slowly than watch big drops. We'll highlight steadier stocks, dividends, and the downside of every forecast.",
    swing: "A typical steady stock swings about 18% a year.",
    vol: 0.18,
  },
  moderate: {
    line: "You'll accept some bumps for better long-term growth. We'll balance risk and return, and show you why spreading out helps.",
    swing: "A typical middle-of-the-road stock swings about 30% a year.",
    vol: 0.3,
  },
  aggressive: {
    line: "You're fine with big swings in pursuit of growth. We'll show the full spread of what models think could happen — including how often they're wrong.",
    swing: "A typical high-risk stock swings about 50% a year.",
    vol: 0.5,
  },
};

/** Deterministic pseudo-random walk so the preview looks the same every render. */
function swingPath(vol: number, w = 520, h = 120) {
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const n = 120;
  const daily = vol / Math.sqrt(252);
  let v = 0;
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    v += rand() * daily * 3.2;
    pts.push(v);
  }
  const scale = (h / 2 - 8) / 0.42; // fixed scale so bigger vol = visibly bumpier
  return pts.map((p, i) => `${i ? "L" : "M"}${((i / (n - 1)) * w).toFixed(1)},${(h / 2 - p * scale).toFixed(1)}`).join(" ");
}

const QUIZ: { q: string; a: string[] }[] = [
  {
    q: "If an investment dropped 20% in a month, you'd most likely…",
    a: ["Sell, to stop the bleeding", "Wait it out", "Shrug, or even buy more"],
  },
  { q: "When might you need this money?", a: ["Within 3 years", "In 3–10 years", "Not for 10+ years"] },
  { q: "Which matters more to you?", a: ["Not losing money", "A balance of both", "The biggest possible growth"] },
];

export function quizProfile(answers: number[]): ProfileKey {
  const score = answers.reduce((s, a) => s + a, 0);
  return score <= 2 ? "conservative" : score <= 4 ? "moderate" : "aggressive";
}

export function ProfilePicker() {
  const { setProfile } = usePrefs();
  const [choice, setChoice] = useState<ProfileKey>("moderate");
  const [quizOpen, setQuizOpen] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null]);
  const paths = useMemo(() => Object.fromEntries(OPTIONS.map((o) => [o.value, swingPath(COPY[o.value].vol)])), []);

  const quizDone = answers.every((a) => a !== null);

  return (
    <section className="picker" aria-labelledby="picker-title">
      <h1 id="picker-title" className="picker-title">
        How do you feel about <em>swings</em>?
      </h1>
      <p className="picker-lede">
        Every stock goes up and down. Pick how bumpy a ride you can live with, and InvestEdge will tune what it highlights
        for you. You can change it any time.
      </p>

      <div className="picker-bench">
        <Dial
          label="Risk appetite"
          options={OPTIONS}
          value={choice}
          onChange={setChoice}
          size={168}
          caption="Drag the knob, use arrow keys, or tap a label."
        />
        <figure className="picker-swing" aria-label={COPY[choice].swing}>
          <svg viewBox="0 0 520 120" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" x2="520" y1="60" y2="60" className="swing-axis" />
            {OPTIONS.map((o) => (
              <path key={o.value} d={paths[o.value]} className={`swing-line${o.value === choice ? " on" : ""}`} />
            ))}
          </svg>
          <figcaption>
            <span>
              <strong>How bumpy the ride feels:</strong> {COPY[choice].swing}
            </span>
          </figcaption>
        </figure>
      </div>

      <p className="picker-line">{COPY[choice].line}</p>

      <div className="picker-actions">
        <button type="button" className="btn primary" onClick={() => {
            setProfile(choice);
            window.scrollTo(0, 0);
          }}>
          Use {OPTIONS.find((o) => o.value === choice)!.label.toLowerCase()}
        </button>
        <button type="button" className="btn" aria-expanded={quizOpen} onClick={() => setQuizOpen((v) => !v)}>
          Not sure? Take a 3-question quiz
        </button>
      </div>

      {quizOpen && (
        <form className="quiz" onSubmit={(e) => e.preventDefault()}>
          {QUIZ.map((item, qi) => (
            <fieldset key={item.q}>
              <legend>
                <span className="mono quiz-n">{qi + 1}</span> {item.q}
              </legend>
              <div className="quiz-options">
                {item.a.map((label, ai) => (
                  <label key={label} className={answers[qi] === ai ? "on" : ""}>
                    <input
                      type="radio"
                      name={`q${qi}`}
                      checked={answers[qi] === ai}
                      onChange={() => {
                        const next = [...answers];
                        next[qi] = ai;
                        setAnswers(next);
                        if (next.every((a) => a !== null)) setChoice(quizProfile(next as number[]));
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <p className="quiz-result" aria-live="polite">
            {quizDone
              ? `Your answers point to a ${quizProfile(answers as number[])} profile — the dial has moved there. It's a starting point, not a verdict.`
              : "Answer all three and the dial will move to match."}
          </p>
        </form>
      )}
    </section>
  );
}
