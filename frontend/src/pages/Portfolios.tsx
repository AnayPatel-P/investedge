import { useState } from "react";
import { Link } from "react-router-dom";
import { usePortfolio } from "../api/client";
import type { ProfileKey } from "../api/types";
import { pct, signedPct } from "../format";
import { usePrefs } from "../state/prefs";
import "./Portfolios.css";

const KEYS: ProfileKey[] = ["conservative", "moderate", "aggressive"];

export function Portfolios() {
  const { profile } = usePrefs();
  const [key, setKey] = useState<ProfileKey>(profile ?? "moderate");
  const { data, isLoading, error } = usePortfolio(key);

  return (
    <div className="portfolios">
      <header className="pf-head">
        <p className="kicker">Example portfolios · for learning</p>
        <h1 className="pf-title">Ten stocks swing less than one.</h1>
        <p className="pf-lede">
          See what spreading money across sectors does to the ride. These baskets are built by a fixed, visible rule from past data —
          they're illustrations, not recommendations.
        </p>
        <div className="segmented" role="group" aria-label="Profile">
          {KEYS.map((k) => (
            <button key={k} type="button" aria-pressed={key === k} onClick={() => setKey(k)}>
              {k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {error && <p role="alert">Couldn't load this example: {String(error.message)}</p>}
      {isLoading && <div className="skeleton" style={{ height: 320 }} aria-hidden="true" />}

      {data && (
        <>
          <p className="pf-disclaimer" role="note">
            <strong>Not advice.</strong> {data.disclaimer}
          </p>

          <section className="pf-swing" aria-labelledby="swing-title">
            <h2 id="swing-title" className="visually-hidden">
              Volatility comparison
            </h2>
            <SwingBar label="The average stock in this basket, on its own" value={data.stats.avg_holding_volatility_1y} max={Math.max(0.6, data.stats.avg_holding_volatility_1y)} tone="single" />
            <SwingBar label="The whole basket, held together" value={data.stats.volatility_1y} max={Math.max(0.6, data.stats.avg_holding_volatility_1y)} tone="basket" key={key} />
            <p className="pf-lesson">{data.lesson}</p>
          </section>

          <section className="pf-holdings" aria-labelledby="holdings-title">
            <div className="pf-holdings-head">
              <h2 id="holdings-title">{data.label}</h2>
              <p className="muted pf-rule">
                <span className="kicker">The rule</span> {data.rule}
              </p>
            </div>
            <ol className="pf-list">
              {data.holdings.map((h) => (
                <li key={h.symbol}>
                  <Link to={`/stock/${h.symbol}`} className="pf-sym">
                    {h.symbol}
                  </Link>
                  <span className="pf-name">
                    {h.name}
                    <span className="muted">{h.sector}</span>
                  </span>
                  <span className="mono pf-weight">{pct(h.weight, 0)}</span>
                  <span className="mono muted">swing {pct(h.volatility_1y, 0)}</span>
                </li>
              ))}
            </ol>
            <dl className="pf-stats">
              <div>
                <dt className="kicker">Basket, past year</dt>
                <dd className={`mono ${signedPct(data.stats.return_1y).dir}`}>{signedPct(data.stats.return_1y).text}</dd>
              </div>
              <div>
                <dt className="kicker">Worst drop</dt>
                <dd className="mono down">{pct(data.stats.max_drawdown_1y, 0)}</dd>
              </div>
              <div>
                <dt className="kicker">Sectors</dt>
                <dd className="mono">{data.stats.sectors}</dd>
              </div>
            </dl>
          </section>
        </>
      )}
    </div>
  );
}

function SwingBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "single" | "basket" }) {
  return (
    <div className={`swingbar ${tone}`}>
      <span className="swingbar-label">{label}</span>
      <span className="swingbar-track" aria-hidden="true">
        <span className="swingbar-fill" style={{ ["--w" as string]: `${(value / max) * 100}%` }} />
      </span>
      <span className="swingbar-value num">±{pct(value, 0)} a year</span>
    </div>
  );
}
