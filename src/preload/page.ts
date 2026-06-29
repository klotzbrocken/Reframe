/**
 * Page preload (runs in every tab's WebContentsView, sandboxed). Its ONLY job is
 * to turn a two-finger horizontal trackpad swipe into history back/forward, the
 * way every native macOS browser does. It exposes nothing to the page itself —
 * it just listens for wheel deltas and sends one IPC message.
 *
 * To avoid hijacking real horizontal scrolling, a swipe only navigates when the
 * page cannot scroll further in that direction (i.e. it's at the edge), which
 * mirrors Chromium's own overscroll-to-navigate behaviour.
 */
import { ipcRenderer } from 'electron'

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
