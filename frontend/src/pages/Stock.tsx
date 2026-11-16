import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, useBacktest, useForecasts, useMetrics, usePatterns, usePrices, useProfiles, useScorecard } from "../api/client";
import type { ForecastPoint, ModelKey, PriceBar, Profile } from "../api/types";
import { FuturesChart, type ChartMode, type Phase, type Range } from "../chart/FuturesChart";
import { Scrubber } from "../chart/Scrubber";
import { tallyAll, tallyRun, type Tally } from "../chart/tally";
import { bandAt } from "../chart/trails";
import { FitBadge, RiskMeter } from "../components/Badges";
import { Dial } from "../components/Dial";
import { MetricsLedger } from "../components/MetricsLedger";
import { Term } from "../components/Term";
import { PatternPanel } from "../components/PatternPanel";
import { ScorecardPanel } from "../components/ScorecardPanel";
import { Tutor } from "../components/Tutor";
import { MODEL_BLURB, MODEL_LABEL, longDate, price, shortDate, signedPct } from "../format";
import { usePrefs } from "../state/prefs";
import "./Stock.css";

const MODELS: ModelKey[] = ["naive", "arima", "ets", "prophet", "garch"];
const LEVELS = [
  { value: 50, label: "50% range", short: "50" },
  { value: 80, label: "80% range", short: "80" },
  { value: 95, label: "95% range", short: "95" },
];
const RANGES: Range[] = ["1M", "6M", "1Y", "5Y"];

function defaultsFor(profile: Profile | undefined) {
  const models: ModelKey[] = profile?.view.default_models ?? ["naive", "arima"];
  const focus: ModelKey = models.find((m) => m !== "naive") ?? "naive";
  const level = profile?.view.bands[profile.view.bands.length - 1] ?? 95;
  return { models, focus, level, emphasis: (profile?.view.emphasis ?? "balanced") as "downside" | "balanced" | "full model spread" };
}

