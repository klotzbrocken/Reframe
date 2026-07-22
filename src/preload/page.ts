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
  } else if (depth === '216') {
    // Netscape "web-safe" palette: exactly 6 levels/channel (00,33,…,FF) = 216.
    f = filterUrl(posterBody(6, 6, 6, 1 / 6, dither))
  } else if (depth === '8bit') {
    f = filterUrl(posterBody(8, 8, 4, 1 / 8, dither)) // RGB 3-3-2 (256 colours)
  } else {
    return ''
  }
  return 'html{filter:' + f + ' !important}'
}

// --- Classic Web Typography & Controls -------------------------------------
// A pure-CSS layer that makes modern pages *read* older: period link colours,
// dotted focus rings and beveled native form controls at both levels, plus a
// serif body + system UI font at 'full' (older eras). No pixel processing.
function typographyCss(level: string | undefined): string {
  if (level !== 'light' && level !== 'full') return ''
  const rules: string[] = [
    // Period hyperlink colours, always underlined.
    'a:link{color:#0000ee!important;text-decoration:underline!important}',
    'a:visited{color:#551a8b!important}',
    'a:active{color:#ff0000!important}',
    // Pre-modern dotted focus ring.
    ':focus{outline:1px dotted #000!important;outline-offset:0!important}',
    // Beveled push-buttons (outset, inset while pressed).
    'button,input[type=button],input[type=submit],input[type=reset]{' +
      '-webkit-appearance:auto!important;appearance:auto!important;' +
      'border:2px outset #d4d0c8!important;border-radius:0!important;' +
      'background:#d4d0c8!important;color:#000!important;padding:1px 7px!important;' +
      "font-family:'Geneva','MS Sans Serif',Tahoma,Geneva,sans-serif!important;box-shadow:none!important}",
    'button:active,input[type=button]:active,input[type=submit]:active,input[type=reset]:active{' +
      'border-style:inset!important}',
    // Sunken text fields + selects.
    'input[type=text],input[type=search],input[type=email],input[type=url],' +
      'input[type=password],input[type=tel],input[type=number],textarea,select{' +
      '-webkit-appearance:auto!important;appearance:auto!important;' +
      'border:2px inset #d4d0c8!important;border-radius:0!important;' +
      'background:#fff!important;color:#000!important;box-shadow:none!important}'
  ]
  if (level === 'full') {
    // Older eras: Times body + a classic UI/monospace stack. (Icon-font glyphs
    // may fall back to letters — that's the 'era' trade-off; the milder 'light'
    // level leaves fonts untouched.)
    rules.push(
      "html,body,p,div,span,li,dd,dt,td,th,blockquote,figcaption{font-family:'Times New Roman',Times,Georgia,serif!important}",
      "h1,h2,h3,h4,h5,h6{font-family:'Times New Roman',Times,serif!important}",
      "code,pre,kbd,samp,tt{font-family:'Courier New',Courier,monospace!important}"
    )
  }
  return rules.join('')
}

// --- Period scrollbars (::-webkit-scrollbar) --------------------------------
// The web view's OWN scrollbars, restyled to a chosen OS look. Old browsers
// always showed a chunky, opaque scrollbar (never today's fading overlay), so
// we force a classic 16px bar and paint the track, thumb and arrow buttons to
// match the theme's era. The shapes follow the survey at
// https://scrollbars.matoseb.com, redrawn here as original CSS + inline SVG so
// no third-party sprite art ships. `!important` beats a site's own scrollbar
// rules (best-effort — a site's `!important` still wins, like the display FX).

