import { useEffect, useLayoutEffect, useState } from 'react'
import { requestChromeTop } from '../shell/chromeTop'

/** Bump to re-show the tour after a future update (once per version). */
export const TOUR_VERSION = '1.4.0'

export interface TourStep {
  /** CSS selector of the chrome element to point at. */
  target: string
  title: string
  body: string
  /** Bright accent colour for the arrow, ring and label. */
  color: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="fab"]',
    title: 'Quick controls',
    body: 'Everything lives in this little hub — click it any time. Here’s a quick look.',
    color: '#ff6a13'
  },
  {
    target: '[data-tour="timemachine"]',
    title: 'Time machine',
    body: 'Pick a year, then Time-Travel (Wayback) to it. You can also share a “Today vs {year}” image from here.',
    color: '#8b5cf6'
  },
  {
    target: '[data-tour="theme"]',
    title: 'Switch theme',
    body: 'Pick a retro browser skin from the dropdown — now including Camino 2.0, the Mac-native browser with a real macOS menu bar.',
    color: '#2f6fed'
  },
  {
    target: '.ow-statusbar',
    title: 'Dial-up modem (new)',
    body: 'Turn on Modem-Emulation in Settings and a modem widget with blinking LEDs appears down here — the first page of each session connects with an authentic dial-up handshake before it loads.',
    color: '#12b886'
  }
]

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const ARROW_LEN = 62
const CARD_W = 230
const CARD_H = 112 // estimate for placing wide-target cards above/below
const GAP = 10
const PAD = 12

/**
 * First-run coachmark tour. Deliberately NON-dimming: the page stays visible and
 * the overlay is click-through (only its buttons take clicks). Each step draws a
 * glowing colour ring around the feature plus a bright animated arrow and a
 * compact colour label.
 */
export function TourOverlay({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const step = steps[i]

  useEffect(() => {
    requestChromeTop('tour', true)
    return () => requestChromeTop('tour', false)
  }, [])

  useLayoutEffect(() => {
    const measure = (): void => {
      const el = step ? document.querySelector(step.target) : null
      if (!el) {
        setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [step])

  if (!step) return null

  const last = i === steps.length - 1
  const next = (): void => (last ? onDone() : setI((n) => n + 1))

  // Lay the arrow + label to the left of the target if there's room, else right.
  // For a target too wide for either side (e.g. the full-width status bar), drop
  // the side arrow and place the card centred above (or below) it instead.
  let showArrow = true
  let pointLeft = false // arrow points left (target is to our left)
  let arrowLeft = PAD
  let arrowTop = PAD
  let cardLeft = PAD
  let cardTop: number | undefined = PAD
  // For a wide target we anchor the card's BOTTOM just above it and let it grow
  // upward, so a tall (multi-line) card never overflows the viewport.
  let cardBottom: number | undefined
  if (rect) {
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const roomLeft = rect.left - (CARD_W + ARROW_LEN + GAP * 2) > 8
    const roomRight =
      rect.left + rect.width + ARROW_LEN + GAP * 2 + CARD_W < window.innerWidth - 8
    if (roomLeft || roomRight) {
      if (roomLeft) {
        pointLeft = false
        arrowLeft = rect.left - GAP - ARROW_LEN
        cardLeft = arrowLeft - GAP - CARD_W
      } else {
        pointLeft = true
        arrowLeft = rect.left + rect.width + GAP
        cardLeft = arrowLeft + ARROW_LEN + GAP
      }
      arrowTop = cy - 17
      cardTop = Math.max(PAD, Math.min(cy - 52, window.innerHeight - 132))
    } else {
      showArrow = false
      cardLeft = Math.max(PAD, Math.min(cx - CARD_W / 2, window.innerWidth - CARD_W - PAD))
      const roomAbove = rect.top - GAP - CARD_H > 8
      if (roomAbove) {
        cardTop = undefined
        cardBottom = window.innerHeight - (rect.top - GAP) // bottom edge above the target
      } else {
        cardTop = rect.top + rect.height + GAP
      }
    }
  }

  return (
    <div className="ow-tour" style={{ ['--c' as string]: step.color }}>
      {rect && (
        <>
          <div
            className="ow-tour__ring"
            style={{
              top: rect.top - 5,
              left: rect.left - 5,
              width: rect.width + 10,
              height: rect.height + 10
            }}
          />
          {showArrow && (
            <svg
              className={'ow-tour__arrow' + (pointLeft ? ' is-left' : '')}
              style={{ top: arrowTop, left: arrowLeft }}
              width={ARROW_LEN}
              height="34"
              viewBox="0 0 62 34"
              aria-hidden
            >
              <path
                d="M3 17 H46 M46 17 L33 6 M46 17 L33 28"
                fill="none"
                stroke="currentColor"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </>
      )}
      <div
        className="ow-tour__card"
        style={{
          left: cardLeft,
          width: CARD_W,
          ...(cardBottom !== undefined ? { bottom: cardBottom } : { top: cardTop })
        }}
      >
        <div className="ow-tour__title">{step.title}</div>
        <div className="ow-tour__body">{step.body}</div>
        <div className="ow-tour__row">
          <button type="button" className="ow-tour__skip" onClick={onDone}>
            Skip
          </button>
          <span className="ow-tour__dots">
            {i + 1} / {steps.length}
          </span>
          <button type="button" className="ow-tour__next" onClick={next}>
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
