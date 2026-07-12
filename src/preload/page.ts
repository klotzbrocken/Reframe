/**
 * Page preload (runs in every tab's WebContentsView, sandboxed). Two jobs:
 *  1. Turn a two-finger horizontal trackpad swipe into history back/forward, the
 *     way every native macOS browser does.
 *  2. Apply the optional retro "display" effect (reduced colour depth + ordered
 *     dither) to the page content. Done here — at document-start, via
 *     webFrame.insertCSS — so it lands BEFORE the first paint (no colour flash)
 *     and is immune to the page's Content-Security-Policy (which is why it works
 *     on locked-down sites like Gmail, unlike a script-injected <style>).
 *
 * The swipe navigate only fires when the page cannot scroll further that way
 * (i.e. it's at the edge), mirroring Chromium's own overscroll-to-navigate.
 */
import { ipcRenderer, webFrame } from 'electron'

// --- retro display effect (colour-depth reduction + ordered dither) ----------

// 8x8 Bayer ordered-dither threshold map, as a tiny greyscale PNG data URI.
const BAYER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAAAAADhZOFXAAAAU0lEQVR4nAFIALf/AAKBIqEKiSqpAMFC4WLJSulqADKxEpE6uRqZAPFy0VL5etlaAA6NLq0GhSalAM1O7W7FRuVmAD69Hp02tRaVAP1+3V71dtVWPQQf4Vd81wgAAAAASUVORK5CYII='

const LUMA =
  "<feColorMatrix type='matrix' values='0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0 0 0 1 0' result='g'/>"
// Same luminance, but with strong contrast baked in (out = 2.3*L - 0.72): tones
// below L≈0.31 clamp to solid black and above L≈0.75 to white, leaving only the
// midtones to dither. So 1-bit text strokes stay solid black (legible, not grey
// stipple) and photos stop looking washed out, while mid greys still dither.
// Coefficients = 0.299/0.587/0.114 × 2.3; the 5th column carries the -0.72 offset.
const LUMA_CONTRAST =
  "<feColorMatrix type='matrix' values='0.6877 1.3501 0.2622 0 -0.72 0.6877 1.3501 0.2622 0 -0.72 0.6877 1.3501 0.2622 0 -0.72 0 0 0 1 0' result='g'/>"
const BAYER_TILE =
  "<feImage href='" + BAYER + "' x='0' y='0' width='8' height='8' result='b0'/><feTile in='b0' result='b'/>"

/** `n` evenly-spaced levels in [0,1] for a feFunc `discrete` tableValues list. */
function levels(n: number): string {
  const a: string[] = []
  for (let k = 0; k < n; k++) a.push((k / (n - 1)).toFixed(4))
  return a.join(' ')
}

/** Wrap a filter primitive chain into a `url("data:svg#d")` CSS filter value. */
function filterUrl(body: string): string {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg'><filter id='d' color-interpolation-filters='sRGB' x='0' y='0' width='100%' height='100%'>" +
    body +
    '</filter></svg>'
  return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '#d")'
}

/** 1-bit: contrast-boosted greyscale, then (optionally dithered) threshold. */
function monoBody(dither: boolean): string {
  const th =
    "<feComponentTransfer in='@'><feFuncR type='discrete' tableValues='0 1'/><feFuncG type='discrete' tableValues='0 1'/><feFuncB type='discrete' tableValues='0 1'/></feComponentTransfer>"
  if (!dither) return LUMA_CONTRAST + th.replace('@', 'g')
  // s = luminance - bayer + 0.5, thresholded at 0.5 → white when lum >= bayer.
  return (
    LUMA_CONTRAST +
    BAYER_TILE +
    "<feComposite in='g' in2='b' operator='arithmetic' k1='0' k2='1' k3='-1' k4='0.5' result='s'/>" +
    th.replace('@', 's')
  )
}

