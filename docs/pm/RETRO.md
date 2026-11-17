# InvestEdge v1: acceptance check, retro and what's next

_Written 2026-11-16, updated 2026-11-17_

## 1. Did v1 do what the PRD said?

✅ done and checked · ⚠️ done, with a caveat · ❌ not done

### Features (PRD §6)

| # | Requirement | Result | How I know |
|---|---|---|---|
| F1 | ~503 constituents with sector | ✅ | 503 loaded (D15) |
| F1 | ≥5 years of daily prices for ≥98% of tickers, with retries | ✅ | 503/503 fetched, 0 failures; retries and stale-data fallback (D20) |
| F1 | One-command, incremental refresh | ✅ | `make refresh`; a second run fetched 0 rows and left all 503 unchanged |
| F2 | Candles or line, 1M–5Y, volume, hover OHLC, key metrics | ✅ | Checked in the browser |
| F2 | Stock page loads in under 2 s | ⚠️ | API responses take 11–26 ms and a static stock page is ~62 KB gzipped, but I never ran Lighthouse |
| F3 | ARIMA/ETS/Prophet 30-day forecasts with 80/95% bands, GARCH cone, toggles, explainers | ✅ | 500/503 stocks; the 3 newest listings are labelled "too new to forecast" |
| F4 | 12-month rolling backtest vs. naive, MAE/MAPE/coverage, verdict | ✅ | 499 stocks, a look-ahead test, and plain-English verdicts |
| F5 | Profile picker and quiz, screener, forecast view, tone, example portfolios | ✅ | Checked in the browser; portfolios say "example, not a recommendation" |
| F6 | Cached AI summary of ≤150 words with no buy/sell language | ✅ | Prompt caps it at 130 words; cached per stock, profile and day; filter is tested |
| F7 | Grounded streaming chat with tools, declines advice, rate limit and cost cap, key stays on the server | ✅ | Eval: grounding 10/10, advice 5/5 ($0.39) |
| F8 | Disclaimers in the footer, the tutor and the portfolios | ✅ | All three are there |
| F9 | Type-ahead search, sector browsing, sortable screener | ✅ | Also works on the static site, entirely in the browser |
| F10 | Time Machine | ✅ | Shipped early as Rewind & Release (D35) |
| F11/12 | ≥5 candlestick patterns with learn cards; glossary tooltips | ✅ | 7 patterns with per-stock track records; 19 accessible terms |

### Success metrics (PRD §10)

| Metric | Target | Result |
|---|---|---|
| Ticker coverage | ≥98% with data and forecasts | ✅ 99.4% (every stock has prices) |
| Page speed | Under 2 s | ⚠️ Fast in practice, not formally measured |
| Forecast honesty | Scorecard on every forecast stock, baseline always shown | ✅ |
| Chat grounding | 10/10 grounded, 5/5 advice declined | ✅ 10/10 and 5/5 |
| Portfolio quality | Public URL and README | ✅ https://anaypatel-p.github.io/investedge/ |

### Non-functional requirements (PRD §8)

| Requirement | Result |
|---|---|
| Nightly job under 60 min | ⚠️ Locally about 1 min (about 8 with the backtest). On GitHub's runners a normal night takes about 5 min, but the weekly backtest took 58 min (66 min for the whole job) on the first run. That's inside the 150-minute timeout but over my 60-minute target once a week |
| Works at phone width | ✅ Checked at 375, 800 and 1440 px |
| Keyboard navigable; color is never the only signal | ✅ The dial, scrubber, glossary terms and search all work from the keyboard; up/down also use ▲/▼ and hollow vs. filled candles |
| WCAG AA contrast | ⚠️ Colors were chosen to meet AA, but I haven't run an automated audit |
| API key never reaches the browser | ✅ |
| Under $10/month | ✅ Hosting is free (GitHub Pages and Actions); total AI spend so far is $0.42 |

### Known gaps

- The AI tutor is off on the public demo. A static site can't hold an API key safely, and after testing
  local models (README, "Choosing the tutor's model") I decided a recorded walkthrough was the better trade.
- No ESLint, and no automated accessibility or Lighthouse checks.
- The Fraunces font files are heavy, around 120–150 KB each.
- Model labels at the end of the chart crowd together on narrow phones.
- The trading calendar is approximate and misses Good Friday (D19).
- The tutor sometimes declines twice, once before looking things up and once after. A prompt tweak should
  fix it, but checking it means another paid eval run.
- The eval grader can't tell an invented *round* percentage from a hypothetical one like "if the market
  moved 1%" (D47).
- Links straight to a stock page work, but GitHub Pages serves them with a 404 status (that's how its
  single-page-app fallback works), so search engines won't index stock pages.

## 2. Retro

**What went well**

- Making honesty the product. The backtest showed ARIMA beat the naive guess on only 8.8% of stocks and that
  Prophet's 95% ranges caught reality just 58% of the time. I'd half expected that result to be awkward to
  show. It ended up being the most interesting thing in the app.
- Testing the scariest assumption first. In Phase 1 I timed every model on 20 stocks and found that all 503
  could be fit in about 7 minutes, so I never had to redesign anything for speed.
- Reading the actual answers, not just the scores. My first tutor eval scored 2/10. When I read the answers,
  the grader turned out to be wrong, and I also found two real UI bugs that my fake test client could never
  have caught. Reading the local models' answers later showed the opposite problem: the grader was too easy
  on advice answers, so I tightened it.
- Stopping between phases. Each phase ended with a working demo and a check against the plan, which made
  changes of direction cheap (pulling the Time Machine forward, dropping Stooq, switching to free hosting).

**What was harder than expected**

- Market data has sharp edges. yfinance returns a half-finished daily bar during market hours (D24), dividends
  quietly rescale all past prices, and Stooq started serving a bot check (D20).
- A subtle statistics bug: averaging percentile ranks made "riskier than X%" untrue until I re-ranked the
  average (D29).
- Everything around the code: a branch that got switched underneath me mid-commit, a GitHub token without
  the `workflow` scope, and an Anthropic account with no credits on the first eval run.

**What I'd do differently**

- Add ESLint and an automated accessibility check during the UI phase instead of leaving them for later.
- Run a small real-model eval as soon as the AI layer exists, instead of relying on a fake client for a
  whole phase.
- Work in a separate git worktree so nothing else can move the branch while I'm committing.
- Seed CI with a data snapshot so the very first cloud build doesn't depend on a cold download that might
  get rate-limited.

## 3. What's next

Ideas from PRD §13, re-ranked with what I learned. Two of them shipped right after v1: comparing a stock with
the S&P 500, and the "Meet the models" guide.

| Rank | Idea | Why | Size |
|---|---|---|---|
| 1 | **Compare two stocks side by side** (risk, scorecard, Rewind on both) | The question beginners ask most, and it reuses almost everything | S |
| 2 | **Earnings and news markers**, with a short "why did it move?" note | Explains the jumps no model predicted, which is the natural next lesson after the scorecard | M |
| 3 | **Live tutor for a launch window** behind a small proxy with a hard daily cap | Lets visitors try the tutor for a week or two without an open-ended bill | S |
| 4 | Paper portfolio simulator | Learning by doing, with the scorecard's humility built in | M |
| 5 | A learning path with short quizzes | Turns the glossary and patterns into a guided course | M |
| 6 | LSTM or transformer models in the scorecard | I'd expect them *not* to beat the baseline, which is a lesson in itself | L |
