# Guided Tour (coachmark) pattern

A small, dependency-free "first-run tour" that points at real UI elements with a
glowing ring, an animated arrow, and a compact caption — then shows itself again
only when you ship something new. Extracted from Reframe (Electron + React + TS)
but the principle ports to any web/React/Electron app and is easy to hand to
Claude Code as a spec.

---

## The idea in one paragraph

Keep the tour as **data** (a list of steps, each = a CSS selector + title + body
+ accent colour). A single overlay component reads the current step, measures the
target element's bounding box at runtime, and draws a highlight ring + arrow +
caption next to it. The page stays fully visible and interactive (no dark scrim);
the overlay only intercepts clicks on its own buttons. Show it automatically once
per **tour version** (tracked in `localStorage`), and also make it re-openable
from a menu.

Why this shape works well:

- **Steps are data, not code** → adding a step for a new feature is a one-line
  edit, and an agent can do it safely.
- **Targets by CSS selector** → the tour never hard-codes coordinates; it adapts
  to theme/layout/responsive changes because it measures at runtime.
- **Version-gated** → bump one constant and every existing user sees the tour
  again, scoped to what changed.

---

## Data model

```ts
export const TOUR_VERSION = '1.4.0' // bump to re-show after shipping a feature

export interface TourStep {
  target: string   // CSS selector of the element to point at
  title: string
  body: string
  color: string    // accent for the ring / arrow / label
}

export const TOUR_STEPS: TourStep[] = [
  { target: '[data-tour="fab"]',    title: 'Quick controls', body: '…', color: '#ff6a13' },
  { target: '[data-tour="theme"]',  title: 'Switch theme',   body: '…', color: '#2f6fed' },
  { target: '.ow-statusbar',        title: 'Dial-up modem',  body: '…', color: '#12b886' },
]
```

Prefer a dedicated **`data-tour="…"` attribute** as the target over brittle
structural selectors — it decouples the tour from styling/class churn. A stable
class (e.g. `.ow-statusbar`) is fine for whole regions.

---

## Auto-show once per version

```ts
useEffect(() => {
  if (localStorage.getItem('app.tour.version') === TOUR_VERSION) return
  // (optional) wait until the UI is ready / open any flyout that hosts targets
  localStorage.setItem('app.tour.version', TOUR_VERSION)
  setTourActive(true)
}, [])
```

Also expose a **"Show tour"** menu item (`onSelect: () => setTourActive(true)`)
so it's re-runnable on demand.

---

## The overlay component (mechanics)

Responsibilities, in order:

1. **Sit above everything.** In a plain web app, `position: fixed; inset: 0;
   z-index: <high>; pointer-events: none` on the root, and `pointer-events: auto`
   only on the caption card. In Electron apps that render page content in a
   **separate native view** (e.g. a `WebContentsView` stacked over the chrome),
   you must raise the chrome above that view while the tour runs — Reframe calls
   a `requestChromeTop('tour', true)` helper on mount and `false` on unmount.
2. **Measure the target each step** with `getBoundingClientRect()`, re-measuring
   on `resize` and one `requestAnimationFrame` after mount (so late-rendered
   targets settle). Store `{top,left,width,height}` in state.
3. **Draw three things** positioned from that rect:
   - a **ring**: an absolutely-positioned box a few px larger than the target,
     with a glowing `box-shadow`/`outline` in the step colour;
   - an **arrow**: a small inline SVG pointing at the target (flip it left/right
     depending on which side has room);
   - a **card**: title + body + `Skip` / `n / total` / `Next` (last = `Done`).
4. **Lay out left or right of the target** based on available space:
   `roomLeft = target.left - (cardW + arrowLen + gaps) > 8`. Clamp the card's
   top into the viewport.
5. **Advance**: `next()` increments the index or calls `onDone()` on the last
   step; `Skip` calls `onDone()` immediately.

Minimal skeleton:

```tsx
export function TourOverlay({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRectLike | null>(null)
  const step = steps[i]

  useEffect(() => { raiseChromeAboveContent(true); return () => raiseChromeAboveContent(false) }, [])

  useLayoutEffect(() => {
    const measure = () => {
      const el = step && document.querySelector(step.target)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    measure()
    const raf = requestAnimationFrame(measure)
    addEventListener('resize', measure)
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', measure) }
  }, [step])

  if (!step) return null
  const last = i === steps.length - 1
  // …compute ring/arrow/card positions from rect…
  return (/* ring + arrow + card JSX, styled with step.color via a CSS var */)
}
```

Render it only while active: `{tourActive && <TourOverlay steps={STEPS} onDone={() => setTourActive(false)} />}`.

---

## Gotchas learned the hard way

- **Targets that live inside a collapsed panel** won't measure. Force that panel
  open while the tour is active (Reframe passes `forceOpen={tourActive}` to its
  flyout) so every `target` exists when measured.
- **Native content views** (Electron `WebContentsView`, `<webview>`) paint above
  your DOM. The overlay is invisible until you raise the chrome above the content
  view — do it on mount, restore on unmount.
- **A missing target should degrade gracefully**: if `querySelector` returns null,
  skip the ring/arrow and still show the caption (or filter such steps out before
  rendering). Don't crash or point at `0,0`.
- **Non-dimming is a feature**: keeping the page visible/clickable makes the tour
  feel like helpful annotations rather than a modal wall.
- **Version, not "seen" boolean**: gate on a version string so you can re-surface
  the tour for *new* things without nagging about old ones.

---

## Reuse checklist (hand this to Claude Code)

1. Add `TOUR_VERSION`, `TourStep`, and a `TOUR_STEPS` array (one step per feature
   you want to introduce). Point each at a `data-tour="…"` attribute.
2. Add the `data-tour` attributes to the real elements.
3. Drop in the overlay component + its CSS (ring/arrow/card, coloured via a
   `--c` CSS variable set from `step.color`).
4. Wire the once-per-version auto-show effect + a "Show tour" menu entry.
5. If content renders in a native view or a collapsible panel, raise the
   chrome / force the panel open while the tour is active.
6. To announce a new feature later: add a step and bump `TOUR_VERSION`.

Reframe reference files: `src/renderer/components/TourOverlay.tsx` (component +
`TOUR_STEPS` + `TOUR_VERSION`), `src/renderer/App.tsx` (auto-show effect,
`forceOpen`, "Show Feature Tour" menu), `src/renderer/shell/chromeTop.ts`
(`requestChromeTop` — raise chrome over the page view).
