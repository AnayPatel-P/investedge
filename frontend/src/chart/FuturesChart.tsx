import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";
import type { ForecastPoint, ModelKey, PriceBar } from "../api/types";
import { MODEL_LABEL } from "../format";
import { bandAt, easeOut, samplePaths } from "./trails";
import "./FuturesChart.css";

export type ChartMode = "candles" | "line";
export type Range = "1M" | "6M" | "1Y" | "5Y";
export type Phase = "idle" | "release" | "reality" | "done";

const RANGE_BARS: Record<Range, number> = { "1M": 22, "6M": 126, "1Y": 252, "5Y": 1300 };
const TRAILS = 180;
const RELEASE_MS = 1500;
const REALITY_MS = 1300;

export interface FuturesChartProps {
  bars: PriceBar[];
  mode: ChartMode;
  range: Range;
  focus: ModelKey;
  forecasts: Partial<Record<ModelKey, ForecastPoint[]>>;
  visibleModels: ModelKey[];
  level: number;
  emphasis: "downside" | "balanced" | "full model spread";
  /** Actual prices after the origin (replay only). */
  reality?: { date: string; close: number }[];
  /** Bump to (re)play the release animation. */
  releaseKey: number;
  replay: boolean;
  onPhase?: (p: Phase) => void;
  onHover?: (bar: PriceBar | null) => void;
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

export function FuturesChart(props: FuturesChartProps) {
  const { bars, mode, range, focus, forecasts, visibleModels, level, reality, releaseKey, replay } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const envHiRef = useRef<ISeriesApi<"Line"> | null>(null);
  const envLoRef = useRef<ISeriesApi<"Line"> | null>(null);
  const progress = useRef({ release: 1, reality: 1 });
  const propsRef = useRef(props);
  propsRef.current = props;

  const focusPoints = forecasts[focus] ?? [];
  const paths = useMemo(
    () => (focusPoints.length ? samplePaths(focusPoints, TRAILS, focusPoints.length * 31 + Math.round(focusPoints[0].mean)) : []),
    [focusPoints],
  );
  const pathsRef = useRef(paths);
  pathsRef.current = paths;

  // ---- chart lifecycle -------------------------------------------------------------------
  useEffect(() => {
    const el = wrapRef.current!;
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: css("--muted"), fontFamily: css("--font-mono"), fontSize: 11 },
      grid: { vertLines: { visible: false }, horzLines: { color: css("--rule") } },
      rightPriceScale: { borderColor: css("--rule"), scaleMargins: { top: 0.08, bottom: 0.2 } },
      timeScale: { borderColor: css("--rule"), rightOffset: 4, fixLeftEdge: true },
      crosshair: { horzLine: { labelBackgroundColor: css("--ink") }, vertLine: { labelBackgroundColor: css("--ink") } },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
    });
    chartRef.current = chart;
    volRef.current = chart.addHistogramSeries({ priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });
    const hidden = { color: "rgba(0,0,0,0)", lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, lineWidth: 1 as const };
    envHiRef.current = chart.addLineSeries(hidden);
    envLoRef.current = chart.addLineSeries(hidden);

    const redraw = () => requestAnimationFrame(draw);
    chart.timeScale().subscribeVisibleLogicalRangeChange(redraw);
    const ro = new ResizeObserver(redraw);
    ro.observe(el);

    const onMove = (p: MouseEventParams<Time>) => {
      const s = mainRef.current;
      const cb = propsRef.current.onHover;
      if (!cb) return;
      if (!p.time || !s) return cb(null);
      const iso = new Date((p.time as number) * 1000).toISOString().slice(0, 10);
      cb(propsRef.current.bars.find((b) => b.date === iso) ?? null);
    };
    chart.subscribeCrosshairMove(onMove);

