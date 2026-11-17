import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ForecastPoint, ModelKey, PatternHit, PriceBar } from "../api/types";
import { MODEL_LABEL, longDate, shortDate } from "../format";
import { SPRINGS, nearestStop, project, rubberBand, stepSpring, type SpringSpec } from "./spring";
import { bandAt, easeOut, futurePaths } from "./trails";
import "./FuturesChart.css";

export type ChartMode = "candles" | "line";
export type Range = "1M" | "6M" | "1Y" | "5Y";
/** turning = the drum is being dragged or is spinning to a date (the pen is lifted). */
export type Phase = "idle" | "turning" | "release" | "reality" | "done";

export const RANGE_BARS: Record<Range, number> = { "1M": 22, "6M": 126, "1Y": 252, "5Y": 1300 };
/** Bars of blank paper kept ahead of the pen for the forecast window (30 trading days + margin). */
const AHEAD = 33;
const RELEASE_MS = 1300;
const REALITY_MS = 1300;
/** Movement before a press becomes a drag (craft §5). */
const DRAG_SLOP = 10;
/** Grid of the graph paper, in CSS px (must match FuturesChart.css). */
const GRID_MINOR = 12;
const GRID_MAJOR = 60;

export interface FuturesChartProps {
  /** Full price history. The chart itself hides everything after the pen. */
  bars: PriceBar[];
  mode: ChartMode;
  range: Range;
  focus: ModelKey;
  /** Forecasts made at the committed origin (today's, or a past replay's). */
  forecasts: Partial<Record<ModelKey, ForecastPoint[]>>;
  visibleModels: ModelKey[];
  level: number;
  emphasis: "downside" | "balanced" | "full model spread";
  /** Committed origin date; null = today. */
  origin: string | null;
  /** Past forecast dates the drum can rest on (oldest first). Today is always the last stop. */
  stops: string[];
  /** Called when the drum comes to rest on a stop (index into [...stops, today]). */
  onOriginChange: (index: number) => void;
  /** Live pen position in stop units (0 … stops.length), for the ruler. */
  onPen?: (pos: number) => void;
  /** Actual prices after the origin (replay only). */
  reality?: { date: string; close: number }[];
  /** Bump to (re)play the release animation. */
  releaseKey: number;
  onPhase?: (p: Phase) => void;
  onHover?: (bar: PriceBar | null) => void;
  markers?: PatternHit[];
  onMarkerClick?: (date: string) => void;
  /** S&P 500 closes already rebased to the stock's price (dashed comparison line). */
  benchmark?: { date: string; value: number }[];
}