/** Wrap an SVG body into a `url("data:…")` background value (w×h default 16). */
function svgBg(body: string, w = 16, h = 16): string {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='" + w + "' height='" + h + "'>" + body + '</svg>'
  return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")'
}
const triUp = (c: string): string => svgBg("<path d='M8 5 4 11h8z' fill='" + c + "'/>")
const triDn = (c: string): string => svgBg("<path d='M8 11 4 5h8z' fill='" + c + "'/>")
const triLf = (c: string): string => svgBg("<path d='M5 8 11 4v8z' fill='" + c + "'/>")
const triRt = (c: string): string => svgBg("<path d='M11 8 5 4v8z' fill='" + c + "'/>")
// A 3-line grip: horizontal lines for a vertical thumb, vertical for horizontal.
const gripH = (c: string): string =>
  svgBg(
    "<g fill='" + c + "'><rect x='4' y='6' width='8' height='1'/><rect x='4' y='8' width='8' height='1'/><rect x='4' y='10' width='8' height='1'/></g>"
  )
const gripV = (c: string): string =>
  svgBg(
    "<g fill='" + c + "'><rect x='6' y='4' width='1' height='8'/><rect x='8' y='4' width='1' height='8'/><rect x='10' y='4' width='1' height='8'/></g>"
  )
// A 4×4 stipple tile at 25% density (the System 7 track texture).
const stipple = (c: string): string =>
  svgBg(
    "<g fill='" +
      c +
      "'><rect width='1' height='1'/><rect x='2' y='1' width='1' height='1'/><rect y='2' width='1' height='1'/><rect x='2' y='3' width='1' height='1'/></g>",
    4,
    4
  )
// A 2×2 checkerboard at 50% density (the Windows 95 track texture).
const dither = (c: string): string =>
  svgBg("<g fill='" + c + "'><rect width='1' height='1'/><rect x='1' y='1' width='1' height='1'/></g>", 2, 2)
/** Two stacked background layers (glyph over fill) for a thumb or button. */
function layer(top: string, bottom: string): string {
  return (
    'background-image:' +
    top +
    ',' +
    bottom +
    '!important;background-repeat:no-repeat,repeat!important;background-position:center,center!important'
  )
}

