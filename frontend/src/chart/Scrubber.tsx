import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { shortDate } from "../format";
import "./Scrubber.css";

interface Props {
  /** Past origins (oldest first). The last stop is always "Today". */
  origins: string[];
  /** Index into [...origins, "today"]. */
  value: number;
  onChange: (index: number) => void;
  disabled?: boolean;
}

/** Timeline with detents at each backtest origin (Rewind & Release). Drag, click, or arrow keys. */
export function Scrubber({ origins, value, onChange, disabled }: Props) {
  const stops = [...origins, "today"];
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState<number | null>(null);
  const pos = (i: number) => (stops.length > 1 ? (i / (stops.length - 1)) * 100 : 100);

  const indexAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return { i: Math.round(f * (stops.length - 1)), pct: f * 100 };
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragX(indexAt(e.clientX).pct);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragX === null) return;
    setDragX(indexAt(e.clientX).pct);
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (dragX === null) return;
    setDragX(null);
    const { i } = indexAt(e.clientX);
    if (i !== value) onChange(i);
  };
  const onLost = () => {
    if (dragX === null) return; // pointerup already handled it
    const i = Math.round((dragX / 100) * (stops.length - 1));
    setDragX(null);
    if (i !== value) onChange(i);
  };
  const onKey = (e: KeyboardEvent) => {
    setDragX(null);
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
  return (
    <div className={`scrubber${disabled ? " disabled" : ""}`}>
      <div
        ref={trackRef}
        className="scrubber-track"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Rewind to a past forecast date"
        aria-valuemin={0}
        aria-valuemax={stops.length - 1}
        aria-valuenow={value}
        aria-valuetext={current === "today" ? "Today" : `Rewound to ${shortDate(current)}`}
        aria-disabled={disabled}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => setDragX(null)}
        onLostPointerCapture={onLost}
        onKeyDown={onKey}
      >
        <span className="scrubber-line" />
        <span className="scrubber-past" style={{ width: `${dragX ?? pos(value)}%` }} />
        {stops.map((s, i) => (
          <span
            key={s}
            className={`scrubber-notch${i === value ? " on" : ""}${s === "today" ? " today" : ""}`}
            style={{ left: `${pos(i)}%` }}
          />
        ))}
        <span className={`scrubber-thumb${dragX !== null ? " dragging" : ""}`} style={{ left: `${dragX ?? pos(value)}%` }} />
      </div>
      <div className="scrubber-scale mono" aria-hidden="true">
        <span>{origins[0] ? shortDate(origins[0]) : ""}</span>
        <span>{current === "today" ? "Today" : shortDate(current)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