const toTime = (iso: string) => (Date.parse(`${iso}T00:00:00Z`) / 1000) as UTCTimestamp;
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
/** Hex color + alpha -> rgba() (the chart library can't parse CSS color-mix). */
const alpha = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Index of the last bar on or before `iso` (bars sorted by date). */
function indexOnOrBefore(bars: PriceBar[], iso: string): number {
  let lo = 0;
  let hi = bars.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].date <= iso) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export function FuturesChart(props: FuturesChartProps) {
  const { bars, mode, range, focus, forecasts, visibleModels, level, reality, releaseKey, origin, stops } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const envHiRef = useRef<ISeriesApi<"Line"> | null>(null);
  const envLoRef = useRef<ISeriesApi<"Line"> | null>(null);
  const benchRef = useRef<ISeriesApi<"Line"> | null>(null);
  const progress = useRef({ release: 1, reality: 1 });
  const propsRef = useRef(props);
  propsRef.current = props;

  // ---- the drum's position -----------------------------------------------------------------
  // The pen sits at a (fractional) bar index of the full history. Turning the drum moves it.
  const stopIdx = useMemo(() => [...stops.map((d) => indexOnOrBefore(bars, d)), bars.length - 1], [bars, stops]);
  const restIdx = origin ? (stopIdx[stops.indexOf(origin)] ?? bars.length - 1) : bars.length - 1;
  const [moving, setMoving] = useState(false);
  const [settleKey, setSettleKey] = useState(0);
  const pen = useRef(NaN);
  const movingRef = useRef(false);
  movingRef.current = moving;
  const derived = useRef({ stopIdx, restIdx });
  derived.current = { stopIdx, restIdx };
  const anim = useRef<{ raf: number; target: number; index: number; v: number; spec: SpringSpec; last: number } | null>(null);
  const gesture = useRef<{
    id: number;
    x0: number;
    y0: number;
    from: number;
    raw: number;
    state: "pending" | "drag";
    samples: { t: number; x: number }[];
  } | null>(null);

  // What the chart shows: while turning, the whole history (masked after the pen);
  // at rest, history up to the origin plus that origin's forecasts.
  const shownBars = useMemo(() => (moving ? bars : bars.slice(0, restIdx + 1)), [bars, moving, restIdx]);
  const shownRef = useRef(shownBars);
  shownRef.current = shownBars;

  const focusPoints = forecasts[focus] ?? [];
  const paths = useMemo(() => futurePaths(focusPoints), [focusPoints]);
  const pathsRef = useRef(paths);
  pathsRef.current = paths;

  // ---- chart lifecycle -------------------------------------------------------------------
  useEffect(() => {
    const el = wrapRef.current!;
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: css("--muted"), fontFamily: css("--font-ui"), fontSize: 11 },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } }, // the drum's graph paper is the grid
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.2 } },
      timeScale: { borderVisible: false, rightOffset: 0 },
      crosshair: {
        horzLine: { labelBackgroundColor: css("--ink"), color: css("--rule-strong") },
        vertLine: { labelBackgroundColor: css("--ink"), color: css("--rule-strong") },
      },
      // Dragging the chart turns the drum, so the library's own pan and zoom are off.
      handleScroll: false,
      handleScale: false,
    });
    chartRef.current = chart;
    volRef.current = chart.addHistogramSeries({ priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });
    const hidden = { color: "rgba(0,0,0,0)", lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, lineWidth: 1 as const };
    envHiRef.current = chart.addLineSeries(hidden);
    envLoRef.current = chart.addLineSeries(hidden);
    benchRef.current = chart.addLineSeries({
      color: css("--muted"),
      lineWidth: 2,
      lineStyle: 2, // dashed: distinguishable from the price without relying on color
      title: "S&P 500",
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });

    const redraw = () => requestAnimationFrame(draw);
    chart.timeScale().subscribeVisibleLogicalRangeChange(redraw);
    const ro = new ResizeObserver(redraw);
    ro.observe(el);

    const onMove = (p: MouseEventParams<Time>) => {
      const cb = propsRef.current.onHover;
      if (!cb) return;
      if (!p.time || !mainRef.current || movingRef.current) return cb(null);
      const iso = new Date((p.time as number) * 1000).toISOString().slice(0, 10);
      cb(shownRef.current.find((b) => b.date === iso) ?? null);
    };
    chart.subscribeCrosshairMove(onMove);
    const onClick = (p: MouseEventParams<Time>) => {
      const cb = propsRef.current.onMarkerClick;
      if (!cb || !p.time || movingRef.current) return;
      const iso = new Date((p.time as number) * 1000).toISOString().slice(0, 10);
      if (propsRef.current.markers?.some((m) => m.date === iso)) cb(iso);
    };
    chart.subscribeClick(onClick);

    return () => {
      ro.disconnect();
      chart.unsubscribeCrosshairMove(onMove);
      chart.unsubscribeClick(onClick);
      chart.remove();
      chartRef.current = null;
      mainRef.current = null;
      if (anim.current) cancelAnimationFrame(anim.current.raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme (density) changes: recolor the chart.
  useEffect(() => {
    const obs = new MutationObserver(() => {
      chartRef.current?.applyOptions({
        layout: { textColor: css("--muted") },
        crosshair: { horzLine: { labelBackgroundColor: css("--ink") }, vertLine: { labelBackgroundColor: css("--ink") } },
      });
      benchRef.current?.applyOptions({ color: css("--muted") });
      styleMain();
      requestAnimationFrame(draw);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-density"] });
    return () => obs.disconnect();
  });

  function styleMain() {
    const s = mainRef.current;
    if (!s) return;
    if (propsRef.current.mode === "candles") {
      // Up = hollow teal, down = filled rust: direction is readable without color.
      s.applyOptions({
        upColor: "rgba(0,0,0,0)",
        borderUpColor: css("--up"),
        wickUpColor: css("--up"),
        downColor: css("--down"),
        borderDownColor: css("--down"),
        wickDownColor: css("--down"),
      });
    } else {
      s.applyOptions({ color: css("--reality"), lineWidth: 2 }); // the price is the ink
    }
  }

  // Main series: recreate when the mode changes.
  useEffect(() => {
    const chart = chartRef.current!;
    if (mainRef.current) chart.removeSeries(mainRef.current);
    mainRef.current =
      mode === "candles"
        ? chart.addCandlestickSeries({ priceLineVisible: false, lastValueVisible: false })
        : chart.addLineSeries({ priceLineVisible: false, lastValueVisible: false, crosshairMarkerRadius: 3 });
    styleMain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ---- keeping the pen where it belongs ----------------------------------------------------
  const lastBarsRef = useRef<PriceBar[] | null>(null);
  useLayoutEffect(() => {
    const newStock = lastBarsRef.current !== bars;
    lastBarsRef.current = bars;
    if (newStock || !Number.isFinite(pen.current)) {
      // New stock (or first paint): put the pen on the origin without turning.
      stopAnim();
      pen.current = restIdx;
      if (movingRef.current) setMoving(false);
      emitPen();
      return;
    }
    if (anim.current && anim.current.target === restIdx) return; // already turning there
    if (!movingRef.current && Math.abs(pen.current - restIdx) < 0.01) return; // already resting there
    if (gesture.current?.state === "drag") return; // the hand on the drum wins
    // Someone picked a date elsewhere (ruler, keyboard, "Back to today"): turn the drum to it.
    const i = derived.current.stopIdx.indexOf(restIdx);
    spinTo(i < 0 ? derived.current.stopIdx.length - 1 : i, 0, SPRINGS.drum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restIdx, bars]);

  function startMoving() {
    if (!movingRef.current) {
      movingRef.current = true;
      setMoving(true);
      propsRef.current.onPhase?.("turning");
      chartRef.current?.applyOptions({ crosshair: { vertLine: { visible: false }, horzLine: { visible: false } } });
    }
  }

  function stopAnim() {
    if (anim.current) cancelAnimationFrame(anim.current.raf);
    anim.current = null;
  }

  function spinTo(index: number, v0: number, spec: SpringSpec) {
    const target = derived.current.stopIdx[index];
    stopAnim();
    startMoving();
    if (reducedMotion()) {
      pen.current = target;
      frame();
      settle(index);
      return;
    }
    const a = { raf: 0, target, index, v: v0, spec, last: performance.now() };
    anim.current = a;
    const tick = (now: number) => {
      if (anim.current !== a) return;
      const dt = Math.min(1 / 30, Math.max(0, (now - a.last) / 1000));
      a.last = now;
      const [x, v] = stepSpring(pen.current, a.v, a.target, a.spec, dt);
      pen.current = x;
      a.v = v;
      frame();
      if (Math.abs(x - a.target) < 0.02 && Math.abs(v) < 0.2) {
        pen.current = a.target;
        anim.current = null;
        settle(a.index);
      } else a.raf = requestAnimationFrame(tick);
    };
    a.raf = requestAnimationFrame(tick);
  }

  /** The drum came to rest on a stop: commit it, lower the pen, release the futures. */
  function settle(index: number) {
    const p = propsRef.current;
    const isToday = index === derived.current.stopIdx.length - 1;
    const next = isToday ? null : p.stops[index];
    if (next !== p.origin) p.onOriginChange(index); // batched with the state below: one render
    movingRef.current = false;
    setMoving(false);
    setSettleKey((k) => k + 1);
    chartRef.current?.applyOptions({ crosshair: { vertLine: { visible: true }, horzLine: { visible: true } } });
    emitPen();
  }

  function emitPen() {
    const cb = propsRef.current.onPen;
    if (!cb) return;
    const s = derived.current.stopIdx;
    const x = pen.current;
    if (!s.length || !Number.isFinite(x)) return;
    if (x <= s[0]) return cb(0);
    for (let i = 1; i < s.length; i++) {
      if (x <= s[i]) return cb(i - 1 + (x - s[i - 1]) / Math.max(1e-9, s[i] - s[i - 1]));
    }
    cb(s.length - 1);
  }

  /** Scroll the time scale so the pen sits at the same place on screen for every date. */
  function applyRange() {
    const chart = chartRef.current;
    if (!chart || !Number.isFinite(pen.current)) return;
    const span = RANGE_BARS[propsRef.current.range];
    chart.timeScale().setVisibleLogicalRange({ from: pen.current - span + 1, to: pen.current + AHEAD });
  }

  function frame() {
    applyRange();
    draw();
    emitPen();
  }

  // ---- data --------------------------------------------------------------------------------
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    if (mode === "candles") {
      (main as ISeriesApi<"Candlestick">).setData(
        shownBars.map((b) => ({ time: toTime(b.date), open: b.open, high: b.high, low: b.low, close: b.close })),
      );
    } else {
      (main as ISeriesApi<"Line">).setData(shownBars.map((b) => ({ time: toTime(b.date), value: b.close })));
    }
    const up = css("--up");
    const down = css("--down");
    volRef.current!.setData(
      shownBars.map((b, i) => ({
        time: toTime(b.date),
        value: b.volume,
        color: alpha(i && b.close < shownBars[i - 1].close ? down : up, 0.22),
      })),
    );
    // Envelope series extend the time axis into the forecast window and keep the widest band
    // in autoscale, so the overlay always has coordinates to draw on. None while turning.
    const lastDate = shownBars.length ? shownBars[shownBars.length - 1].date : "";
    const env = new Map<string, { lo: number; hi: number }>();
    if (!moving) {
      for (const m of [focus, ...visibleModels]) {
        for (const p of forecasts[m] ?? []) {
          if (p.date <= lastDate) continue;
          const b = bandAt(p, Math.max(level, m === focus ? level : 50));
          const cur = env.get(p.date);
          env.set(p.date, { lo: Math.min(cur?.lo ?? Infinity, b.lo, p.mean), hi: Math.max(cur?.hi ?? -Infinity, b.hi, p.mean) });
        }
      }
      for (const r of reality ?? []) {
        const cur = env.get(r.date);
        env.set(r.date, { lo: Math.min(cur?.lo ?? Infinity, r.close), hi: Math.max(cur?.hi ?? -Infinity, r.close) });
      }
    }
    const envPts = [...env.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    envHiRef.current!.setData(envPts.map(([d, v]) => ({ time: toTime(d), value: v.hi })));
    envLoRef.current!.setData(envPts.map(([d, v]) => ({ time: toTime(d), value: v.lo })));
    applyRange();
    requestAnimationFrame(draw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownBars, mode, range, forecasts, focus, visibleModels, level, reality, moving]);

  // S&P 500 comparison line.
  useEffect(() => {
    benchRef.current?.setData((props.benchmark ?? []).map((p) => ({ time: toTime(p.date), value: p.value })));
  }, [props.benchmark]);

  // Pattern markers: teal ▲ below "bullish" candles, rust ▼ above "bearish", ink dot for neutral.
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const last = shownBars.length ? shownBars[shownBars.length - 1].date : "";
    const ms =
      mode === "candles" && props.markers && !moving
        ? props.markers
            .filter((m) => m.date <= last)
            .map((m) => ({
              time: toTime(m.date),
              position: m.direction === "bearish" ? ("aboveBar" as const) : ("belowBar" as const),
              color: css(m.direction === "bullish" ? "--up" : m.direction === "bearish" ? "--down" : "--ink-soft"),
              shape: m.direction === "bullish" ? ("arrowUp" as const) : m.direction === "bearish" ? ("arrowDown" as const) : ("circle" as const),
              size: 0.8,
            }))
        : [];
    main.setMarkers(ms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.markers, shownBars, mode, moving]);

  // Release → reality animation: after the drum settles, or when asked to replay.
  useEffect(() => {
    const onPhase = propsRef.current.onPhase;
    if (movingRef.current) return;
    if (reducedMotion() || (releaseKey === 0 && settleKey === 0)) {
      progress.current = { release: 1, reality: 1 };
      requestAnimationFrame(draw);
      onPhase?.("done");
      return;
    }
    let raf = 0;
    const start = performance.now();
    const hasReality = !!propsRef.current.reality?.length;
    let phase: Phase = "release";
    onPhase?.("release");
    const tick = (now: number) => {
      const t = now - start;
      const rel = easeOut(t / RELEASE_MS);
      const realT = hasReality ? Math.max(0, (t - RELEASE_MS - 150) / REALITY_MS) : 1;
      progress.current = { release: rel, reality: hasReality ? Math.min(1, realT) : 1 };
      if (hasReality && phase === "release" && t > RELEASE_MS + 150) {
        phase = "reality";
        onPhase?.("reality");
      }
      draw();
      if (rel < 1 || progress.current.reality < 1) raf = requestAnimationFrame(tick);
      else onPhase?.("done");
    };
    progress.current = { release: 0, reality: 0 };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseKey, settleKey, moving]); // grabbing the drum cancels a release in progress

  // ---- turning the drum by hand --------------------------------------------------------------
  const canTurn = stops.length > 0;

  function barWidth() {
    const ts = chartRef.current?.timeScale();
    const a = ts?.logicalToCoordinate(0 as never);
    const b = ts?.logicalToCoordinate(10 as never);
    return a != null && b != null && b !== a ? (b - a) / 10 : 6;
  }

  function capture(e: ReactPointerEvent<HTMLDivElement>) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone (or synthetic): the drag still works while it stays over the chart */
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!canTurn || e.button !== 0) return;
    const caught = anim.current !== null; // grabbing a spinning drum stops it where it is
    stopAnim();
    gesture.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      from: pen.current,
      raw: pen.current,
      state: caught ? "drag" : "pending",
      samples: [{ t: e.timeStamp, x: pen.current }],
    };
    if (caught) {
      capture(e);
      startMoving();
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (g.state === "pending") {
      if (Math.abs(dy) > DRAG_SLOP && Math.abs(dy) > Math.abs(dx)) {
        gesture.current = null; // a vertical swipe scrolls the page
        return;
      }
      if (Math.abs(dx) < DRAG_SLOP) return;
      g.state = "drag";
      g.x0 += Math.sign(dx) * DRAG_SLOP; // keep the grab point under the finger: no jump
      capture(e);
      startMoving();
    }
    // Dragging right pulls older paper under the pen.
    const raw = g.from - (e.clientX - g.x0) / barWidth();
    g.raw = raw;
    const s = derived.current.stopIdx;
    const lo = s[0];
    const hi = s[s.length - 1];
    const dim = RANGE_BARS[propsRef.current.range] / 2;
    pen.current = raw < lo ? lo - rubberBand(lo - raw, dim) : raw > hi ? hi + rubberBand(raw - hi, dim) : raw;
    g.samples.push({ t: e.timeStamp, x: raw });
    if (g.samples.length > 8) g.samples.shift();
    frame();
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    if (g.state !== "drag") return;
    // Release velocity from the last ~100 ms of movement, in bars per second.
    const recent = g.samples.filter((s) => e.timeStamp - s.t < 100);
    const first = recent[0] ?? g.samples[0];
    const last = recent[recent.length - 1] ?? g.samples[g.samples.length - 1];
    const dt = (last.t - first.t) / 1000;
    const v = cancelled || dt <= 0 ? 0 : (last.x - first.x) / dt;
    const s = derived.current.stopIdx;
    const aim = Math.min(s[s.length - 1], Math.max(s[0], project(pen.current, v)));
    const flicked = Math.abs(v * barWidth()) > 400; // px/s
    spinTo(nearestStop(s, aim), v, flicked ? SPRINGS.flick : SPRINGS.settle);
  }

  // ---- overlay drawing --------------------------------------------------------------------
  function draw() {
    const chart = chartRef.current;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const main = mainRef.current;
    if (!chart || !canvas || !wrap || !main) return;
    const p = propsRef.current;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const ts = chart.timeScale();
    const plotW = w - chart.priceScale("right").width();
    const plotH = h - ts.height();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, plotW, h);
    ctx.clip();

    const x = (iso: string) => ts.timeToCoordinate(toTime(iso));
    const y = (v: number) => main.priceToCoordinate(v);
    const turning = movingRef.current;
    const all = p.bars;
    if (!all.length || !Number.isFinite(pen.current)) return ctx.restore();

    // Where the pen is: a fractional bar while turning, the origin bar at rest.
    const L = turning ? Math.min(all.length - 1, Math.max(0, pen.current)) : shownRef.current.length - 1;
    const i0 = Math.floor(L);
    const i1 = Math.min(all.length - 1, i0 + 1);
    const f = L - i0;
    const penPrice = all[i0].close + (all[i1].close - all[i0].close) * f;
    const penDate = all[Math.round(L)].date;
    const x0 = turning ? ts.logicalToCoordinate(pen.current as never) : x(all[i0].date);
    const y0 = y(penPrice);
    if (x0 === null || y0 === null) return ctx.restore();

    const surface = css("--surface");
    const ink = css("--reality");
    // The drawn model wears its team colour (tokens --m-*); fall back to pencil grey.
    const pencil = css(`--m-${p.focus}`) || css("--forecast");
    const pencilText = pencil;
    const down = css("--down");

    if (turning) {
      // Unwritten paper after the pen: hide everything the model couldn't have seen.
      ctx.fillStyle = surface;
      ctx.fillRect(x0, 0, plotW - x0, h);
      const minor = css("--grid-minor");
      const major = css("--grid-major");
      for (let gx = Math.ceil(x0 / GRID_MINOR) * GRID_MINOR; gx < plotW; gx += GRID_MINOR) {
        ctx.fillStyle = minor;
        ctx.fillRect(gx, 0, 1, h);
        if (gx % GRID_MAJOR === 0) {
          ctx.fillStyle = major;
          ctx.fillRect(gx, 0, 1, h);
        }
      }
      for (let gy = 0; gy < h; gy += GRID_MINOR) {
        ctx.fillStyle = minor;
        ctx.fillRect(x0, gy, plotW - x0, 1);
        if (gy % GRID_MAJOR === 0) {
          ctx.fillStyle = major;
          ctx.fillRect(x0, gy, plotW - x0, 1);
        }
      }
    } else {
      drawFutures();
    }

    // The pen: a fine arm from the top, a nib on the price (filled = inking, hollow = lifted).
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 + 0.5, 22);
    ctx.lineTo(x0 + 0.5, plotH);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x0, y0, turning ? 5 : 4, 0, Math.PI * 2);
    if (turning) {
      ctx.fillStyle = surface;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = ink;
      ctx.fill();
    }
    const isToday = !turning && !p.origin;
    tag(isToday ? `Today · ${shortDate(penDate)}` : longDate(penDate), x0, 11, ink);
    ctx.restore();

    function drawFutures() {
      const { release, reality: realProg } = progress.current;
      const fpts = p.forecasts[p.focus] ?? [];
      const H = fpts.length;
      const steps = release * H;
      const trailAlpha = parseFloat(css("--trail-alpha")) || 0.07;

      // The drawn model's range, in its team colour, revealed with the release.
      if (H) {
        const shown = Math.max(1, Math.ceil(steps));
        const top: [number, number][] = [[x0!, y0!]];
        const bot: [number, number][] = [[x0!, y0!]];
        for (let i = 0; i < shown; i++) {
          const b = bandAt(fpts[i], p.level);
          const xi = x(fpts[i].date);
          const hi = y(b.hi);
          const lo = y(b.lo);
          if (xi === null || hi === null || lo === null) continue;
          top.push([xi, hi]);
          bot.push([xi, lo]);
        }
        ctx.beginPath();
        top.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
        [...bot].reverse().forEach(([a, b]) => ctx.lineTo(a, b));
        ctx.closePath();
        ctx.fillStyle = pencil;
        ctx.globalAlpha = 0.1;
        ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1;
        ctx.strokeStyle = pencil;
        ctx.setLineDash([]);
        ctx.beginPath();
        top.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
        ctx.stroke();
        ctx.beginPath();
        bot.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
        if (p.emphasis === "downside") {
          ctx.strokeStyle = down; // conservative profiles: emphasise the downside edge
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.9;
          ctx.setLineDash([5, 4]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        if (p.emphasis === "downside" && release >= 1 && bot.length > 1) {
          const [bx, by] = bot[bot.length - 1];
          label("downside edge", bx, by + 14, down, "right");
        }
      }

      // Possible futures, drawn faintly in the same colour.
      const paths = pathsRef.current;
      if (paths.length && H) {
        ctx.strokeStyle = pencilText;
        ctx.lineWidth = 1;
        ctx.globalAlpha = trailAlpha * (p.emphasis === "full model spread" ? 1.25 : 1);
        const xs = fpts.map((fp) => x(fp.date));
        const full = Math.floor(steps);
        const frac = steps - full;
        for (const path of paths) {
          ctx.beginPath();
          ctx.moveTo(x0!, y0!);
          for (let i = 0; i < Math.min(full, H); i++) {
            const xi = xs[i];
            const yi = y(path[i]);
            if (xi === null || yi === null) continue;
            ctx.lineTo(xi, yi);
          }
          if (full < H && frac > 0) {
            const xa = full ? xs[full - 1] : x0;
            const ya = full ? y(path[full - 1]) : y0;
            const xb = xs[full];
            const yb = y(path[full]);
            if (xa !== null && ya !== null && xb !== null && yb !== null) ctx.lineTo(xa + (xb - xa) * frac, ya + (yb - ya) * frac);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Each player's central guess, in its team colour and dash. The drawn model is heavier.
      const endLabels: { text: string; x: number; y: number; color: string }[] = [];
      const dashes: Record<string, number[]> = { naive: [2, 3], arima: [6, 3], ets: [10, 3, 2, 3], prophet: [1, 4], garch: [12, 4] };
      for (const m of new Set([...p.visibleModels, p.focus])) {
        const pts = p.forecasts[m];
        if (!pts?.length || release < 1) continue;
        if (m === "garch") continue; // GARCH has no direction; its cone is shown when focused
        const isFocus = m === p.focus;
        ctx.beginPath();
        ctx.moveTo(x0!, y0!);
        for (const fp of pts) {
          const xi = x(fp.date);
          const yi = y(fp.mean);
          if (xi !== null && yi !== null) ctx.lineTo(xi, yi);
        }
        ctx.setLineDash(dashes[m] ?? []);
        ctx.lineWidth = isFocus ? 2 : 1.25;
        ctx.strokeStyle = css(`--m-${m}`) || pencil;
        ctx.globalAlpha = isFocus ? 1 : 0.8;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        const end = pts[pts.length - 1];
        const ex = x(end.date);
        const ey = y(end.mean);
        if (ex !== null && ey !== null) endLabels.push({ text: MODEL_LABEL[m] ?? m, x: Math.min(ex, plotW) - 6, y: ey, color: css(`--m-${m}`) || pencil });
      }
      endLabels.sort((a, b) => a.y - b.y);
      for (let i = 1; i < endLabels.length; i++) {
        if (endLabels[i].y - endLabels[i - 1].y < 13) endLabels[i].y = endLabels[i - 1].y + 13;
      }
      // On narrow charts the names pile up on the fan; the lineup's card colours are the legend there.
      if (plotW >= 480) for (const l of endLabels) label(l.text, l.x, l.y - 9, l.color, "right");

      // Reality, inked in heavy navy through the coloured futures.
      if (p.reality?.length && realProg > 0) {
        const pts = p.reality;
        const upto = realProg * pts.length;
        ctx.beginPath();
        ctx.moveTo(x0!, y0!);
        let hx: number = x0!;
        let hy: number = y0!;
        for (let i = 0; i < Math.min(Math.ceil(upto), pts.length); i++) {
          const xi = x(pts[i].date);
          const yi = y(pts[i].close);
          if (xi === null || yi === null) continue;
          const k = i + 1 > upto ? upto - i : 1;
          hx = hx + (xi - hx) * k;
          hy = hy + (yi - hy) * k;
          ctx.lineTo(hx, hy);
        }
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.fillStyle = ink;
        ctx.fill();
        if (realProg >= 1) {
          const ly = hy - 20 < 30 ? hy + 20 : hy - 20;
          label("what actually happened", Math.min(hx, plotW - 4), ly, ink, "right");
        }
      }
    }

    function label(text: string, lx: number, ly: number, color: string, align: CanvasTextAlign) {
      ctx.font = `600 11px ${css("--font-ui")}`;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.lineWidth = 4;
      ctx.strokeStyle = surface;
      ctx.lineJoin = "round";
      ctx.strokeText(text, lx, ly);
      ctx.fillStyle = color;
      ctx.fillText(text, lx, ly);
    }

    /** The pen's date tag: a small rounded label centred on the arm, kept inside the plot. */
    function tag(text: string, cx: number, cy: number, color: string) {
      ctx.font = `600 11px ${css("--font-ui")}`;
      const tw = ctx.measureText(text).width + 14;
      const left = Math.min(plotW - tw - 2, Math.max(2, cx - tw / 2));
      ctx.fillStyle = css("--surface-2");
      ctx.strokeStyle = color;
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(left, cy - 9, tw, 18, 9);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(text, left + 7, cy + 0.5);
    }
  }

  return (
    <div
      className={`futures-chart${canTurn ? " can-turn" : ""}${moving ? " turning" : ""}`}
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => onPointerUp(e)}
      onPointerCancel={(e) => onPointerUp(e, true)}
    >
      <canvas ref={canvasRef} className="futures-overlay" aria-hidden="true" />
    </div>
  );
}
