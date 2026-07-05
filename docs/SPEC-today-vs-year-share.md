# Spec — "Today vs {Year}" Share / Export

> **Status (current implementation):** shipped as **Wayback-only**, **stacked**
> (Today over {Year}) PNG with Save/Copy. The AI "Period Render" path described in
> earlier drafts has been **removed** (no OpenAI key, no gpt-image pipeline). System
> share sheet and side-by-side layout are **not** implemented. This doc reflects the
> shipped design; the AI direction is history, kept below only as "removed".

## Problem
Reframe is a delight/novelty product; its real risk is retention. The one thing it
already almost has is a viral loop: people screenshot "today's web in a retro look"
and share it. Today that loop dead-ends (a rendered image sits in a tab, nothing
markets the app). Close the loop: make sharing one click, and put the brand on every
share so each export is an ad.

## Goal
One click turns the current page into a shareable **stacked image** — top "Today"
(live), bottom "{Year}" (a real archived snapshot) — with a small Reframe wordmark,
then save / copy.

## Non-goals
- Hosting/uploading or a public gallery (just local save + clipboard).
- Animated GIF crossfade.
- The generative "fake internet" / AI Period Render direction (**removed** — see below).
- macOS system share sheet (`NSSharingServicePicker`).
- Side-by-side (landscape) layout — shipped layout is stacked.

## The {Year} side — Wayback only
Load a **real Wayback Machine snapshot** of the current page for the chosen year and
`capturePage()` it. The snapshot is resolved via the availability API
(`archive.org/wayback/available`) so the exact year is respected; if the closest real
snapshot is more than ±1 year off, the UI asks the user to confirm the nearest one.
Authentic and free; may 404 or look broken, which is surfaced as an inline message.

## Flow
1. Page open → flyout button **"Share: Today vs {year}"** (the slider year drives it).
2. Capture **Today** = live viewport `capturePage()` (if the tab is currently showing
   an archived snapshot, the live original is captured off-screen so "Today" is live).
3. Build the **{year}** side from a resolved Wayback snapshot (off-screen capture).
4. Compose both into ONE PNG (stacked) with a header band "Reframe · today vs {year}"
   and a small corner wordmark + `myretromac.app`.
5. Present: **Save…**, **Copy to clipboard**.

## Composition (where the work happens)
- Done in the **renderer** with an offscreen `<canvas>`: load both PNGs as data URLs,
  draw stacked, add the label band + watermark, `canvas.toBlob()` → PNG. No new native
  dependency.
- Save / clipboard go through IPC to main (`share:save` → `dialog.showSaveDialog` +
  `shell.showItemInFolder`; `share:copy` → `clipboard.writeImage`).

## Reuse
- `wrapWayback` / `unwrapWayback` / `isWayback` (`shell/wayback.ts`).
- The flyout pattern + the `handle()`/sender-checked IPC wrapper.
- `capturePage`, `dialog`, `clipboard`, `shell.showItemInFolder` (Electron main).

## Edge cases
- No snapshot for the chosen year → inline "No archive snapshot found for this page."
- Closest snapshot > ±1 year away → `suggestYear` handed back; UI confirms in one click.
- Long page → viewport capture only.

## Success metric
Shares created / week. Every exported image carries the wordmark + URL → attribution → installs.

## Removed
- **AI (Period Render):** the `period-render.ts` (gpt-image) pipeline, the OpenAI key,
  the AI/Archive source toggle, and the `shell:periodRender` IPC / `share:sources`
  `source:'ai'` branch have all been deleted. `share:sources` is wayback-only.
