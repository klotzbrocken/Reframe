# Spec — "Today vs {Year}" Share / Export

## Problem
Reframe is a delight/novelty product; its real risk is retention. The one thing it
already almost has is a viral loop: people screenshot "today's web in a retro look"
and share it. Today that loop dead-ends (a rendered image sits in a tab, nothing
markets the app). Close the loop: make sharing one click, and put the brand on every
share so each export is an ad.

## Goal
One click turns the current page into a shareable **side-by-side image** — left
"Today" (live), right "{Year}" (retro) — with a small Reframe wordmark, then
save / copy / share.

## Non-goals (for v1)
- Hosting/uploading or a public gallery (just local save + clipboard + system share).
- Animated GIF crossfade (v2).
- The generative "fake internet" direction (separate product).

## The {Year} side — two sources
1. **AI (Period Render):** reuse the existing `period-render.ts` pipeline (gpt-image-2).
   Always produces an era-styled image. Needs the user's OpenAI key.
2. **Wayback snapshot:** load `wrapWayback(url, date)` and `capturePage()` the real
   archived page. Authentic, free, but can 404 / look broken.

v1 default: if a key is set → AI; else → Wayback. Optional small toggle "AI / Archive".

## Flow
1. Page open → flyout button **"Share: Today vs {year}"** (the slider year drives it).
2. Capture **Today** = live viewport `capturePage()` (consistent with Period Render).
3. Build the **{year}** side from the chosen source (AI render, or Wayback capture).
4. Compose both into ONE PNG with a header band "Reframe · today vs {year}" and a
   small corner wordmark + `myretromac.app`.
5. Present: **Save…**, **Copy to clipboard**, **Share…** (macOS sharing picker), and
   "Reveal in Finder".

## Composition (where the work happens)
- Do it in the **renderer** with an offscreen `<canvas>`: load both PNGs as data URLs,
  draw side-by-side (or stacked for portrait), add the label band + watermark,
  `canvas.toBlob()` → PNG. No new native dependency.
- Save / clipboard / reveal go through new IPC to main (`dialog.showSaveDialog`,
  `clipboard.writeImage`, `shell.showItemInFolder`). System share sheet (macOS
  `NSSharingServicePicker`) is v1-optional; if skipped, Save + Copy cover sharing.

## Reuse
- `period-render.ts` (AI side, capturePage, sizing) — already built.
- `wrapWayback` / `unwrapWayback` / `isWayback` (`shell/wayback.ts`) — the
  removed Archive-Compare logic comes back here with a real purpose.
- The flyout pattern + the handle()/sender-checked IPC wrapper.

## Edge cases
- Wayback 404 on the {year} side → fall back to AI render (if key) else show a
  "no snapshot for {year}" placeholder panel in that half (still shareable).
- No key AND no snapshot → disable the button with a hint.
- AI latency (~30–120 s) → reuse the rotating "rendering…" progress; compose when ready.
- Long page → viewport capture only (matches Period Render).
- Cost/privacy: AI side sends the page to OpenAI (already disclosed in Settings).

## Success metric
Shares created / week. Every exported image carries the wordmark + URL → attribution → installs.

## Phasing
- **v1:** AI-or-Wayback side-by-side PNG + Save/Copy/Reveal + watermark + flyout entry.
- **v2:** AI/Archive source toggle, system share sheet, short crossfade GIF, social
  preset sizes (1200×630).