function scrollbarCss(style: string | undefined): string {
  if (!style) return ''
  // Force a classic bar and set up one arrow button at each end (hide the extra
  // double-button slots so we don't get paired arrows).
  const base =
    '::-webkit-scrollbar{width:16px!important;height:16px!important}' +
    '::-webkit-scrollbar-button:vertical:start:increment,::-webkit-scrollbar-button:vertical:end:decrement,' +
    '::-webkit-scrollbar-button:horizontal:start:increment,::-webkit-scrollbar-button:horizontal:end:decrement{display:none!important}' +
    '::-webkit-scrollbar-button:vertical:decrement,::-webkit-scrollbar-button:vertical:increment{display:block!important;height:16px!important}' +
    '::-webkit-scrollbar-button:horizontal:decrement,::-webkit-scrollbar-button:horizontal:increment{display:block!important;width:16px!important}'

  // Mac OS 8/9 Platinum: a flat grey track, one arrow at each end, and a
  // periwinkle thumb with grip ridges. Colours sampled from the reference chart
  // (track #aaa, thumb #ccccff→#9896ff highlight, grip #6563cf, grey raised arrows).
  if (style === 'sys8') {
    const track = '#aaaaaa'
    const thumbV = 'linear-gradient(to bottom,#ccccff,#9896ff 52%,#8785e6)'
    const thumbHb = 'linear-gradient(to right,#ccccff,#9896ff 52%,#8785e6)'
    const btnFace = 'linear-gradient(to bottom,#ececec,#c8c8c8)'
    const btn = (sel: string, glyph: string): string =>
      sel +
      '{background:' +
      btnFace +
      '!important;border:1px solid #000!important;box-shadow:inset 1px 1px #fff,inset -1px -1px #808080!important;background-image:' +
      glyph +
      '!important;background-repeat:no-repeat!important;background-position:center!important}'
    return (
      base +
      '::-webkit-scrollbar{background:' + track + '!important}' +
      '::-webkit-scrollbar-track{background:' + track + '!important;box-shadow:inset 1px 0 #000,inset -1px 0 #000!important}' +
      '::-webkit-scrollbar-corner{background:' + track + '!important}' +
      '::-webkit-scrollbar-thumb{border:1px solid #000!important;min-height:20px!important}' +
      '::-webkit-scrollbar-thumb:vertical{' + layer(gripH('#6563cf'), thumbV) + ';border:1px solid #000!important}' +
      '::-webkit-scrollbar-thumb:horizontal{' + layer(gripV('#6563cf'), thumbHb) + ';border:1px solid #000!important}' +
      btn('::-webkit-scrollbar-button:vertical:decrement', triUp('#000')) +
      btn('::-webkit-scrollbar-button:vertical:increment', triDn('#000')) +
      btn('::-webkit-scrollbar-button:horizontal:decrement', triLf('#000')) +
      btn('::-webkit-scrollbar-button:horizontal:increment', triRt('#000'))
    )
  }

  // Mac OS X 10.0 "Cheetah" Aqua: a white rounded trough, a glossy blue-gel
  // capsule thumb, both arrows paired at the bottom. The gel is a layered
  // gradient (a rounded cross-section pill + a length-wise top sheen) around the
  // authentic Aqua selection blue #2563ae, after the B00merang Cheetah theme.
  if (style === 'aqua10') {
    // Cross-section pill (dark edges → bright specular highlight → dark edge).
    const crossR =
      'linear-gradient(to right,#164e94 0,#2f7fd6 14%,#7cb8f2 38%,#e2f1ff 52%,#66a8ec 74%,#164e94 100%)'
    const crossB =
      'linear-gradient(to bottom,#164e94 0,#2f7fd6 14%,#7cb8f2 38%,#e2f1ff 52%,#66a8ec 74%,#164e94 100%)'
    // Length-wise glass sheen over the top half.
    const sheenB =
      'linear-gradient(to bottom,rgba(255,255,255,.5),rgba(255,255,255,0) 46%,rgba(255,255,255,.14) 82%)'
    const sheenR =
      'linear-gradient(to right,rgba(255,255,255,.5),rgba(255,255,255,0) 46%,rgba(255,255,255,.14) 82%)'
    const btnBox =
      'background:#fff!important;box-shadow:inset 0 0 0 1px #dadada!important;background-repeat:no-repeat!important;background-position:center!important'
    return (
      '::-webkit-scrollbar{width:16px!important;height:16px!important;background:#fff!important}' +
      '::-webkit-scrollbar-button:vertical:start:decrement,::-webkit-scrollbar-button:vertical:start:increment,' +
      '::-webkit-scrollbar-button:horizontal:start:decrement,::-webkit-scrollbar-button:horizontal:start:increment{display:none!important}' +
      '::-webkit-scrollbar-button:vertical:end:decrement,::-webkit-scrollbar-button:vertical:end:increment{display:block!important;height:15px!important;' + btnBox + '}' +
      '::-webkit-scrollbar-button:horizontal:end:decrement,::-webkit-scrollbar-button:horizontal:end:increment{display:block!important;width:15px!important;' + btnBox + '}' +
      '::-webkit-scrollbar-button:vertical:end:decrement{background-image:' + triUp('#555') + '!important}' +
      '::-webkit-scrollbar-button:vertical:end:increment{background-image:' + triDn('#555') + '!important}' +
      '::-webkit-scrollbar-button:horizontal:end:decrement{background-image:' + triLf('#555') + '!important}' +
      '::-webkit-scrollbar-button:horizontal:end:increment{background-image:' + triRt('#555') + '!important}' +
      // White rounded trough with a soft inner shadow (B00merang: base white,
      // inset 2px -2px 3px black/.3).
      '::-webkit-scrollbar-track{background:#fff!important;border-radius:8px!important;box-shadow:inset 1px 1px 2px rgba(0,0,0,.16),inset -1px -1px 1px rgba(0,0,0,.05)!important}' +
      '::-webkit-scrollbar-corner{background:#fff!important}' +
      '::-webkit-scrollbar-thumb{border-radius:8px!important;border:1px solid #123f7e!important;min-height:30px!important}' +
      '::-webkit-scrollbar-thumb:vertical{background-image:' + sheenB + ',' + crossR + '!important;background-repeat:no-repeat,no-repeat!important}' +
      '::-webkit-scrollbar-thumb:horizontal{background-image:' + sheenR + ',' + crossB + '!important;background-repeat:no-repeat,no-repeat!important}'
    )
  }

  // Windows XP Luna: cool light-blue gel with a grip, in a warm-grey tube.
  if (style === 'xp') {
    const grad = 'linear-gradient(to right,#8ea6ec 0,#c3d4fe 22%,#dcebff 45%,#bcd0f9 72%,#93abec 100%)'
    const trackGrad = 'linear-gradient(to right,#e9e6dc,#fbfbf7 55%,#efece4)'
    const bd = '#5f7fc8'
    const arrow = '#3f56a0'
    const grip = '#5872b8'
    const btn = (glyph: string, sel: string): string =>
      sel + '{' + layer(glyph, grad) + ';border:1px solid ' + bd + '!important}'
    return (
      base +
      '::-webkit-scrollbar{background:#efece4!important}' +
      '::-webkit-scrollbar-track{background:' + trackGrad + '!important}::-webkit-scrollbar-corner{background:' + trackGrad + '!important}' +
      '::-webkit-scrollbar-thumb{border:1px solid ' + bd + '!important;min-height:28px!important}' +
      '::-webkit-scrollbar-thumb:vertical{' + layer(gripH(grip), grad) + '}' +
      '::-webkit-scrollbar-thumb:horizontal{' + layer(gripV(grip), grad) + '}' +
      btn(triUp(arrow), '::-webkit-scrollbar-button:vertical:decrement') +
      btn(triDn(arrow), '::-webkit-scrollbar-button:vertical:increment') +
      btn(triLf(arrow), '::-webkit-scrollbar-button:horizontal:decrement') +
      btn(triRt(arrow), '::-webkit-scrollbar-button:horizontal:increment')
    )
  }

  // Windows 95/98/2000: a silver 50%-dithered track over white, a plain raised
  // silver thumb + arrow buttons with the canonical two-tone 3D bevel.
  if (style === 'w95') {
    const silver = '#c0c0c0'
    // The classic raised bevel: white/silver top-left, grey/black bottom-right.
    const raise =
      'box-shadow:inset -1px -1px #000,inset 1px 1px #c0c0c0,inset -2px -2px #808080,inset 2px 2px #fff!important;'
    const box = 'background:' + silver + '!important;' + raise
    const btn = (sel: string, glyph: string): string =>
      sel +
      '{' +
      box +
      'background-image:' +
      glyph +
      '!important;background-repeat:no-repeat!important;background-position:center!important}'
    return (
      base +
      '::-webkit-scrollbar{background:#fff!important}' +
      '::-webkit-scrollbar-track{background:#fff!important;background-image:' + dither(silver) + '!important}' +
      '::-webkit-scrollbar-corner{background:' + silver + '!important}' +
      '::-webkit-scrollbar-thumb{' + box + 'min-height:20px!important}' +
      btn('::-webkit-scrollbar-button:vertical:decrement', triUp('#000')) +
      btn('::-webkit-scrollbar-button:vertical:increment', triDn('#000')) +
      btn('::-webkit-scrollbar-button:horizontal:decrement', triLf('#000')) +
      btn('::-webkit-scrollbar-button:horizontal:increment', triRt('#000'))
    )
  }

  // Classic Mac looks (System 7, and its 1-bit monochrome sibling for System 6).
  // Palette sampled from the reference sprite: a 25% grey stippled track, a grey
  // thumb with periwinkle grip ridges and bevel, lighter-grey boxed arrows. The
  // monochrome sibling reduces the same shapes to pure black on white.
  const mono = style === 'sys7mono'
  const ink = '#000'
  // Thumb: grey face, periwinkle grip + 3D bevel (light #ccccff / dark #333366).
  const thumbFace = mono ? '#fff' : '#aaaaaa'
  const ridge = mono ? '#000' : '#666699'
  const thumbBevel = mono ? '' : 'box-shadow:inset 1px 1px #ccccff,inset -1px -1px #333366!important;'
  // Arrow buttons: lighter grey face with a white/grey bevel.
  const btnFace = mono ? '#fff' : '#dddddd'
  const btnBevel = mono ? '' : 'box-shadow:inset 1px 1px #fff,inset -1px -1px #777!important;'
  // Stipple dots over an OPAQUE base (white for mono, #ddd for colour) — without
  // the base colour the 75%-transparent tile lets the page show through.
  const trackBase = mono ? '#fff' : '#dddddd'
  const trackFill = mono ? stipple('#000') : stipple('#777777')
  const btn = (sel: string, glyph: string): string =>
    sel +
    '{background:' +
    btnFace +
    '!important;border:1px solid ' +
    ink +
    '!important;' +
    btnBevel +
    'background-image:' +
    glyph +
    '!important;background-repeat:no-repeat!important;background-position:center!important}'
  const thumb =
    'background:' + thumbFace + '!important;border:1px solid ' + ink + '!important;' + thumbBevel
  return (
    base +
    '::-webkit-scrollbar{background:' + trackBase + '!important}' +
    '::-webkit-scrollbar-track{background:' + trackBase + '!important;background-image:' + trackFill + '!important;box-shadow:inset 1px 0 #000,inset -1px 0 #000!important}' +
    '::-webkit-scrollbar-corner{background:' + thumbFace + '!important}' +
    '::-webkit-scrollbar-thumb{' + thumb + 'min-height:24px!important}' +
    '::-webkit-scrollbar-thumb:vertical{' + layer(gripH(ridge), thumbFace) + ';' + thumbBevel + 'border:1px solid ' + ink + '!important}' +
    '::-webkit-scrollbar-thumb:horizontal{' + layer(gripV(ridge), thumbFace) + ';' + thumbBevel + 'border:1px solid ' + ink + '!important}' +
    btn('::-webkit-scrollbar-button:vertical:decrement', triUp(ink)) +
    btn('::-webkit-scrollbar-button:vertical:increment', triDn(ink)) +
    btn('::-webkit-scrollbar-button:horizontal:decrement', triLf(ink)) +
    btn('::-webkit-scrollbar-button:horizontal:increment', triRt(ink))
  )
}

