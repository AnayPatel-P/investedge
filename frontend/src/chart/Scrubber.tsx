import { forwardRef, useImperativeHandle, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { shortDate } from "../format";
import "./Scrubber.css";

interface Props {
  /** Past origins (oldest first). The last stop is always "Today". */
  origins: string[];
  /** Committed index into [...origins, "today"]. */
  value: number;
  onChange: (index: number) => void;
  disabled?: boolean;
}

export interface RulerHandle {
  /** Follow the drum's pen while it turns (stop units, fractional). No React render. */
  setPen: (pos: number) => void;
}

const month = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });

/**
 * The drum's ruler: one tick per monthly forecast date, plus today. It is the accessible way to
 * turn the drum (click a tick, drag, arrow keys) and it tracks the pen while the drum spins.
 */
export const Scrubber = forwardRef<RulerHandle, Props>(function Scrubber({ origins, value, onChange, disabled }, ref) {
  const stops = [...origins, "today"];
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const pastRef = useRef<HTMLSpanElement>(null);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const pct = (i: number) => (stops.length > 1 ? (i / (stops.length - 1)) * 100 : 100);

  const place = (p: number) => {
    if (thumbRef.current) thumbRef.current.style.left = `${p}%`;
    if (pastRef.current) pastRef.current.style.width = `${p}%`;
  };
  useImperativeHandle(ref, () => ({
    setPen: (pos) => {
      if (!draggingRef.current) place(pct(pos));
    },
  }));

  const at = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return { i: Math.round(f * (stops.length - 1)), p: f * 100 };
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragging(true);
    place(at(e.clientX).p);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) place(at(e.clientX).p);
  };
  const end = (e: PointerEvent<HTMLDivElement>, commit: boolean) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const { i } = at(e.clientX);
    if (commit && i !== value) onChange(i);
    else place(pct(value));
  };
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (d) {
      e.preventDefault();
      onChange(Math.min(stops.length - 1, Math.max(0, value + d)));
    } else if (e.key === "End" || e.key === "Home") {
      e.preventDefault(); // don't scroll the page
      onChange(e.key === "End" ? stops.length - 1 : 0);
    }
  };

  const current = stops[value];
  const labelEvery = stops.length > 9 ? 2 : 1;
  return (
    <div className={`ruler${disabled ? " disabled" : ""}`}>
      <div
        ref={trackRef}
        className="ruler-track"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Turn the chart back to a past forecast date"
        aria-valuemin={0}
        aria-valuemax={stops.length - 1}
        aria-valuenow={value}
        aria-valuetext={current === "today" ? "Today" : `Rewound to ${shortDate(current)}`}
        aria-disabled={disabled}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={(e) => end(e, true)}
        onPointerCancel={(e) => end(e, false)}
        onKeyDown={onKey}
      >
        <span className="ruler-line" />
        <span ref={pastRef} className="ruler-past" style={{ width: `${pct(value)}%` }} />
        {stops.map((s, i) => (
          <span key={s} className={`ruler-tick${i === value ? " on" : ""}${s === "today" ? " today" : ""}`} style={{ left: `${pct(i)}%` }}>
            {(i % labelEvery === (stops.length - 1) % labelEvery || s === "today") && (
              <span className="ruler-label" aria-hidden="true">
                {s === "today" ? "Today" : month(s)}
              </span>
            )}
          </span>
        ))}
        <span ref={thumbRef} className={`ruler-thumb${dragging ? " dragging" : ""}`} style={{ left: `${pct(value)}%` }} />
      </div>
    </div>
  );
});