export function Stock() {
  const { symbol = "" } = useParams();
  const sym = symbol.toUpperCase();
  const { profile, density } = usePrefs();
  const profiles = useProfiles();
  const prof = profiles.data?.find((p) => p.key === profile);
  const defaults = defaultsFor(prof);

  const prices = usePrices(sym);
  const forecasts = useForecasts(sym);
  const metrics = useMetrics(sym);
  const scorecard = useScorecard(sym);
  const backtest = useBacktest(sym);

  const [mode, setMode] = useState<ChartMode>("candles");
  const [range, setRange] = useState<Range>("6M");
  const [focus, setFocus] = useState<ModelKey>(defaults.focus);
  const [visible, setVisible] = useState<ModelKey[]>(defaults.models);
  const [level, setLevel] = useState<number>(defaults.level);
  const [stop, setStop] = useState<number | null>(null); // null = today
  const [releaseKey, setReleaseKey] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [hover, setHover] = useState<PriceBar | null>(null);
  const [showPatterns, setShowPatterns] = useState(false);
  const [pickedMarker, setPickedMarker] = useState<string | null>(null);
  const patterns = usePatterns(sym, showPatterns);

  // Re-apply profile defaults when the profile (or stock) changes.
  useEffect(() => {
    setFocus(defaults.focus);
    setVisible(defaults.models);
    setLevel(defaults.level);
    setStop(null);
    setReleaseKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, sym, profiles.data]);

  useEffect(() => {
    document.title = `${sym} · InvestEdge`;
  }, [sym]);

  const origins = backtest.data?.origins ?? [];
  const todayIndex = origins.length;
  const stopIndex = stop ?? todayIndex;
  const replayOrigin = stop !== null && stop < origins.length ? origins[stop] : null;

  // What the chart shows: today's forecasts, or a past origin's forecasts + reality.
  const view = useMemo(() => {
    const bars = prices.data ?? [];
    if (!replayOrigin || !backtest.data) {
      return { bars, forecasts: forecasts.data ?? {}, reality: undefined as { date: string; close: number }[] | undefined };
    }
    const run = backtest.data.runs[replayOrigin] ?? {};
    const fc: Partial<Record<ModelKey, ForecastPoint[]>> = {};
    for (const [m, pts] of Object.entries(run)) fc[m as ModelKey] = pts ?? [];
    const anyRun = Object.values(run)[0] ?? [];
    return {
      bars: bars.filter((b) => b.date <= replayOrigin),
      forecasts: fc,
      reality: anyRun.map((p) => ({ date: p.date, close: p.actual })),
    };
  }, [prices.data, forecasts.data, backtest.data, replayOrigin]);

  const tally: Tally | null = useMemo(
    () => (replayOrigin && backtest.data ? tallyRun(replayOrigin, backtest.data.runs[replayOrigin] ?? {}, focus, level) : null),
    [replayOrigin, backtest.data, focus, level],
  );
  const totals = useMemo(() => (backtest.data?.origins.length ? tallyAll(backtest.data, focus, level) : null), [backtest.data, focus, level]);

  const replay = (i: number) => {
    setStop(i === todayIndex ? null : i);
    setReleaseKey((k) => k + 1);
  };

  if (prices.error) {
    const notFound = prices.error instanceof ApiError && prices.error.status === 404;
    return (
      <div className="stock-missing">
        <p className="kicker">{sym}</p>
        <h1>{notFound ? "That ticker isn't in the S&P 500 almanac." : "Couldn't load this stock."}</h1>
        <p>
          <Link to="/">Back to all stocks</Link>
        </p>
      </div>
    );
  }

  const m = metrics.data;
  const bars = prices.data ?? [];
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const day = last && prev ? signedPct(last.close / prev.close - 1, 2) : null;
  const tooNew = forecasts.data && Object.keys(forecasts.data).length === 0;
  const focusPts = view.forecasts[focus] ?? [];
  const endBand = focusPts.length ? bandAt(focusPts[focusPts.length - 1], level) : null;
  const terminal = density === "terminal";
  const shown = hover ?? last;

  return (
    <article className={`stock ${terminal ? "is-terminal" : "is-guided"}`}>
      {/* ------------------------------------------------ masthead of the page */}
      <header className="stock-head">
        <div className="stock-title">
          <p className="kicker">
            {m?.sector ?? " "} {profile && m && <>· <FitBadge fit={m.fit[profile]} /></>}
          </p>
          <h1 className="stock-ticker">{sym}</h1>
          <p className="stock-name">{m?.name ?? " "}</p>
        </div>
        <div className="stock-price">
          <span className="stock-last num">{last ? price(last.close) : "—"}</span>
          {day && (
            <span className={`mono ${day.dir}`}>
              {day.text} <span className="muted">on {last && shortDate(last.date)}</span>
            </span>
          )}
          {m && <RiskMeter score={m.risk_score} level={m.risk_level} />}
          {m && (
            <span className="stock-risk-line muted">
              <Term k="riskScore">{m.risk_sentence}</Term>
            </span>
          )}
        </div>
      </header>

      <div className="stock-grid">
        {/* ------------------------------------------------ chart + instruments */}
        <section className="stock-chart" aria-label="Price chart and forecasts">
          <div className="instruments">
            <div className="instrument-row">
              <div className="segmented" role="group" aria-label="Chart type">
                <button type="button" aria-pressed={mode === "candles"} onClick={() => setMode("candles")}>
                  Candles
                </button>
                <button type="button" aria-pressed={mode === "line"} onClick={() => setMode("line")}>
                  Line
                </button>
              </div>
              <button
                type="button"
                className="btn patterns-toggle"
                aria-pressed={showPatterns}
                onClick={() => {
                  setShowPatterns((v) => !v);
                  setMode("candles");
                  setPickedMarker(null);
                }}
                title="Mark classic candlestick patterns and check whether they meant anything"
              >
                {showPatterns ? "◆ Patterns on" : "◇ Patterns"}
              </button>
              <div className="segmented" role="group" aria-label="Time range">
                {RANGES.map((r) => (
                  <button key={r} type="button" aria-pressed={range === r && !replayOrigin} disabled={!!replayOrigin} onClick={() => setRange(r)}>
                    {r}
                  </button>
                ))}
              </div>
              <div className="ohlc mono" aria-live="off">
                {shown && (
                  <>
                    <span className="muted">{shortDate(shown.date)}</span> O {price(shown.open)} H {price(shown.high)} L {price(shown.low)} C{" "}
                    <strong>{price(shown.close)}</strong>
                  </>
                )}
              </div>
            </div>
            <div className="model-chips" role="group" aria-label="Forecast models">
              <span className="kicker">Models</span>
              {MODELS.map((mk) => {
                const on = visible.includes(mk) || focus === mk;
                return (
                  <span key={mk} className={`chip${on ? " on" : ""}${focus === mk ? " focus" : ""}`}>
                    <button
                      type="button"
                      aria-pressed={on}
                      title={MODEL_BLURB[mk]}
                      onClick={() => setVisible((v) => (v.includes(mk) ? v.filter((x) => x !== mk) : [...v, mk]))}
                    >
                      {MODEL_LABEL[mk]}
                    </button>
                    <button
                      type="button"
                      className="chip-focus"
                      aria-label={`Show ${MODEL_LABEL[mk]}'s range and possible futures`}
                      aria-pressed={focus === mk}
                      onClick={() => {
                        setFocus(mk);
                        setReleaseKey((k) => k + 1);
                      }}
                    >
                      ◎
                    </button>
                  </span>
                );
              })}
            </div>
          </div>

          {tooNew ? (
            <div className="too-new">
              <h2>Too new to forecast</h2>
              <p>
                {sym} has traded for less than a year, so there isn't enough history to fit models or test them honestly. Its price
                chart is still here.
              </p>
            </div>
          ) : null}

          {bars.length ? (
            <FuturesChart
              bars={view.bars}
              mode={mode}
              range={range}
              focus={focus}
              forecasts={view.forecasts}
              visibleModels={visible}
              level={level}
              emphasis={defaults.emphasis}
              reality={view.reality}
              releaseKey={releaseKey}
              replay={!!replayOrigin}
              onPhase={setPhase}
              onHover={setHover}
              markers={showPatterns && !replayOrigin ? patterns.data?.occurrences : undefined}
              onMarkerClick={setPickedMarker}
            />
          ) : (
            <div className="skeleton chart-skeleton" aria-hidden="true" />
          )}

          {!terminal && !tooNew && endBand && (
            <p className="chart-caption">
              {replayOrigin ? (
                <>
                  Rewound to <strong>{longDate(replayOrigin)}</strong>. Each faint line is one future {MODEL_LABEL[focus]} considered possible;
                  the shaded fan is its {level}% range. The ink line is what actually happened next.
                </>
              ) : (
                <>
                  Each faint line is one possible future. {MODEL_LABEL[focus]}'s{" "}
                  <Term k="forecastRange">{level}% range</Term> says that by{" "}
                  <strong>{shortDate(focusPts[focusPts.length - 1].date)}</strong> the price should land between{" "}
                  <strong className="num">{price(endBand.lo)}</strong> and <strong className="num">{price(endBand.hi)}</strong>{" "}
                  {level} times out of 100 — if the model is honest. The scorecard below checks that.
                </>
              )}
            </p>
          )}

          {/* ------------------------------------------------ Rewind & Release */}
          {!tooNew && (
            <div className="rewind">
              <div className="rewind-head">
                <div>
                  <p className="kicker">Rewind &amp; release</p>
                  {!terminal && (
                    <p className="rewind-help">
                      Drag back in time. The model only sees prices up to that day — then watch its possible futures spread out, and
                      reality draw itself through them.
                    </p>
                  )}
                </div>
                <div className="rewind-actions">
                  <button type="button" className="btn" onClick={() => setReleaseKey((k) => k + 1)} disabled={phase === "release" || phase === "reality"}>
                    {replayOrigin ? "▶ Replay" : "▶ Release futures"}
                  </button>
                  {replayOrigin && (
                    <button type="button" className="btn" onClick={() => replay(todayIndex)}>
                      Back to today
                    </button>
                  )}
                </div>
              </div>
              <Scrubber origins={origins} value={stopIndex} onChange={replay} disabled={!origins.length} />
            </div>
          )}

          {replayOrigin && tally && (
            <TallyCard tally={tally} level={level} show={phase === "done"} totals={totals} />
          )}

          {showPatterns && patterns.data && (
            <div className="stock-patterns">
              <PatternPanel data={patterns.data} selected={pickedMarker} symbol={sym} />
            </div>
          )}
          {showPatterns && patterns.isLoading && <div className="skeleton" style={{ height: 200, marginTop: 24 }} aria-hidden="true" />}
        </section>

        {/* ------------------------------------------------ side: confidence dial, scorecard, metrics */}
        <aside className="stock-side">
          {!tooNew && (
            <div className="confidence">
              <Dial
                label="Confidence"
                options={LEVELS}
                value={level}
                onChange={(v) => setLevel(v)}
                size={terminal ? 96 : 120}
                caption="Wider range = more honest, less precise."
              />
            </div>
          )}
          {scorecard.data && <ScorecardPanel card={scorecard.data} compact={terminal} />}
        </aside>
      </div>

      {m && (
        <section className="stock-section" aria-labelledby="metrics-title">
          <h2 id="metrics-title">{terminal ? "Risk" : "How bumpy has the ride been?"}</h2>
          <MetricsLedger m={m} compact={terminal} />
        </section>
      )}

      <div className="stock-section">
        <Tutor symbol={sym} profile={profile} />
      </div>
    </article>
  );
}

