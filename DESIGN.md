---
name: InvestEdge
description: Every forecast, checked against reality. Forecasting models as players with a public record.
colors:
  shell: "#1f2a60"
  shell-2: "#2a3775"
  on-shell: "#ffffff"
  on-shell-muted: "#b9c1e6"
  reality: "#1f2a60"
  mvp-gold: "#f2b705"
  model-naive: "#5c6470"
  model-arima: "#c2540a"
  model-ets: "#1b8048"
  model-prophet: "#6247d1"
  model-garch: "#a87700"
  model-garch-bright: "#f2b705"
  card-stock: "#e8e5dc"
  card-red: "#b02f25"
  paper: "#f5f6f8"
  paper-deep: "#e7eaf0"
  surface: "#fbfcfd"
  surface-2: "#ffffff"
  ink: "#161c3a"
  ink-soft: "#343c5c"
  muted: "#565d75"
  rule: "#d9dde6"
  rule-strong: "#b3b9c8"
  forecast-pencil: "#7d8591"
  up: "#1b7a55"
  down: "#c03a26"
  possible: "#8a6414"
  focus: "#3550c8"
typography:
  price:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "clamp(2.75rem, 2rem + 3.4vw, 5rem)"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "tnum"
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.6rem + 1.6vw, 3rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "0.005em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 1.25rem + 0.5vw, 1.75rem)"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.018em"
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 550
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0em"
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.05em"
  stat:
    fontFamily: "Barlow Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1
rounded:
  none: "0"
  sm: "6px"
  md: "10px"
  lg: "16px"
  pill: "999px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
  s-8: "64px"
  gutter: "clamp(16px, 4vw, 48px)"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 0.9em"
    height: "2.25rem"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "0 0.9em"
    height: "2.25rem"
  segmented-on:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "2rem"
  player-card-front:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px 16px 12px"
    height: "22.5rem"
  player-card-back:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.shell}"
    rounded: "{rounded.md}"
    padding: "12px 12px 8px"
  strip-player:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.sm}"
    padding: "0 0.7em"
    height: "2.25rem"
  mvp-badge:
    backgroundColor: "{colors.mvp-gold}"
    textColor: "{colors.shell}"
    rounded: "{rounded.pill}"
    padding: "7px 10px 6px"
  masthead:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.on-shell}"
  search-input:
    backgroundColor: "{colors.shell-2}"
    textColor: "{colors.on-shell}"
    rounded: "{rounded.md}"
    padding: "0 0.8em"
    height: "2.25rem"
  profile-chip:
    backgroundColor: "{colors.shell-2}"
    textColor: "{colors.on-shell}"
    rounded: "{rounded.pill}"
    padding: "0 0.9em"
    height: "2.25rem"
---

# Design System: InvestEdge

## Overview

**Creative North Star: "The Lineup"**

Forecasting models are players with a public record. Every model has a team colour, and it wears that colour everywhere it appears: its card border, its name, its button in the chart toolbar, and the futures it draws on the drum. Reality is heavy navy ink. The page is a cool neutral ground under an opaque navy shell, so the only saturated colour on screen belongs to a model or to the MVP's gold.

The chart keeps the Recording Drum mechanics: the price history turns like a drum under the finger, settles on damped springs, and a chosen replay rewinds it so reality inks in over an old forecast. The lineup is the drum's cast, not a separate chapter; it sits directly under the ruler. Each card flips (a spring-like y-turn that can be caught mid-turn) to a two-ink season table on grey board stock, and every season row is a replay that turns the drum.

Density has two modes from one token set: Guided (default, roomy, light) and Terminal (a night-game version: navy-black ground, brighter team colours, tighter steps). Terminal is a recolouring of the same world, never an inversion of it.

**Key Characteristics:**
- Colour is owned by the five models; chrome is navy, neutral, or ink.
- One condensed athletic face (Barlow Condensed, italic 800) for names, tickers and titles; system UI with tabular numbers for everything read or compared.
- The price is the largest thing on the stock page, set light (300) in the system face.
- Cards are the one lifted surface; everything else is flat with hairlines.
- Motion is calm and physical: springs for the drum, a slight-overshoot turn for cards, press-scale on every button, instant cross-fades under reduced motion.

