import { useMemo, useRef, useState } from "react";
import type { Backtest, ModelKey, Scorecard } from "../api/types";
import { tallyRun, type Tally } from "../chart/tally";
import { MODEL_LABEL, price, shortDate } from "../format";
import { Icon } from "./Icon";
import { Term } from "./Term";
import "./Lineup.css";

const ORDER: ModelKey[] = ["naive", "arima", "ets", "prophet", "garch"];

/** One line under each player's name: what kind of call it makes. */
const POSITION: Record<ModelKey, string> = {
  naive: "Says the price stays put",
  arima: "Reads the recent trend",
  ets: "Smooths out the noise",
  prophet: "Fits trend plus seasons",
  garch: "Calls the size of swings",
};

/** Dash pattern per model, shared with the chart so lines are told apart without colour. */
export const MODEL_DASH: Record<ModelKey, string> = {
  naive: "2 3",
  arima: "6 3",
  ets: "10 3 2 3",
  prophet: "1 4",
  garch: "12 4",
};

interface Props {
  backtest: Backtest | undefined;
  scorecard: Scorecard | undefined;
  available: ModelKey[];
  focus: ModelKey;
  level: number;
  /** Index of the replay the drum is turned to, or null for today. */
  replayIndex: number | null;
  onFocus: (m: ModelKey) => void;
  onReplay: (m: ModelKey, originIndex: number) => void;
}

/**
 * The lineup: every forecasting model is a player with a card. The front shows who it is and its record;
 * flip it and the back lists its season, one row per replay. Choosing a row turns the drum to that date.
 */
/** The MVP: the model that beat the naive guess over the whole year, or the naive guess itself when none did. */
export function mvpOf(scorecard: Scorecard | undefined): ModelKey {
  const rows = scorecard?.models ?? [];
  const winners = rows.filter((r) => r.model !== "naive" && r.model !== "garch" && r.beats_baseline);
  if (!winners.length) return "naive";
  return [...winners].sort((a, b) => (b.skill ?? 0) - (a.skill ?? 0))[0].model;
}

