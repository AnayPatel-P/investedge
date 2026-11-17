# Recording the tutor demo

A 45–60 second screen recording of the **real Claude tutor** (full version, running locally). It's used in
three places: the LinkedIn post, the README, and the "Watch it answer questions" link on the free demo site.

Recording makes about 4 real Claude calls (a few cents). Your key stays in `.env`; nothing about it appears on
screen.

## Before you record

1. `make dev` (API + web), then open http://localhost:5173 in a clean browser window: no bookmarks bar,
   no other tabs, zoom at 100%. A window about 1280 × 800 reads well on phones once compressed.
2. Pick the **Moderate** profile and **Guided** view.
3. Open **NVDA** once and let the briefing finish, so it's cached. On camera it will appear instantly
   instead of after a pause.
4. Reload the page so the chat is empty. Close notifications (Focus mode on).

## Shot list (~50 s)

| Time | Do this | What viewers see |
|---|---|---|
| 0–6 s | Start on the NVDA page, chart visible. Slowly hover the forecast fan. | Real data, the fan of possible futures |
| 6–14 s | Scroll to **Ask about NVDA**; pause on the briefing. | A plain-English briefing written from the page's numbers |
| 14–30 s | Type: **What was NVDA's worst drop in the last year?** and send. | "↳ looked up risk metrics", then an answer with the real figure (−31.9%) |
| 30–48 s | Type: **Is NVDA a good investment for me? Just yes or no.** and send. | It declines to give advice, then explains the risk instead |
| 48–55 s | Optional: scroll up, drag **Rewind & Release** back and press ▶. | The signature moment, as a closer |

Type at a normal pace; you can trim pauses afterwards. If an answer comes out awkwardly, just ask again.

## How to record (macOS, no extra software)

1. Press **⌘ ⇧ 5** → **Record Selected Portion** → drag the box around the browser window → **Record**.
2. Stop with the ⏹ button in the menu bar. The `.mov` lands on your Desktop.
3. Trim the start and end: open it in QuickTime Player → **Edit → Trim** (⌘ T) → Save.

## Where it goes

- **LinkedIn:** upload the `.mov` directly as the post's video. LinkedIn handles the conversion.
- **README:** on github.com, open `README.md` → ✏️ Edit → drag the video into the editor under
  "Choosing the tutor's model". GitHub uploads it and inserts a link that plays inline. Commit from the web
  editor (or send me the link and I'll add it).
- **Demo site:** set `TUTOR_DEMO_URL` in `frontend/src/components/Tutor.tsx` to the video's link (the README
  section or the LinkedIn post). The "Watch it answer questions" link then appears on every stock page.