let filterKey: string | null = null
let typoKey: string | null = null
let scrollKey: string | null = null
function applyDisplay(
  mode: { depth?: string; dither?: boolean; typo?: string; scrollbar?: string } | null
): void {
  const drop = (k: string | null): null => {
    try {
      if (k) webFrame.removeInsertedCSS(k)
    } catch {
      /* frame gone — ignore */
    }
    return null
  }
  filterKey = drop(filterKey)
  typoKey = drop(typoKey)
  scrollKey = drop(scrollKey)
  const fcss = displayCss(mode)
  if (fcss) {
    try {
      filterKey = webFrame.insertCSS(fcss)
    } catch {
      /* insertCSS unavailable this early — ignore */
    }
  }
  const tcss = typographyCss(mode?.typo)
  if (tcss) {
    try {
      typoKey = webFrame.insertCSS(tcss)
    } catch {
      /* ignore */
    }
  }
  const scss = scrollbarCss(mode?.scrollbar)
  if (scss) {
    try {
      scrollKey = webFrame.insertCSS(scss)
    } catch {
      /* ignore */
    }
  }
}

// Read the mode for THIS origin synchronously at document-start (before first
// paint) so a per-site override lands without a flash.
try {
  applyDisplay(ipcRenderer.sendSync('page:getDisplay', location.origin))
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
