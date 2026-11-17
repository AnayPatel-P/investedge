import "./Icon.css";

/** The app's few icons, drawn in one 1.5 stroke on a 16 grid so they sit at text size. */
const PATHS = {
  redraw: (
    <>
      <path d="M13 8a5 5 0 1 1-1.6-3.7" />
      <path d="M13 2.5v3h-3" />
    </>
  ),
  check: <path d="M3.5 8.5l3 3 6-7" />,
  cross: <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />,
  star: <path d="M8 2.2l1.75 3.6 3.95.55-2.86 2.78.68 3.92L8 11.2l-3.52 1.85.68-3.92L2.3 6.35l3.95-.55z" />,
  fitGood: <circle cx="8" cy="8" r="4.5" className="icon-fill" />,
  fitPossible: (
    <>
      <circle cx="8" cy="8" r="4.5" />
      <path d="M8 3.5a4.5 4.5 0 0 1 0 9z" className="icon-fill" />
    </>
  ),
  fitOutside: <circle cx="8" cy="8" r="4.5" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg className={`icon ${className}`} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
