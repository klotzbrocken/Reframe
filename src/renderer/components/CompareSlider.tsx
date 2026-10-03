import { useCallback, useEffect, useRef } from 'react'

interface Props {
  /** Capturing both pages takes a few seconds. */
  busy: boolean
  error: string | null
  /** The archive had nothing near the requested year; this is its closest. */
  suggestYear: number | null
  onUseSuggest: () => void
  /** PNG data URL of the live page. */
  today: string | null
  /** PNG data URL of the archived snapshot. */
  then: string | null
  /** The snapshot's OWN year — never the one the user wished for. */
  year: string
  onClose: () => void
}

/**
 * "Then and now": the archived page and the live page as one frame, with a
 * handle you drag across to wipe between them — a before/after photo slider
 * pointed at a website.
 *
 * Both halves are STILL IMAGES on purpose, not two live pages. A WebContentsView
 * is positioned by its bounds, and bounds are a viewport, not a crop: giving one
 * half the width reflows the page at half the width instead of revealing half of
 * it. A 2024 page at 400px looks nothing like its 800px self, so a live split
 * would lie exactly where the comparison should be most striking. Electron has
 * no clip or mask on a view, so there is no way around it — and a frozen wipe is
 * what a before/after slider is anyway.
 *
 * The handle writes its position straight to the DOM through refs rather than
 * going through state, so dragging doesn't re-render the tree on every pointer
 * move (the same reason the AOL MDI drag in App.tsx keeps its geometry in a ref).
 */
export function CompareSlider({
  busy,
  error,
  suggestYear,
  onUseSuggest,
  today,
  then,
  year,
  onClose
}: Props): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const thenRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLButtonElement>(null)
  const pct = useRef(50)

  const paint = useCallback(() => {
    // The archived layer covers the full frame and is clipped from the right,
    // so the live page shows through behind it. Clipping never rescales either
    // image — both keep the layout they were captured with.
    if (thenRef.current) thenRef.current.style.clipPath = `inset(0 ${100 - pct.current}% 0 0)`
    if (handleRef.current) handleRef.current.style.left = `${pct.current}%`
  }, [])

  const setFromX = useCallback(
    (clientX: number) => {
      const el = rootRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.width <= 0) return
      pct.current = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100))
      paint()
    },
    [paint]
  )

  useEffect(() => {
    pct.current = 50
    paint()
  }, [today, then, paint])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setFromX(e.clientX)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) setFromX(e.clientX)
  }
  // The handle is a button, so it is focusable; the arrow keys have to move it
  // too, or the comparison is mouse-only.
  const onKeyDown = (e: React.KeyboardEvent): void => {
    const step = e.shiftKey ? 10 : 2
    if (e.key === 'ArrowLeft') pct.current = Math.max(0, pct.current - step)
    else if (e.key === 'ArrowRight') pct.current = Math.min(100, pct.current + step)
    else return
    e.preventDefault()
    paint()
  }

  const ready = !busy && !error && !suggestYear && today && then

  return (
    <div className="ow-compare" ref={rootRef} role="dialog" aria-label={`Then and now: ${year}`}>
      {ready ? (
        <>
          <img className="ow-compare__img" src={today} alt="" draggable={false} />
          <div className="ow-compare__then" ref={thenRef}>
            <img className="ow-compare__img" src={then} alt="" draggable={false} />
          </div>
          <button
            type="button"
            className="ow-compare__handle"
            ref={handleRef}
            aria-label="Drag to compare"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onKeyDown={onKeyDown}
          />
          <span className="ow-compare__tag ow-compare__tag--then">{year}</span>
          <span className="ow-compare__tag ow-compare__tag--now">Today</span>
        </>
      ) : (
        <div className="ow-compare__msg">
          {busy ? (
            <>
              <span className="ow-compare__spin" aria-hidden />
              Capturing both pages…
            </>
          ) : suggestYear ? (
            <>
              <p>No snapshot near that year. The closest one is {suggestYear}.</p>
              <button type="button" className="ow-compare__btn" onClick={onUseSuggest}>
                Compare with {suggestYear}
              </button>
            </>
          ) : (
            <p>{error}</p>
          )}
        </div>
      )}
      <button type="button" className="ow-compare__close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  )
}
