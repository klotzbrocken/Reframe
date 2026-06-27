import { useEffect, useLayoutEffect, useState } from 'react'
import { requestChromeTop } from '../shell/chromeTop'

/** Bump to re-show the tour after a future update (once per version). */
export const TOUR_VERSION = '1.2.0'

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
    title: 'New: quick controls',
    body: 'Everything new lives in this little hub — here is a quick look.',
    color: '#ff6a13'
  },
  {
    target: '[data-tour="theme"]',
    title: 'Switch theme',
    body: 'Jump between the retro browser skins instantly.',
    color: '#2f6fed'
  },
  {
    target: '[data-tour="timemachine"]',
    title: 'Time machine',
    body: 'Pick a year, then Time-Travel (Wayback) — or AI-render this page in that year’s style.',
    color: '#8b5cf6'
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
  let pointLeft = false // arrow points left (target is to our left)
  let arrowLeft = PAD
  let arrowTop = PAD
  let cardLeft = PAD
  let cardTop = PAD
  if (rect) {
    const cy = rect.top + rect.height / 2
    const roomLeft = rect.left - (CARD_W + ARROW_LEN + GAP * 2) > 8
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
        </>
      )}
      <div className="ow-tour__card" style={{ top: cardTop, left: cardLeft, width: CARD_W }}>
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