/** Reduce colour depth to r/g/b levels per channel, with optional pre-dither. */
function posterBody(r: number, g: number, b: number, amp: number, dither: boolean): string {
  let src = 'SourceGraphic'
  let pre = ''
  if (dither) {
    // Perturb every channel by (bayer-0.5)*amp (~one quantisation step) so the
    // subsequent quantisation dithers instead of banding.
    pre =
      BAYER_TILE +
      "<feComposite in='SourceGraphic' in2='b' operator='arithmetic' k1='0' k2='1' k3='" +
      amp.toFixed(4) +
      "' k4='" +
      (-amp / 2).toFixed(4) +
      "' result='s'/>"
    src = 's'
  }
  return (
    pre +
    "<feComponentTransfer in='" +
    src +
    "'><feFuncR type='discrete' tableValues='" +
    levels(r) +
    "'/><feFuncG type='discrete' tableValues='" +
    levels(g) +
    "'/><feFuncB type='discrete' tableValues='" +
    levels(b) +
    "'/></feComponentTransfer>"
  )
}

/** Build the `html{…}` rule for a display mode, or '' for no effect. */
function displayCss(mode: { depth?: string; dither?: boolean } | null): string {
  const depth = mode?.depth ?? 'off'
  const dither = mode?.dither !== false
  let f: string
  if (depth === '1bit') {
    // 1-bit paper look: force a white backdrop so empty areas stay white.
    return 'html{filter:' + filterUrl(monoBody(dither)) + ' !important;background:#fff !important}'
  } else if (depth === '16bit') {
    f = filterUrl(posterBody(32, 64, 32, 1 / 32, dither)) // RGB 5-6-5
  } else if (depth === '8bit') {
    f = filterUrl(posterBody(8, 8, 4, 1 / 8, dither)) // RGB 3-3-2 (256 colours)
  } else {
    return ''
  }
  return 'html{filter:' + f + ' !important}'
}

let insertedKey: string | null = null
function applyDisplay(mode: { depth?: string; dither?: boolean } | null): void {
  try {
    if (insertedKey) {
      webFrame.removeInsertedCSS(insertedKey)
      insertedKey = null
    }
  } catch {
    /* frame gone — ignore */
  }
  const css = displayCss(mode)
  if (css) {
    try {
      insertedKey = webFrame.insertCSS(css)
    } catch {
      /* insertCSS unavailable this early — ignore */
    }
  }
}

// Read the current mode synchronously at document-start (before first paint)…
try {
  applyDisplay(ipcRenderer.sendSync('page:getDisplay'))
} catch {
  /* main handler not ready — the broadcast below will catch us up */
}
// …and react to live changes (Settings toggles) without a reload.
ipcRenderer.on('page:setDisplay', (_e, mode) => applyDisplay(mode))

let accumX = 0
let accumY = 0
let last = 0
let fired = false

const RESET_MS = 220 // a pause this long starts a fresh gesture
const TRIGGER_PX = 110 // horizontal travel needed to navigate

window.addEventListener(
  'wheel',
  (e: WheelEvent) => {
    const now = Date.now()
    if (now - last > RESET_MS) {
      accumX = 0
      accumY = 0
      fired = false
    }
    last = now
    accumX += e.deltaX
    accumY += e.deltaY
    if (fired) return
    // clearly horizontal, and far enough
    if (Math.abs(accumX) < TRIGGER_PX) return
    if (Math.abs(accumX) < Math.abs(accumY) * 1.6) return
    // don't steal the gesture while the page can still scroll that way
    const el = document.scrollingElement || document.documentElement
    const canLeft = el ? el.scrollLeft > 0 : false
    const canRight = el ? el.scrollLeft + el.clientWidth < el.scrollWidth - 1 : false
    if (accumX < 0 && canLeft) return
    if (accumX > 0 && canRight) return
    fired = true
    // swipe right (deltaX < 0) → Back; swipe left (deltaX > 0) → Forward
    ipcRenderer.send('page:swipe', accumX < 0 ? 'back' : 'forward')
  },
  { passive: true, capture: true }
)