## Colors

A cool slate-and-navy neutral field where saturated colour is a team uniform, never decoration.

### Primary
- **Shell Navy** (#1f2a60): the top bar, the reality line on the chart, ink on card backs, text on the MVP badge. Doubles as `--reality` because what actually happened is the house voice.
- **Shell Navy Raised** (#2a3775): wells inside the shell (search field, profile chip, segmented track).
- **Shell Text / Shell Muted** (#ffffff / #b9c1e6): text on the shell; muted for inactive nav and placeholders.

### Secondary
- **MVP Gold** (#f2b705): the one brand mark. The wordmark's skewed underline swoosh, the active-nav underline, the MVP badge and star, the search focus ring on navy, the current-season row highlight, the "now" pip outline.

### Tertiary (the lineup)
- **Naive Slate** (#5c6470): the naive guess, the baseline every other model must beat.
- **ARIMA Burnt Orange** (#c2540a, 4.6:1 on white).
- **ETS Kelly** (#1b8048, 4.9:1).
- **Prophet Violet** (#6247d1, 6.6:1).
- **GARCH Gold Ink** (#a87700, 4.5:1) for its text and lines; **GARCH Bright** (#f2b705) for its card border only.
- **Card Stock** (#e8e5dc) and **Card Red** (#b02f25): the two-ink card back. Red marks the back title, the totals row and any replay that landed outside the band.

### Neutral
- **Paper** (#f5f6f8): page ground. **Paper Deep** (#e7eaf0): recessed wells, segmented tracks, skeletons, hover fills.
- **Surface** (#fbfcfd): the drum and large panels. **Surface 2** (#ffffff): cards, popovers, the pressed segment.
- **Ink** (#161c3a, 15:1), **Ink Soft** (#343c5c), **Muted** (#565d75, 5.6:1, the lowest text contrast allowed).
- **Rule** (#d9dde6) and **Rule Strong** (#b3b9c8): hairlines and control borders. Chart grid uses ink at 4.5% (minor) and 8.5% (major).
- **Forecast Pencil** (#7d8591): fallback stroke when no model is focused.
- **Meaning:** Up / Good (#1b7a55), Down / Outside (#c03a26), Possible (#8a6414), Focus ring (#3550c8).

### Named Rules
**The Team Colour Rule.** A model's colour (`--m-<model>`) appears only where that model is speaking: its card, its toolbar button, its line, its swatch. Components take it through a local `--c` custom property, never a hard-coded hex. No chrome, heading or illustration borrows a team colour.

**The One Gold Rule.** Gold means MVP or "you are here". It is never a generic highlight or a warning colour.

**The Reality Is Ink Rule.** The real price is always heavy navy (light mode) or white (Terminal), drawn at 2px; forecasts never take that colour.

## Typography

**Display Font:** Barlow Condensed (self-hosted via @fontsource: 700, 700 italic, 800 italic), falling back to Arial Narrow
**Body Font:** system-ui stack (-apple-system, Segoe UI, Roboto, Helvetica Neue)
**Label/Mono Font:** the body face with tabular numbers; ui-monospace only for code

**Character:** a condensed, slanted athletic voice for who and what (players, tickers, the wordmark), against a plain native reading face for numbers and explanation. The athletic face names things; it never explains them.

### Hierarchy
- **Price** (300, clamp 2.75rem to 5rem, line-height 1, -0.04em, tabular): the last price on the stock page, top right. The largest type on any page.
- **Display** (Barlow Condensed italic 800, uppercase, 0.95 leading, 0.005em): player names on cards (1.85rem), the ticker (1.25 x step-3), the lineup title (step-3), the wordmark (1.6rem), ledger symbols and ranks (step-2).
- **Headline** (Barlow Condensed 650, step-2 clamp, 1.2, -0.018em): h1/h2 section and page heads. h1 uses step-3 (clamp 2rem to 3rem, 1.08, -0.028em).
- **Title** (system 550 to 600, 1.1875rem, 1.35, -0.01em): h3, ledes, the tally line, the company name.
- **Body** (400, 1rem, 1.55): explanation, capped at a 68ch measure.
- **Label** (600, 0.8125rem, 1.4): controls, stat terms, status lines. When uppercase it tracks 0.05em and is only a field label naming the value or control beside it.
- **Stat** (Barlow Condensed 700 roman, 2.25rem, 1): the one headline number on a player card.
- **Season table** (0.75rem tabular; header 0.625rem uppercase 700): the card back.

Each size step carries its own leading and tracking (`--step-n` / `--lh-n` / `--tr-n`); they travel together. Terminal shrinks steps 0 to 4 (0.9375rem body, 2.5rem price).

### Named Rules
**The Names, Not Sentences Rule.** Barlow Condensed is for names, tickers, titles and single headline numbers. Paragraphs, labels, table cells and buttons are set in the system face.

**The Tabular Figures Rule.** Every number that can change or be compared uses `font-variant-numeric: tabular-nums` so columns align and live values do not jitter.

## Layout

A single centred column, max 1280px, with a fluid gutter (clamp 16px to 48px). One 4px-based spacing scale (4, 8, 12, 16, 24, 32, 48, 64). Sections are separated by 64px in Guided and 32px in Terminal; row padding is 16px Guided, 8px Terminal.

Stock page order: price-first header (ticker and name left, price right), an instruments block of controls directly above the drum (chart type, range, overlays, the lineup strip, confidence level), the drum full width (clamp 320px to 560px tall), the ruler and drum status beneath it, then the lineup immediately under the ruler.

The lineup is a five-column grid on wide screens. At 1100px and below it becomes a horizontal scroll-snap rail that bleeds to the screen edges (cards min(15.5rem, 72vw), hidden scrollbar, gutter-aligned snap). The masthead collapses to a three-row grid at 900px, stops being sticky at 640px, and splits its controls around the wordmark and nav at 480px.

## Elevation & Depth

Flat by default, with hairlines (1px rule) doing the structural work. Lift is reserved for things you can pick up or that float.

### Shadow Vocabulary
- **Lift** (`0 1px 2px rgba(26,34,48,0.06), 0 6px 16px -8px rgba(26,34,48,0.18)`): player card fronts and the replay tally card.
- **Lift 2** (`0 1px 2px rgba(26,34,48,0.06), 0 18px 40px -18px rgba(26,34,48,0.28)`): popovers such as the search list.
- **Focus halo** (`0 0 0 3px paper, 0 0 0 5px <team colour>`): the focused model's card, a ring in its own colour stood off by a paper gap.
- **Pressed segment** (`0 1px 2px rgba(26,34,48,0.12)`): the selected button in a segmented control.

### Named Rules
**The Lift-Is-A-Card Rule.** Only cards and popovers cast shadows. Panels and the drum sit on the ground with a border or inset hairline. In Terminal, surfaces lift by lightness and `--lift` is none.

## Shapes

Radius grows with surface size: 6px for chips and small buttons, 10px for inputs and cards, 16px for the drum and large panels, a full pill for the profile chip and the MVP badge. Player cards carry a thick 6px border in the team colour (the replay tally card uses 4px), the one place a heavy stroke appears. Skew is the athletic accent: the wordmark underline and model swatches lean at -20deg, and the MVP badge sits rotated 6deg over the card corner.

## Components

### Buttons
Quiet and pressable; every button scales to 0.97 on press and commits on release.
- **Shape:** gently rounded (6px), 2.25rem tall.
- **Default:** surface fill, rule-strong hairline, label type at 550; hover darkens the border to ink-soft.
- **Primary / Pressed:** ink fill with paper text.
- **Disabled:** 45% opacity, not-allowed cursor.

### Segmented Control
- **Style:** paper-deep track (2px inset, 8px radius), transparent buttons 2rem tall in ink-soft; the pressed segment becomes a white chip with a 1px shadow. On the shell the track is navy raised and the pressed segment white with navy text.

### Model Strip (chart toolbar)
- **Style:** one button per model in Barlow Condensed italic 700 uppercase, 2px border and text in the team colour, a tiny line sample in that model's dash pattern. The drawing model is pressed (filled with its colour, white text). The MVP carries a gold star outlined in navy.

### Player Card (signature)
The lineup's unit. Front: team-colour 6px border on white with lift, name in the athletic face in its colour, a one-line position in muted label type, a glyph line, the headline stat in Barlow 700, hairline-separated stat rows, a row of season pips (filled = landed in the band, gold outline = now), and two actions: a full-width outlined "draw" button in the team colour and a hairline flip button with a turn icon. The MVP badge (gold pill, navy italic 800, white 3px border, 6deg tilt) overhangs the top-right corner.
- **Flip:** 3D y-turn over 560ms on `cubic-bezier(0.3, 1.32, 0.5, 1)` (slight overshoot). A transition, so a second press mid-turn reverses from where it is. Under reduced motion the faces cross-fade in place.
- **Back:** grey card stock in two inks: navy body, red title and totals. The season table is 0.75rem tabular with an uppercase 0.625rem header over a 2px rule; each date is an underlined button that rewinds the drum; the current replay row is washed in 45% gold; misses are red bold.

### The Drum (signature)
The chart is a canvas drum on the surface panel (16px radius). It scrubs 1:1 under the finger, carries momentum after a flick, rubber-bands at the ends, and settles on damped springs (`chart/spring.ts`): drum (damping 1, response 0.55s), settle (1, 0.35s), flick (0.82, 0.45s). The focused model's futures fan out from today in its team colour with its dash pattern; reality draws in navy ink after a replay is released.

### Navigation (masthead)
Opaque navy shell, sticky on desktop. Wordmark in Barlow italic 800 uppercase with a gold skewed underline and a muted tagline. Nav links in label type, on-shell-muted, active link white with a 2px gold underline. Search field is a navy-raised well that turns white with a 2px gold outline on focus; its results drop as a lift-2 popover that scales in from 0.98.

### Inputs / Fields
- **Style:** 2.25rem tall, 10px radius, surface fill, rule-strong hairline (selects on Home); on the shell, a navy-raised well.
- **Focus:** global 2px focus-blue outline offset 3px; gold outline on the shell.

### Icons
A small hand-drawn set on a 16px grid in a single 1.5 stroke, round caps and joins, sized at 1em so they sit at text size (redraw, check, cross, star, three fit marks). Inline SVG only.

## Do's and Don'ts

### Do:
- **Do** pass a model's colour into a component as `--c: var(--m-<model>)` and style borders, names, lines and pressed fills from `--c`.
- **Do** pair every model colour with its dash pattern (naive 2 3, ARIMA 6 3, ETS 10 3 2 3, Prophet 1 4, GARCH 12 4) so lines read without colour.
- **Do** set tickers, player names and the wordmark in Barlow Condensed italic 800 uppercase; set everything read or compared in the system face with tabular numbers.
- **Do** keep the price the largest element on the stock page, light weight (300).
- **Do** give every button a 0.97 press scale on `--t-press` (100ms) and every hover a `--t-fast` (160ms) colour change on `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- **Do** provide a reduced-motion path for every movement: cross-fades replace turns and slides, transition tokens drop to 0 to 160ms.
- **Do** derive Terminal by swapping tokens under `:root[data-density="terminal"]`, never by writing separate component styles.

### Don't:
- **Don't** use a team colour, or gold, for chrome, headings, links or generic emphasis.
- **Don't** draw a forecast in navy ink; reality owns that colour.
- **Don't** add shadows to panels, the drum or rows; only cards and popovers lift.
- **Don't** set body copy, labels or table cells in Barlow Condensed.
- **Don't** use a sweeping shimmer for loading; skeletons are still paper-deep blocks that breathe once a second.
- **Don't** put a translucent blur behind the shell; it stays opaque so team colours never sit on a tinted ground.
