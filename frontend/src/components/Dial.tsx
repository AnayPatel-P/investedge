import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import "./Dial.css";

export interface DialOption<T extends string | number> {
  value: T;
  label: string;
  short?: string;
}

interface Props<T extends string | number> {
  label: string;
  options: DialOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: number;
  caption?: string;
}

const SWEEP = 240; // degrees of travel, like a hardware pot
const START = -120;

/** A detented rotary control (Instrument-Bench, DECISIONS D33). Drag, click a label,
 *  or use arrow keys. Exposed to assistive tech as a slider with readable value text. */
export function Dial<T extends string | number>({ label, options, value, onChange, size = 132, caption }: Props<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const step = options.length > 1 ? SWEEP / (options.length - 1) : 0;
  const knobRef = useRef<HTMLDivElement>(null);
  const [dragAngle, setDragAngle] = useState<number | null>(null);
  const angle = dragAngle ?? START + index * step;

  const select = useCallback(
    (i: number) => {
      const clamped = Math.min(options.length - 1, Math.max(0, i));
      if (clamped !== index) {
        onChange(options[clamped].value);
        if ("vibrate" in navigator) navigator.vibrate?.(8); // tiny detent "click" on phones
      }
    },
    [index, onChange, options],
  );

  const angleFromPointer = (e: PointerEvent) => {
    const rect = knobRef.current!.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 = up, clockwise positive
    return Math.min(START + SWEEP, Math.max(START, deg));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragAngle(angleFromPointer(e));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragAngle === null) return;
    const a = angleFromPointer(e);
    setDragAngle(a);
    select(Math.round((a - START) / step));
  };
  const onPointerUp = () => setDragAngle(null); // springs to the detent via CSS

  const onKeyDown = (e: KeyboardEvent) => {
    setDragAngle(null); // keyboard always wins over a stuck drag
    const keys: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
    if (e.key in keys) {
      e.preventDefault();
      select(index + keys[e.key]);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      select(e.key === "Home" ? 0 : options.length - 1);
    }
  };

  const r = size / 2;
  return (
    <div className="dial" style={{ ["--dial-size" as string]: `${size}px` }}>
      <div className="dial-face">
        <svg className="dial-ticks" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          {Array.from({ length: (options.length - 1) * 4 + 1 }, (_, i) => {
            const a = ((START + (i * step) / 4 - 90) * Math.PI) / 180;
            const major = i % 4 === 0;
            const r1 = r - 4;
            const r2 = r - (major ? 14 : 9);
            return (
              <line
                key={i}
                x1={r + r1 * Math.cos(a)}
                y1={r + r1 * Math.sin(a)}
                x2={r + r2 * Math.cos(a)}
                y2={r + r2 * Math.sin(a)}
                className={major ? "major" : "minor"}
              />
            );
          })}
        </svg>
        <div
          ref={knobRef}
          className={`dial-knob${dragAngle !== null ? " dragging" : ""}`}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={options.length - 1}
          aria-valuenow={index}
          aria-valuetext={options[index].label}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onLostPointerCapture={onPointerUp}
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <span className="dial-pointer" />
        </div>
      </div>
      <div className="dial-labels" role="group" aria-label={`${label} positions`}>
        {options.map((o, i) => (
          <button
            key={String(o.value)}
            type="button"
            tabIndex={-1}
            aria-pressed={i === index}
            onClick={() => select(i)}
          >
            {o.short ?? o.label}
          </button>
        ))}
      </div>
      <div className="dial-readout">
        <span className="dial-label">{label}</span>
        <span className="dial-value">{options[index].label}</span>
        {caption && <span className="dial-caption muted">{caption}</span>}
      </div>
    </div>
  );
}
