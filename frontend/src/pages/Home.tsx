import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useScreener } from "../api/client";
import type { Fit, ProfileKey, ScreenerRow } from "../api/types";
import { FitBadge, RiskMeter } from "../components/Badges";
import { ProfilePicker } from "../components/ProfilePicker";
import { Term } from "../components/Term";
import { num, pct, signedPct } from "../format";
import { usePrefs } from "../state/prefs";
import "./Home.css";

const SECTORS = [
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Energy",
  "Financials",
  "Health Care",
  "Industrials",
  "Information Technology",
  "Materials",
  "Real Estate",
  "Utilities",
];

const HEADLINE: Record<ProfileKey, string> = {
  conservative: "Steadier ground first.",
  moderate: "Balance, ranked.",
  aggressive: "The full spread of risk.",
};

type SortKey = "fit" | "symbol" | "risk_score" | "volatility_1y" | "beta_1y" | "max_drawdown_1y" | "return_1y" | "dividend_yield" | "sharpe_1y";

export function Home() {
  const { profile, density } = usePrefs();
  if (!profile) return <ProfilePicker />;
  return density === "terminal" ? <Terminal profile={profile} /> : <Guided profile={profile} />;
}

function Filters({
  sector,
  setSector,
  fit,
  setFit,
}: {
  sector: string;
  setSector: (s: string) => void;
  fit: Fit | "all";
  setFit: (f: Fit | "all") => void;
}) {
  return (
    <div className="filters">
      <label>
        <span className="kicker">
          <Term k="sector">Sector</Term>
        </span>
        <select value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="">All 11 sectors</option>
          {SECTORS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <div className="segmented" role="group" aria-label="Filter by fit">
        {(["all", "good", "possible", "outside"] as const).map((f) => (
          <button key={f} type="button" aria-pressed={fit === f} onClick={() => setFit(f)}>
            {f === "all" ? "All" : f === "outside" ? "Outside" : f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

function useRows(profile: ProfileKey, sector: string, fit: Fit | "all") {
  const q = useScreener(profile, sector || undefined);
  const rows = useMemo(() => (q.data?.results ?? []).filter((r) => fit === "all" || r.fit === fit), [q.data, fit]);
  return { ...q, rows };
}

function Guided({ profile }: { profile: ProfileKey }) {
  const [sector, setSector] = useState("");
  const [fit, setFit] = useState<Fit | "all">("good");
  const [shown, setShown] = useState(24);
  const { rows, isLoading, error } = useRows(profile, sector, fit);

  return (
    <div className="home">
      <header className="home-head">
        <p className="kicker">For {profile === "aggressive" ? "an" : "a"} {profile} investor · {rows.length} stocks</p>
        <h1 className="home-title">{HEADLINE[profile]}</h1>
        <p className="home-lede">
          Every S&amp;P 500 stock, ordered by how well its past <Term k="volatility">swings</Term> match the ride you chose —
          then by how much <Term k="returnPerRisk">return it earned for each unit of risk</Term> over the last year. That's a
          description of the past, not a tip.
        </p>
        <Filters sector={sector} setSector={setSector} fit={fit} setFit={setFit} />
      </header>

      {error && <p role="alert">Couldn't load the stock list. Is the API running? ({String(error.message)})</p>}
      {isLoading && <SkeletonRows />}

      <ol className="ledger">
        {rows.slice(0, shown).map((r, i) => (
          <LedgerRow key={r.symbol} row={r} rank={i + 1} />
        ))}
      </ol>
      {rows.length > shown && (
        <button type="button" className="btn more" onClick={() => setShown((s) => s + 48)}>
          Show more ({rows.length - shown} left)
        </button>
      )}
    </div>
  );
}

function LedgerRow({ row, rank }: { row: ScreenerRow; rank: number }) {
  const r1y = signedPct(row.return_1y);
  return (
    <li className="ledger-row">
      <span className="ledger-rank mono">{String(rank).padStart(2, "0")}</span>
      <Link to={`/stock/${row.symbol}`} className="ledger-main">
        <span className="ledger-sym">{row.symbol}</span>
        <span className="ledger-name">{row.name}</span>
        <span className="ledger-sector muted">{row.sector}</span>
      </Link>
      <span className="ledger-meta">
        <FitBadge fit={row.fit} />
        <RiskMeter score={row.risk_score} level={row.risk_level} />
      </span>
      <span className="ledger-sentence">{row.risk_sentence}</span>
      <span className={`ledger-return mono ${r1y.dir}`} title="Price change over the past year">
        {r1y.text}
        <span className="muted"> 1y</span>
      </span>
    </li>
  );
}

function SkeletonRows() {
  return (
    <div aria-hidden="true" className="ledger">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 64, margin: "12px 0" }} />
      ))}
    </div>
  );
}

const COLS: { key: SortKey; label: string; title: string; fmt: (r: ScreenerRow) => string; cls?: (r: ScreenerRow) => string }[] = [
  { key: "risk_score", label: "Risk", title: "Riskier than X% of S&P 500 stocks", fmt: (r) => num(r.risk_score, 0) },
  { key: "volatility_1y", label: "Vol 1y", title: "Annualised volatility (typical yearly swing)", fmt: (r) => pct(r.volatility_1y, 0) },
  { key: "beta_1y", label: "Beta", title: "Sensitivity to the S&P 500 (1 = moves with the market)", fmt: (r) => num(r.beta_1y) },
  { key: "max_drawdown_1y", label: "Max DD 1y", title: "Worst peak-to-trough fall in the past year", fmt: (r) => pct(r.max_drawdown_1y, 0) },
  {
    key: "return_1y",
    label: "Ret 1y",
    title: "Price change over the past year",
    fmt: (r) => signedPct(r.return_1y).text,
    cls: (r) => signedPct(r.return_1y).dir,
  },
  { key: "dividend_yield", label: "Div yld", title: "Dividends paid in the last 12 months ÷ price", fmt: (r) => pct(r.dividend_yield, 2) },
  { key: "sharpe_1y", label: "Ret/Risk", title: "Past-year return per unit of volatility", fmt: (r) => num(r.sharpe_1y) },
];

function Terminal({ profile }: { profile: ProfileKey }) {
  const [sector, setSector] = useState("");
  const [fit, setFit] = useState<Fit | "all">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "fit", dir: 1 });
  const { rows, isLoading, error } = useRows(profile, sector, fit);

  const sorted = useMemo(() => {
    if (sort.key === "fit") return rows; // server order = fit, then ret/risk
    return [...rows].sort((a, b) => {
      const av = a[sort.key] as number | string | null;
      const bv = b[sort.key] as number | string | null;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
    });
  }, [rows, sort]);

  const header = (key: SortKey, label: string, title: string) => (
    <th scope="col" title={title} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : 1 }))}>
        {label}
        {sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div className="home terminal">
      <header className="home-head term-head">
        <h1 className="term-title">
          Screener <span className="muted mono">· {profile} · {sorted.length}</span>
        </h1>
        <Filters sector={sector} setSector={setSector} fit={fit} setFit={setFit} />
      </header>
      {error && <p role="alert">Couldn't load the screener: {String(error.message)}</p>}
      {isLoading && <div className="skeleton" style={{ height: 400 }} aria-hidden="true" />}
      <div className="term-table-wrap">
        <table className="term-table">
          <thead>
            <tr>
              {header("symbol", "Ticker", "Ticker symbol")}
              <th scope="col">Name</th>
              <th scope="col">Sector</th>
              {header("fit", "Fit", "Fit for your profile")}
              {COLS.map((c) => header(c.key, c.label, c.title))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.symbol}>
                <td className="mono">
                  <Link to={`/stock/${r.symbol}`}>{r.symbol}</Link>
                </td>
                <td className="term-name">{r.name}</td>
                <td className="muted">{r.sector}</td>
                <td>
                  <FitBadge fit={r.fit} />
                </td>
                {COLS.map((c) => (
                  <td key={c.key} className={`mono num-cell ${c.cls?.(r) ?? ""}`}>
                    {c.fmt(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
