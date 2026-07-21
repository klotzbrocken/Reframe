# Reframe 1.9.0

**Today's web, yesterday's look.**

### Retro Display Engine v2 — now per site
Set a global colour-depth look, then override any individual site. A page can stay in true colour while everything else drops to 256, 16-bit or 1-bit — the choice sticks per origin and is applied before the page paints, so there's no colour flash. New web-safe **216** mode (the classic Netscape colour cube), and you can flip depth or dithering for the current page right from the Time Machine flyout.

### Classic Web Typography
An optional typography layer dresses today's web in period clothing — era-appropriate link colours, dotted focus outlines, beveled form controls, and a classic serif body at the "Full" setting. Pure CSS, injected CSP-safely, with an "era" option that auto-picks from your active theme. Off · Light · Full in Settings.

### A slimmer Time Machine
The year flyout is cleaner: the slider's far-right stop is now **Today** (live) — drag left to travel back, month controls appear only when you do. Separate Today / Time-Travel buttons are gone, quick Retro-Display controls moved in, and dial-up speed labels are shorter (Off · ISDN 64K · 56K · 28.8K).

### Hardening & fixes
- **Security:** remote pages are default-denied camera, mic and other sensitive permissions.
- Copy & paste works in the address bar again; the Edit menu's Cut/Copy/Paste act on the focused field.
- Ad-block toggle now reloads every tab.
- Per-site reduced-colour pages stay Gmail-safe (per-origin CSP).
- Archive timeline no longer pulls in stale data after navigating away.

---

macOS build is signed with Developer ID and notarized; installed copies auto-update via electron-updater.
