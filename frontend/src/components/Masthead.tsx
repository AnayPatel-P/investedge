import { Link, NavLink } from "react-router-dom";
import { useLatestRun } from "../api/client";
import { longDate } from "../format";
import { usePrefs } from "../state/prefs";
import { Search } from "./Search";
import "./Masthead.css";

const PROFILE_LABEL = { conservative: "Conservative", moderate: "Moderate", aggressive: "Aggressive" };

export function Masthead() {
  const { profile, setProfile, density, setDensity } = usePrefs();
  return (
    <header className="masthead">
      <div className="masthead-inner">
        <Link to="/" className="wordmark" aria-label="InvestEdge home">
          <span className="wordmark-name">InvestEdge</span>
          <span className="wordmark-tag">an almanac of possible futures</span>
        </Link>
        <nav className="masthead-nav" aria-label="Main">
          <NavLink to="/" end>
            Stocks
          </NavLink>
          <NavLink to="/portfolios">Example portfolios</NavLink>
        </nav>
        <Search />
        <div className="masthead-controls">
          {profile && (
            <button
              type="button"
              className="profile-chip"
              onClick={() => setProfile(null)}
              title="Change your risk profile"
            >
              <span className="kicker">Profile</span> {PROFILE_LABEL[profile]}
            </button>
          )}
          <div className="segmented" role="group" aria-label="Page density">
            <button type="button" aria-pressed={density === "guided"} onClick={() => setDensity("guided")}>
              Guided
            </button>
            <button type="button" aria-pressed={density === "terminal"} onClick={() => setDensity("terminal")}>
              Terminal
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const run = useLatestRun();
  const asOf = run.data?.finished?.slice(0, 10);
  return (
    <footer className="site-footer">
      <p>
        <strong>Educational, not financial advice.</strong> InvestEdge explains what has happened and what simple
        models guess might happen. It does not know your situation and never tells you what to buy or sell.
      </p>
      <p className="muted">
        Prices: daily end-of-day data via Yahoo Finance, refreshed nightly{asOf ? ` (last refresh ${longDate(asOf)})` : ""}. Charts by{" "}
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
          TradingView Lightweight Charts
        </a>
        .
      </p>
    </footer>
  );
}