    return () => {
      ro.disconnect();
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      mainRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme (density) changes: recolor the chart.
  useEffect(() => {
    const obs = new MutationObserver(() => {
      chartRef.current?.applyOptions({
        layout: { textColor: css("--muted") },
        grid: { horzLines: { color: css("--rule") } },
        rightPriceScale: { borderColor: css("--rule") },
        timeScale: { borderColor: css("--rule") },
      });
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
      s.applyOptions({ color: css("--ink"), lineWidth: 2 });
    }
  }

  // Main series: recreate when the mode changes.
  useEffect(() => {
    const chart = chartRef.current!;
    if (mainRef.current) chart.removeSeries(mainRef.current);
    mainRef.current =
      mode === "candles"
        ? chart.addCandlestickSeries({ priceLineVisible: false })
        : chart.addLineSeries({ priceLineVisible: false, crosshairMarkerRadius: 3 });
    styleMain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Data.
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    if (mode === "candles") {
      (main as ISeriesApi<"Candlestick">).setData(
        bars.map((b) => ({ time: toTime(b.date), open: b.open, high: b.high, low: b.low, close: b.close })),
      );
    } else {
      (main as ISeriesApi<"Line">).setData(bars.map((b) => ({ time: toTime(b.date), value: b.close })));
    }
    const up = css("--up");
    const down = css("--down");
    volRef.current!.setData(
      bars.map((b, i) => ({
        time: toTime(b.date),
        value: b.volume,
        color: alpha(i && b.close < bars[i - 1].close ? down : up, 0.28),
      })),
    );
    // Envelope series extend the time axis into the forecast window and keep the widest band
    // in autoscale, so the overlay always has coordinates to draw on.
    const lastDate = bars.length ? bars[bars.length - 1].date : "";
    const env = new Map<string, { lo: number; hi: number }>();
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
    const envPts = [...env.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    envHiRef.current!.setData(envPts.map(([d, v]) => ({ time: toTime(d), value: v.hi })));
    envLoRef.current!.setData(envPts.map(([d, v]) => ({ time: toTime(d), value: v.lo })));

    // Visible window.
    const n = bars.length;
    const horizon = envPts.length;
    const span = replay ? 110 : RANGE_BARS[range];
    chartRef.current!.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - span), to: n - 1 + horizon + 3 });
    requestAnimationFrame(draw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, mode, range, forecasts, focus, visibleModels, level, reality, replay]);

  // Release → reality animation.
  useEffect(() => {
    const onPhase = propsRef.current.onPhase;
    if (reducedMotion() || releaseKey === 0) {
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
      const realT = hasReality ? Math.max(0, (t - RELEASE_MS - 200) / REALITY_MS) : 1;
      progress.current = { release: rel, reality: hasReality ? Math.min(1, realT) : 1 };
      if (hasReality && phase === "release" && t > RELEASE_MS + 200) {
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
  }, [releaseKey]);

  // ---- overlay drawing --------------------------------------------------------------------
  function draw() {
    const chart = chartRef.current;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const env = envHiRef.current;
    if (!chart || !canvas || !wrap || !env) return;
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
    // Keep drawing out of the price-axis gutter.
    const plotW = w - chart.priceScale("right").width();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, plotW, h);
    ctx.clip();

    const ts = chart.timeScale();
    const x = (iso: string) => ts.timeToCoordinate(toTime(iso));
    const y = (v: number) => env.priceToCoordinate(v);
    const last = p.bars[p.bars.length - 1];
    if (!last) return ctx.restore();
    const x0 = x(last.date);
    const y0 = y(last.close);
    if (x0 === null || y0 === null) return ctx.restore();

    const ochre = css("--forecast");
    const ink = css("--reality");
    const inkSoft = css("--ink-soft");
    const down = css("--down");
    const trailAlpha = parseFloat(css("--trail-alpha")) || 0.07;
    const { release, reality: realProg } = progress.current;
    const fpts = p.forecasts[p.focus] ?? [];
    const H = fpts.length;
    const steps = release * H;

    // Band (filled) for the focus model, revealed with the release.
    if (H) {
      const shown = Math.max(1, Math.ceil(steps));
      const top: [number, number][] = [[x0, y0]];
      const bot: [number, number][] = [[x0, y0]];
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
      ctx.fillStyle = ochre;
      ctx.globalAlpha = 0.13;
      ctx.fill();
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 1;
      ctx.strokeStyle = ochre;
      ctx.setLineDash([]);
      ctx.beginPath();
      top.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
      ctx.stroke();
      // Conservative profiles: emphasise the downside edge.
      ctx.beginPath();
      bot.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
      if (p.emphasis === "downside") {
        ctx.strokeStyle = down;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.9;
        ctx.setLineDash([5, 4]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      if (p.emphasis === "downside" && release >= 1 && bot.length > 1) {
        const [bx, by] = bot[bot.length - 1];
        label(ctx, "downside edge", bx, by + 14, down, "right");
      }
    }

    // Trails: many possible futures, drawn as faint light.
    const paths = pathsRef.current;
    if (paths.length && H) {
      ctx.strokeStyle = ochre;
      ctx.lineWidth = 1;
      ctx.globalAlpha = trailAlpha * (p.emphasis === "full model spread" ? 1.25 : 1);
      const xs = fpts.map((f) => x(f.date));
      const full = Math.floor(steps);
      const frac = steps - full;
      for (const path of paths) {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
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

    // Other models' central guesses: thin lines with end labels. Naive = dotted ink yardstick.
    const endLabels: { text: string; x: number; y: number; color: string }[] = [];
    const dashes: Record<string, number[]> = { naive: [2, 3], arima: [6, 3], ets: [10, 3, 2, 3], prophet: [1, 4], garch: [12, 4] };
    for (const m of new Set([...p.visibleModels, p.focus])) {
      const pts = p.forecasts[m];
      if (!pts?.length || release < 1) continue;
      if (m === "garch") continue; // GARCH has no direction; its cone is shown when focused
      const isFocus = m === p.focus;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      for (const f of pts) {
        const xi = x(f.date);
        const yi = y(f.mean);
        if (xi !== null && yi !== null) ctx.lineTo(xi, yi);
      }
      ctx.setLineDash(dashes[m] ?? []);
      ctx.lineWidth = isFocus ? 2 : 1.25;
      ctx.strokeStyle = m === "naive" ? ink : isFocus ? ochre : inkSoft;
      ctx.globalAlpha = isFocus || m === "naive" ? 0.95 : 0.7;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      const end = pts[pts.length - 1];
      const ex = x(end.date);
      const ey = y(end.mean);
      if (ex !== null && ey !== null) endLabels.push({ text: MODEL_LABEL[m] ?? m, x: Math.min(ex, plotW) - 6, y: ey, color: m === "naive" ? ink : isFocus ? css("--forecast-text") : inkSoft });
    }
    // End labels sit inside the plot, right-aligned, nudged apart so they never overlap.
    endLabels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < endLabels.length; i++) {
      if (endLabels[i].y - endLabels[i - 1].y < 13) endLabels[i].y = endLabels[i - 1].y + 13;
    }
    for (const l of endLabels) label(ctx, l.text, l.x, l.y - 9, l.color, "right");

    // Reality: drawn in ink, through the trails.
    if (p.reality?.length && realProg > 0) {
      const pts = p.reality;
      const upto = realProg * pts.length;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      let hx: number = x0;
      let hy: number = y0;
      for (let i = 0; i < Math.min(Math.ceil(upto), pts.length); i++) {
        const xi = x(pts[i].date);
        const yi = y(pts[i].close);
        if (xi === null || yi === null) continue;
        const f = i + 1 > upto ? upto - i : 1;
        hx = hx + (xi - hx) * f;
        hy = hy + (yi - hy) * f;
        ctx.lineTo(hx, hy);
      }
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.75;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = ink;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx, hy, 9, 0, Math.PI * 2);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (realProg >= 1) {
        // Above (or below, near the top edge) the end dot, inside the plot.
        const ly = hy - 22 < 12 ? hy + 22 : hy - 22;
        label(ctx, "what actually happened", Math.min(hx, plotW - 4), ly, ink, "right");
      }
    }

    // Origin marker: "today" or the replay date.
    ctx.strokeStyle = inkSoft;
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0, h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    label(ctx, p.replay ? "rewound to here" : "today", x0 - 6, 14, inkSoft, "right");
    ctx.restore();
  }

  function label(ctx: CanvasRenderingContext2D, text: string, lx: number, ly: number, color: string, align: CanvasTextAlign) {
    ctx.font = `500 11px ${css("--font-mono")}`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = css("--paper");
    ctx.globalAlpha = 0.9;
    ctx.strokeText(text, lx, ly);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.fillText(text, lx, ly);
  }

  return (
    <div className="futures-chart" ref={wrapRef}>
      <canvas ref={canvasRef} className="futures-overlay" aria-hidden="true" />
    </div>
  );
}
