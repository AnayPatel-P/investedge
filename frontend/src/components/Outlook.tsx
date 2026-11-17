import type { ModelKey } from "../api/types";
import { chanceWords, type OutlookTile } from "../chart/outlook";
import { MODEL_LABEL, price, shortDate } from "../format";
import { Term } from "./Term";
import "./Outlook.css";

interface Props {
  tiles: OutlookTile[];
  start: number;
  level: number;
  model: ModelKey;
  /** Replays: show what really happened once the ink has been drawn. */
  showActual: boolean;
  totals: { n: number; inside: number; beat: number } | null;
  /** The drawn model's team colour, for the counts. */
  color?: string;
}

/** The outlook strip ("chance it's higher", counted from the drawn futures) and the model's calibration tag. */
export function Outlook({ tiles, start, level, model, showActual, totals, color }: Props) {
  const name = MODEL_LABEL[model];
  return (
    <div className="outlook" style={color ? ({ "--c": color } as React.CSSProperties) : undefined}>
      <ol className="outlook-tiles">
        {tiles.map((t) => {
          const pctHigher = Math.round(t.chance * 100);
          const went = t.actual === undefined ? null : t.actual > start ? "higher" : "lower";
          const inside = t.actual !== undefined && t.actual >= t.lo && t.actual <= t.hi;
          return (
            <li key={t.date} className="outlook-tile">
              <h3 className="outlook-when">
                {t.label} <span className="outlook-date">{shortDate(t.date)}</span>
              </h3>
              <p className="outlook-count">
                <span className="num">
                  {t.higher} of {t.total}
                </span>{" "}
                futures end higher
              </p>
              <p className="outlook-words">
                <strong>{chanceWords(t.chance)}</strong>, about {pctHigher}%, measured from <span className="num">{price(start)}</span>.
              </p>
              <p className="outlook-range">
                <Term k="forecastRange">{level}% range</Term>{" "}
                <span className="num">
                  {price(t.lo)} – {price(t.hi)}
                </span>
              </p>
              {showActual && went && t.actual !== undefined && (
                <p className={`outlook-actual ${went === "higher" ? "up" : "down"}`}>
                  Actually{" "}
                  <span className="num">{price(t.actual)}</span>, {went}
                  {inside ? ", inside the range" : ", outside the range"}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {totals && totals.n > 0 && (
        <aside className="calibration" aria-label="How reliable this model's range has been">
          <div>
            <h3 className="calibration-title">How honest is {name}'s {level}% range?</h3>
            <p>
              Over the last {totals.n} monthly replays, the real price landed inside this range{" "}
              <strong className="num">
                {totals.inside} of {totals.n}
              </strong>{" "}
              times. An honest {level}% range would manage about {Math.round((totals.n * level) / 100)}.
              {model !== "naive" && model !== "garch" && (
                <>
                  {" "}
                  {name} beat “price stays the same”{" "}
                  <strong className="num">
                    {totals.beat} of {totals.n}
                  </strong>{" "}
                  times.
                </>
              )}
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}