/** Month, day and two-digit year, short enough for one row and unique per replay: "Dec 31 ’25". */
const seasonDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} \u2019${String(d.getFullYear()).slice(2)}`;
};

/**
 * The lineup in the chart's toolbar: five players in team colours, the one drawing the futures pressed.
 * It puts the cast in the first screen; the full cards live further down.
 */
export function LineupStrip({ available, focus, mvp, onFocus }: { available: ModelKey[]; focus: ModelKey; mvp: ModelKey; onFocus: (m: ModelKey) => void }) {
  return (
    <div className="strip" role="group" aria-label="Which model draws the futures">
      {ORDER.filter((m) => available.includes(m)).map((m) => (
        <button
          key={m}
          type="button"
          className="strip-player"
          aria-pressed={m === focus}
          onClick={() => onFocus(m)}
          style={{ "--c": `var(--m-${m})` } as React.CSSProperties}
          title={m === mvp ? `${MODEL_LABEL[m]}: MVP on this stock` : MODEL_LABEL[m]}
        >
          <svg className="strip-line" viewBox="0 0 24 8" aria-hidden="true">
            <path d="M1 4h22" strokeDasharray={MODEL_DASH[m]} />
          </svg>
          {MODEL_LABEL[m]}
          {m === mvp && (
            <>
              <Icon name="star" className="icon-star strip-star" />
              <span className="visually-hidden"> (MVP)</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

export function Lineup({ backtest, scorecard, available, focus, level, replayIndex, onFocus, onReplay }: Props) {
  const models = ORDER.filter((m) => available.includes(m));
  const mvp = useMemo(() => mvpOf(scorecard), [scorecard]);
  const contenders = (scorecard?.models ?? []).filter((r) => r.model !== "naive" && r.model !== "garch");
  const beatenBy = { n: contenders.filter((r) => r.beats_baseline).length, of: contenders.length };
  const n = backtest?.origins.length ?? 0;

  return (
    <section className="lineup" aria-labelledby="lineup-title">
      <header className="lineup-head">
        <h2 id="lineup-title">The lineup</h2>
        <p className="lineup-lede">
          {scorecard?.verdict ?? "Each model's record on this stock."}{" "}
          {mvp === "naive" && n > 0 && <>A model can win a single month by luck; over the whole year, none came out ahead. </>}
          {n > 0 && (
            <span className="muted">
              Flip a card for its season: {n} <Term k="backtest">replays</Term>, each fit only on what it knew at the time.
            </span>
          )}
        </p>
        {scorecard?.coverage_note && (
          <p className="lineup-note" role="note">
            {scorecard.coverage_note}
          </p>
        )}
      </header>
      <ol className="lineup-rail">
        {models.map((m) => (
          <li key={m}>
            <PlayerCard
              model={m}
              mvp={m === mvp}
              focused={m === focus}
              backtest={backtest}
              beatenBy={m === "naive" ? beatenBy : null}
              level={level}
              replayIndex={m === focus ? replayIndex : null}
              onFocus={() => onFocus(m)}
              onReplay={(i) => onReplay(m, i)}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

function PlayerCard({
  model,
  mvp,
  focused,
  backtest,
  beatenBy,
  level,
  replayIndex,
  onFocus,
  onReplay,
}: {
  model: ModelKey;
  mvp: boolean;
  focused: boolean;
  backtest: Backtest | undefined;
  beatenBy: { n: number; of: number } | null;
  level: number;
  replayIndex: number | null;
  onFocus: () => void;
  onReplay: (i: number) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const frontFlip = useRef<HTMLButtonElement>(null);
  const backFlip = useRef<HTMLButtonElement>(null);
  const name = MODEL_LABEL[model];

  const season = useMemo(() => {
    if (!backtest) return [] as (Tally | null)[];
    return backtest.origins.map((o) => tallyRun(o, backtest.runs[o] ?? {}, model, level));
  }, [backtest, model, level]);
  const played = season.filter((t): t is Tally => t !== null);
  const inside = played.filter((t) => t.inside).length;
  const beat = played.filter((t) => t.beatNaive).length;
  // One measure on both faces: how far off the forecast was at the end of the horizon, averaged over the season.
  const typicalMiss = played.length ? played.reduce((s, t) => s + t.modelMiss / t.actual, 0) / played.length : null;
  const missText = typicalMiss === null ? "—" : `${(typicalMiss * 100).toFixed(1)}%`;

  const flip = (to: boolean) => {
    setFlipped(to);
    // Keep the keyboard on the card: focus follows to the face that is now showing.
    requestAnimationFrame(() => (to ? backFlip : frontFlip).current?.focus({ preventScroll: true }));
  };

  const headline =
    model === "naive"
      ? { label: "Typical miss", value: missText }
      : model === "garch"
        ? { label: "Direction", value: "None" }
        : { label: "Months it beat the naive guess", value: played.length ? `${beat} of ${played.length}` : "—" };

  return (
    <div
      className={`player${flipped ? " is-flipped" : ""}${focused ? " is-focus" : ""}${mvp ? " is-mvp" : ""}`}
      style={{ "--c": `var(--m-${model})` } as React.CSSProperties}
    >
      <div className="player-turn">
        {/* ---------------- front */}
        <article className="player-face player-front" aria-label={`${name} card`} {...hiddenIf(flipped)}>
          {mvp && (
            <span className="player-mvp" title={model === "naive" ? "No model beat the naive guess on this stock" : "Best record on this stock"}>
              <Icon name="star" className="icon-star" /> MVP
            </span>
          )}
          <h3 className="player-name">{name}</h3>
          <p className="player-pos">{POSITION[model]}</p>
          <svg className="player-glyph" viewBox="0 0 160 36" aria-hidden="true" preserveAspectRatio="none">
            <path d={GLYPH[model]} strokeDasharray={MODEL_DASH[model]} />
          </svg>
          <dl className="player-stats">
            <div className="player-stat-main">
              <dt>{headline.label}</dt>
              <dd className="num">{headline.value}</dd>
            </div>
            <div>
              <dt>
                <Term k="coverage">{level}% range caught</Term>
              </dt>
              <dd className="num">{played.length ? `${inside} of ${played.length}` : "—"}</dd>
            </div>
            {model !== "naive" ? (
              <div>
                <dt>Typical miss</dt>
                <dd className="num">{missText}</dd>
              </div>
            ) : (
              beatenBy &&
              beatenBy.of > 0 && (
                <div>
                  <dt title="Over the whole year">Models that beat it</dt>
                  <dd className="num">
                    {beatenBy.n} of {beatenBy.of}
                  </dd>
                </div>
              )
            )}
          </dl>
          {played.length > 0 && (
            <div className="pips" aria-label={`In range ${inside} of ${played.length} replays`} role="img">
              {season.map((t, i) =>
                t ? <span key={t.origin} className={`pip${t.inside ? " in" : ""}${replayIndex === i ? " now" : ""}`} /> : null,
              )}
            </div>
          )}
          <div className="player-actions">
            <button type="button" className="player-draw" aria-pressed={focused} onClick={onFocus}>
              {focused ? "On chart" : "Draw it"}
            </button>
            <button ref={frontFlip} type="button" className="player-flip" onClick={() => flip(true)} disabled={!played.length}>
              Season <FlipIcon />
              <span className="visually-hidden"> for {name}</span>
            </button>
          </div>
        </article>

        {/* ---------------- back: the season */}
        <article className="player-face player-back" aria-label={`${name} season`} {...hiddenIf(!flipped)}>
          <h3 className="player-back-title">
            {name} <span>· season</span>
          </h3>
          <table className="season">
            <caption className="visually-hidden">
              Each replay: how far off {name} was after the horizon, and whether reality landed inside its {level}% range. Choose a
              row to turn the chart to that date.
            </caption>
            <thead>
              <tr>
                <th scope="col">From</th>
                <th scope="col" title="How far its forecast was from the real price at the end of the horizon">Off by</th>
                <th scope="col">In range</th>
              </tr>
            </thead>
            <tbody>
              {season.map((t, i) =>
                t ? (
                  <tr key={t.origin} className={replayIndex === i ? "is-current" : undefined}>
                    <th scope="row">
                      <button
                        type="button"
                        className="season-go"
                        onClick={() => onReplay(i)}
                        aria-current={replayIndex === i ? "true" : undefined}
                        title={`Turn the chart to ${shortDate(t.origin)}: ${name} expected ${price(t.predicted)}, reality was ${price(t.actual)}`}
                      >
                        {seasonDate(t.origin)}
                      </button>
                    </th>
                    <td className="num">{((t.modelMiss / t.actual) * 100).toFixed(1)}%</td>
                    <td className={t.inside ? "in" : "out"}>{t.inside ? "In" : "Out"}</td>
                  </tr>
                ) : null,
              )}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{played.length} replays</th>
                <td className="num">{missText}</td>
                <td className="num">
                  {inside}/{played.length}
                </td>
              </tr>
            </tfoot>
          </table>
          <button ref={backFlip} type="button" className="player-flip" onClick={() => flip(false)}>
            <FlipIcon back /> Card front
          </button>
        </article>
      </div>
    </div>
  );
}

/** Hide the face that is turned away from assistive tech and the tab order. */
function hiddenIf(hidden: boolean) {
  return hidden ? ({ inert: "", "aria-hidden": true } as Record<string, unknown>) : {};
}

/** A tiny signature of each model's line: flat, trending, smooth, seasonal, swinging. */
const GLYPH: Record<ModelKey, string> = {
  naive: "M2,18 L158,18",
  arima: "M2,26 C40,24 80,16 158,8",
  ets: "M2,22 C50,20 100,17 158,15",
  prophet: "M2,24 C25,8 45,8 65,20 C85,32 105,30 125,16 C140,8 150,10 158,14",
  garch: "M2,18 L22,8 L40,28 L58,10 L78,26 L98,6 L118,30 L138,12 L158,22",
};

/** A card turning over: two arcs around a card outline, drawn at the button's text size. */
function FlipIcon({ back = false }: { back?: boolean }) {
  return (
    <svg className="flip-icon" viewBox="0 0 16 16" aria-hidden="true" style={back ? { transform: "scaleX(-1)" } : undefined}>
      <rect x="5" y="3" width="6" height="10" rx="1.2" />
      <path d="M2.5 6.5a6 6 0 0 1 3-3.6M13.5 9.5a6 6 0 0 1-3 3.6" />
      <path d="M4.2 2.4l1.4.6-.6 1.4M11.8 13.6l-1.4-.6.6-1.4" />
    </svg>
  );
}
