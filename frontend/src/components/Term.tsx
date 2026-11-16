import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { GLOSSARY, type GlossaryKey } from "../glossary";
import "./Term.css";

/**
 * A glossary term: dotted underline, definition on hover, focus or tap.
 * Accessible: it's a real button, the definition is linked with aria-describedby, Esc closes it.
 */
export function Term({ k, children }: { k: GlossaryKey; children?: ReactNode }) {
  const g = GLOSSARY[k];
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [flip, setFlip] = useState<"left" | "right" | "center">("center");
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPinned(false);
      }
    };
    const onDoc = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDoc);
    };
  }, [open]);

  // Keep the bubble on screen near the edges.
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setFlip(r.left < 160 ? "left" : window.innerWidth - r.right < 160 ? "right" : "center");
  }, [open]);

  return (
    <span
      ref={ref}
      className="term"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => !pinned && setOpen(false)}
    >
      <button
        type="button"
        className="term-word"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => !pinned && setOpen(false)}
        onClick={() => {
          setPinned((p) => !p);
          setOpen((o) => !(o && pinned));
        }}
      >
        {children ?? g.term}
      </button>
      {open && (
        <span role="tooltip" id={id} className={`term-tip ${flip}`}>
          <strong>{g.term}</strong> {g.def}
        </span>
      )}
    </span>
  );
}
