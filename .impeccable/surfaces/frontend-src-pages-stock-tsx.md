---
version: 1
slug: "frontend-src-pages-stock-tsx"
primary_target: "frontend/src/pages/Stock.tsx"
related_targets: ["frontend/src/pages/Home.tsx","frontend/src/pages/Portfolios.tsx"]
---

# Stock page and app shell

Scope: InvestEdge web app, Operate mode. Stock page leads; Home, Portfolios and Profile inherit the world.
Audience/job: beginner reads what the price is doing, how risky it is for them, and how far each forecast can be trusted; reviewer sees craft in the signature moment.
Constraints: static GitHub Pages build, precomputed data, keep Rewind & Release drum mechanics, keep a11y handling.

## Direction contract

THESIS: Forecasting models are players with a public record. The category default (one chart, a forecast line, a stats grid) hides who made the call and how they did; here every model is a card in a lineup, the naive guess wears the MVP star when it wins, and every line on the chart is a player's colour.

OWN-WORLD: Navy #1f2a60 shell, neutral ramp ground #f5f6f8 to #ffffff, model team colours only for models (ARIMA tomato, ETS kelly, Prophet violet, GARCH gold, Naive slate), reality in heavy navy ink. Card backs are two-ink (navy + red) on grey board stock. Condensed athletic display face for names; system UI for everything else; tabular numbers.

STORY: The visitor reads the price and the drum chart first, sees the forecast drawn in one player's colour, scans the lineup and learns the naive guess usually wins, flips a card to read its season, and taps a season row to rewind the drum to that replay and watch reality ink in.

FIRST VIEWPORT: Navy top bar with search. Price-first header. Drum chart full width with the selected model's futures in its colour; ruler beneath. The lineup row of five cards sits directly under the ruler, one scroll below the fold at 1440x900 (amended after review: pulling it above the fold would shrink the drum, which is the first thing to read); on phones it is a horizontal snap rail.

FORM: Card Back fused with the Recording Drum; position 3 of 7 on the grounded list; seed:e4bc3784fe5dafbe

SIGNATURE: Flip a model card (spring y-turn, interruptible, instant swap under reduced motion) to its stat back; each season row is a replay; choosing one turns the drum there.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
