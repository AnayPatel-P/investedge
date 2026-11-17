import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, useBacktest, useBenchmark, useForecasts, useMetrics, usePatterns, usePrices, useProfiles, useScorecard } from "../api/client";
import type { ForecastPoint, ModelKey, PriceBar, Profile } from "../api/types";
import { compareToBenchmark, rebaseBenchmark, type Comparison } from "../chart/benchmark";
import { FuturesChart, RANGE_BARS, type ChartMode, type Phase, type Range } from "../chart/FuturesChart";
import { Scrubber, type RulerHandle } from "../chart/Scrubber";
import { outlook } from "../chart/outlook";
import { tallyAll, tallyRun, type Tally } from "../chart/tally";
import { bandAt, futurePaths } from "../chart/trails";
import { FitBadge, RiskMeter } from "../components/Badges";
import { MetricsLedger } from "../components/MetricsLedger";
import { Outlook } from "../components/Outlook";
import { ModelGuide, describeLine } from "../components/ModelGuide";
import { lineShape } from "../chart/lineShape";
import { Term } from "../components/Term";
import { PatternPanel } from "../components/PatternPanel";
import { ScorecardPanel } from "../components/ScorecardPanel";
import { Tutor } from "../components/Tutor";
import { MODEL_BLURB, MODEL_LABEL, longDate, price, shortDate, signedPct } from "../format";
import { usePrefs } from "../state/prefs";
import "./Stock.css";