function TallyCard({
  tally,
  level,
  show,
  totals,
}: {
  tally: Tally;
  level: number;
  show: boolean;
  totals: { n: number; inside: number; beat: number } | null;
}) {
  const name = MODEL_LABEL[tally.model];
  return (
    <div className={`tally${show ? " show" : ""}`} aria-live="polite">
      {show && (
        <>
          <div className="tally-face">
            <p className="kicker">
              {shortDate(tally.origin)} → {shortDate(tally.endDate)}
            </p>
            <p className="tally-line">
              {name} expected about <span className="num">{price(tally.predicted)}</span>. Reality:{" "}
              <span className="num">{price(tally.actual)}</span>.
            </p>
            <ul className="tally-checks">
              <li className={tally.inside ? "up" : "down"}>
                <span aria-hidden="true">{tally.inside ? "✓" : "✗"}</span> {tally.inside ? "Landed inside" : "Landed outside"} the {level}%
                range ({price(tally.lo)}–{price(tally.hi)})
              </li>
              {tally.model !== "naive" && (
                <li className={tally.beatNaive ? "up" : "down"}>
                  <span aria-hidden="true">{tally.beatNaive ? "✓" : "✗"}</span>{" "}
                  {tally.beatNaive ? "Closer than" : "No closer than"} the naive guess (missed by {price(tally.modelMiss)} vs.{" "}
                  {price(tally.naiveMiss)})
                </li>
              )}
            </ul>
          </div>
          {totals && (
            <p className="tally-totals">
              Across all {totals.n} replays, reality landed inside {name}'s {level}% range <strong>{totals.inside}</strong> times
              {tally.model !== "naive" && (
                <>
                  , and {name} beat the naive guess <strong>{totals.beat}</strong> times
                </>
              )}
              .
            </p>
          )}
        </>
      )}
    </div>
  );
}