const MODELS: ModelKey[] = ["naive", "arima", "ets", "prophet", "garch"];
const LEVELS = [50, 80, 95];
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
  const [showMarket, setShowMarket] = useState(false);
  const rulerRef = useRef<RulerHandle>(null);
  const bench = useBenchmark(showMarket);

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
      return { start: bars[bars.length - 1]?.close ?? 0, forecasts: forecasts.data ?? {}, reality: undefined as { date: string; close: number }[] | undefined };
    }
    const run = backtest.data.runs[replayOrigin] ?? {};
    const fc: Partial<Record<ModelKey, ForecastPoint[]>> = {};
    for (const [m, pts] of Object.entries(run)) fc[m as ModelKey] = pts ?? [];
    const anyRun = Object.values(run)[0] ?? [];
    const before = bars.filter((b) => b.date <= replayOrigin);
    return {
      start: before[before.length - 1]?.close ?? 0,
      forecasts: fc,
      reality: anyRun.map((p) => ({ date: p.date, close: p.actual })),
    };
  }, [prices.data, forecasts.data, backtest.data, replayOrigin]);

  const tally: Tally | null = useMemo(
    () => (replayOrigin && backtest.data ? tallyRun(replayOrigin, backtest.data.runs[replayOrigin] ?? {}, focus, level) : null),
    [replayOrigin, backtest.data, focus, level],
  );
  const totals = useMemo(() => (backtest.data?.origins.length ? tallyAll(backtest.data, focus, level) : null), [backtest.data, focus, level]);

  // S&P 500 comparison, measured from the first bar of the chosen time range.
  const marketStart = Math.max(0, (prices.data?.length ?? 0) - RANGE_BARS[range]);
  const marketLine = useMemo(
    () => (showMarket && !replayOrigin && bench.data && prices.data ? rebaseBenchmark(prices.data, bench.data.prices, marketStart) : undefined),
    [showMarket, replayOrigin, bench.data, prices.data, marketStart],
  );
  const market = useMemo(
    () => (showMarket && bench.data && prices.data ? compareToBenchmark(prices.data, bench.data.prices, marketStart) : null),
    [showMarket, bench.data, prices.data, marketStart],
  );

  // The drum turns itself to the new date and releases the futures when it settles.
  const replay = (i: number) => setStop(i === todayIndex ? null : i);

  if (prices.error) {
    const notFound = prices.error instanceof ApiError && prices.error.status === 404;
    return (
      <div className="stock-missing">
        <p className="kicker">{sym}</p>
        <h1>{notFound ? "That ticker isn't in the S&P 500." : "Couldn't load this stock."}</h1>
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
  const focusShape = last && !replayOrigin ? lineShape(focusPts, last.close) : null;
  const terminal = density === "terminal";
  const shown = hover ?? last;

  const paths = futurePaths(focusPts);
  const tiles = outlook(focusPts, paths, view.start, level, view.reality);
  const turning = phase === "turning";

  return (
    <article className={`stock ${terminal ? "is-terminal" : "is-guided"}`}>
      {/* ------------------------------------------------ the price, first */}
      <header className="stock-head">
        <div className="stock-title">
          <p className="kicker">
            {m?.sector ?? " "} {profile && m && <>· <FitBadge fit={m.fit[profile]} /></>}
          </p>
          <h1 className="stock-ticker">{sym}</h1>
          <p className="stock-name">{m?.name ?? " "}</p>
        </div>
        <div className="stock-price">
          <span className="stock-last num" aria-label={last ? `Last close ${price(last.close)}` : undefined}>
            {last ? price(last.close) : "—"}
          </span>
          {day && (
            <span className={`stock-day num ${day.dir}`}>
              {day.text}{" "}
              <span className="muted">on {last && shortDate(last.date)}</span>
            </span>
          )}
          {m && (
            <span className="stock-risk-line">
              <RiskMeter score={m.risk_score} level={m.risk_level} />
              <span className="muted">
                <Term k="riskScore">{m.risk_sentence}</Term>
              </span>
            </span>
          )}
        </div>
      </header>

      {/* ------------------------------------------------ the drum */}
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
            <div className="segmented" role="group" aria-label="Time shown before the pen">
              {RANGES.map((r) => (
                <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
                  {r}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn"
              aria-pressed={showMarket}
              onClick={() => setShowMarket((v) => !v)}
              title="Compare this stock with the S&P 500 over the chosen time range"
            >
              <span aria-hidden="true">╌</span> vs S&amp;P 500
            </button>
            <button
              type="button"
              className="btn"
              aria-pressed={showPatterns}
              onClick={() => {
                setShowPatterns((v) => !v);
                setMode("candles");
                setPickedMarker(null);
              }}
              title="Mark classic candlestick patterns and check whether they meant anything"
            >
              Patterns
            </button>
            <div className="ohlc num" aria-live="off">
              {shown && !turning && (
                <>
                  <span className="muted">{shortDate(shown.date)}</span> <span className="muted">O</span> {price(shown.open)}{" "}
                  <span className="muted">H</span> {price(shown.high)} <span className="muted">L</span> {price(shown.low)}{" "}
                  <span className="muted">C</span> <strong>{price(shown.close)}</strong>
                </>
              )}
            </div>
          </div>
          {!tooNew && (
            <div className="instrument-row model-row">
              <div className="model-chips" role="group" aria-label="Forecast models">
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
                        aria-label={`Draw ${MODEL_LABEL[mk]}'s range and possible futures`}
                        aria-pressed={focus === mk}
                        onClick={() => {
                          setFocus(mk);
                          setReleaseKey((k) => k + 1);
                        }}
                      >
                        <span aria-hidden="true">{focus === mk ? "●" : "○"}</span>
                      </button>
                    </span>
                  );
                })}
              </div>
              <div className="segmented" role="group" aria-label="Range shown around the focus model">
                {LEVELS.map((lv) => (
                  <button key={lv} type="button" aria-pressed={level === lv} onClick={() => setLevel(lv)}>
                    {lv}%
                  </button>
                ))}
              </div>
              <a
                className="mg-link"
                href="#model-guide"
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById("model-guide") as HTMLDetailsElement | null;
                  if (el) {
                    el.open = true;
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
              >
                What are these?
              </a>
            </div>
          )}
        </div>

        {tooNew && (
          <div className="too-new">
            <h2>Too new to forecast</h2>
            <p>
              {sym} has traded for less than a year, so there isn't enough history to fit models or test them honestly. Its price chart
              is still here.
            </p>
          </div>
        )}

        {bars.length ? (
          <FuturesChart
            bars={bars}
            mode={mode}
            range={range}
            focus={focus}
            forecasts={view.forecasts}
            visibleModels={visible}
            level={level}
            emphasis={defaults.emphasis}
            origin={replayOrigin}
            stops={tooNew ? [] : origins}
            onOriginChange={replay}
            onPen={(p) => rulerRef.current?.setPen(p)}
            reality={view.reality}
            releaseKey={releaseKey}
            onPhase={setPhase}
            onHover={setHover}
            markers={showPatterns && !replayOrigin ? patterns.data?.occurrences : undefined}
            onMarkerClick={setPickedMarker}
            benchmark={marketLine}
          />
        ) : (
          <div className="skeleton chart-skeleton" aria-hidden="true" />
        )}

        {!tooNew && (
          <div className="drum-foot">
            <div className="drum-status">
              {turning ? (
                <p>
                  <strong>Turning…</strong> <span className="muted">Let go on any month line.</span>
                </p>
              ) : replayOrigin ? (
                <p>
                  Turned back to <strong>{longDate(replayOrigin)}</strong>.{" "}
                  <span className="muted">The pencil is what {MODEL_LABEL[focus]} expected then; the violet ink is what happened.</span>
                </p>
              ) : (
                <p>
                  <strong>Drag the chart sideways</strong> <span className="muted">to turn back time and test an old forecast.</span>
                </p>
              )}
            </div>
            <div className="drum-actions">
              <button type="button" className="btn" onClick={() => setReleaseKey((k) => k + 1)} disabled={turning || phase === "release" || phase === "reality"}>
                <span aria-hidden="true">↻</span> {replayOrigin ? "Replay" : "Redraw futures"}
              </button>
              {replayOrigin && (
                <button type="button" className="btn primary" onClick={() => replay(todayIndex)} disabled={turning}>
                  Back to today
                </button>
              )}
            </div>
            <Scrubber ref={rulerRef} origins={origins} value={stopIndex} onChange={replay} disabled={!origins.length} />
          </div>
        )}

        {showMarket && (
          <div className="market-compare" aria-live="polite">
            {replayOrigin ? (
              <p className="muted">The S&amp;P 500 line is hidden while the chart is turned back. Return to today to see it.</p>
            ) : bench.isError ? (
              <p className="muted">S&amp;P 500 data isn't available right now.</p>
            ) : market ? (
              <MarketReadout sym={sym} c={market} />
            ) : (
              <p className="muted">Loading the S&amp;P 500…</p>
            )}
          </div>
        )}

        {replayOrigin && tally && <TallyCard tally={tally} level={level} show={phase === "done"} />}
      </section>

      {/* ------------------------------------------------ the outlook, in plain words */}
      {!tooNew && tiles.length > 0 && (
        <section className="stock-section" aria-labelledby="outlook-title">
          <header className="section-head">
            <h2 id="outlook-title">
              {replayOrigin ? `What ${MODEL_LABEL[focus]} expected on ${shortDate(replayOrigin)}` : `What ${MODEL_LABEL[focus]} expects`}
            </h2>
            {!terminal && endBand && (
              <p className="section-lede">
                Counted from the {paths.length} pencilled futures on the chart. A chance near 50% means the model has no real idea which
                way it goes, which is the usual, honest answer.
                {focusShape && last && <> {describeLine(focus, focusShape, last.close)}</>}
              </p>
            )}
          </header>
          <Outlook
            tiles={tiles}
            start={view.start}
            level={level}
            model={focus}
            showActual={!!replayOrigin && phase === "done"}
            totals={totals}
          />
        </section>
      )}

      {showPatterns && (
        <section className="stock-section stock-patterns">
          {patterns.data ? (
            <PatternPanel data={patterns.data} selected={pickedMarker} symbol={sym} />
          ) : patterns.isLoading ? (
            <div className="skeleton" style={{ height: 200 }} aria-hidden="true" />
          ) : null}
        </section>
      )}

      {/* ------------------------------------------------ the track record and the ride */}
      <div className="stock-lower">
        {scorecard.data && (
          <section className="stock-section" aria-labelledby="scorecard-title">
            <ScorecardPanel card={scorecard.data} compact={terminal} />
          </section>
        )}
        {m && (
          <section className="stock-section" aria-labelledby="metrics-title">
            <h2 id="metrics-title">{terminal ? "Risk" : "How bumpy has the ride been?"}</h2>
            <MetricsLedger m={m} compact={terminal} />
          </section>
        )}
      </div>

      {!tooNew && last && forecasts.data && (
        <ModelGuide
          key={density}
          sym={sym}
          lastClose={last.close}
          forecasts={forecasts.data}
          scorecard={scorecard.data}
          focus={focus}
          defaultOpen={false}
          onShow={(mk) => {
            setFocus(mk);
            setReleaseKey((k) => k + 1);
            document.querySelector(".stock-chart")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
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
}: {
  tally: Tally;
  level: number;
  show: boolean;
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
        </>
      )}
    </div>
  );
}

function MarketReadout({ sym, c }: { sym: string; c: Comparison }) {
  const s = signedPct(c.stock);
  const mk = signedPct(c.market);
  const pts = Math.abs(c.diff * 100).toFixed(1);
  const verdict =
    Math.abs(c.diff) < 0.005
      ? "About the same as the market."
      : c.diff > 0
        ? `${sym} did ${pts} points better than the market.`
        : `${sym} did ${pts} points worse than the market.`;
  return (
    <>
      <p className="market-figures">
        <span className="kicker">Since {longDate(c.start)}</span>
        <span>
          {sym} <span className={`mono ${s.dir}`}>{s.text}</span>
        </span>
        <span>
          <Term k="benchmark">S&amp;P 500</Term> <span className={`mono ${mk.dir}`}>{mk.text}</span>
        </span>
        <strong>{verdict}</strong>
      </p>
      <p className="market-note muted">
        Dashed line: the S&amp;P 500 (via the SPY fund), scaled to start at {sym}'s price on that day, so you can see how the same money
        would have done in the whole market. It's a look back, not a forecast.
      </p>
    </>
  );
}
