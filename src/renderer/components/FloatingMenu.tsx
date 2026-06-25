import { useEffect, useRef, useState } from 'react'
import { requestChromeTop } from '../shell/chromeTop'

interface ThemeItem {
  id: string
  name: string
}
interface SpeedItem {
  id: string
  label: string
}

interface Props {
  themes: ThemeItem[]
  themeId: string
  onTheme: (id: string) => void
  oldWeb: boolean
  /** Currently selected Wayback year (0 / undefined = none yet). */
  waybackYear: number
  /** Set the Wayback year AND time-travel to it (activates Old Web). */
  onWayback: (year: number) => void
  /** Leave Wayback — back to today's live web. */
  onWaybackOff: () => void
  speed: string
  speedOpts: SpeedItem[]
  onSpeed: (id: string) => void
}

const MIN_YEAR = 1996
const MAX_YEAR = 2008

/**
 * A theme-independent floating control (bottom-right) with a flyout for the
 * three things people switch most: the retro theme, the Wayback year (which it
 * also activates) and the Time-Warp connection speed. It lives in the chrome and
 * floats the chrome above the page while the flyout is open (requestChromeTop),
 * so the panel is never clipped by the page view.
 */
export function FloatingMenu({
  themes,
  themeId,
  onTheme,
  oldWeb,
  waybackYear,
  onWayback,
  onWaybackOff,
  speed,
  speedOpts,
  onSpeed
}: Props) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(waybackYear || 2001)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (waybackYear) setYear(waybackYear)
  }, [waybackYear])

  useEffect(() => {
    requestChromeTop('fab', open)
    return () => requestChromeTop('fab', false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className={'ow-fab' + (open ? ' is-open' : '')} ref={ref}>
      {open && (
        <div className="ow-fab__panel">
          <div className="ow-fab__section">
            <div className="ow-fab__title">Theme</div>
            <div className="ow-fab__wrap">
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={'ow-fab__chip' + (t.id === themeId ? ' is-active' : '')}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onTheme(t.id)
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="ow-fab__section">
            <div className="ow-fab__title">
              Wayback{oldWeb ? ` · live (${year})` : ''}
            </div>
            <input
              type="range"
              className="ow-fab__range"
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              onMouseUp={() => onWayback(year)}
              onKeyUp={() => onWayback(year)}
            />
            <div className="ow-fab__years">
              <span>{MIN_YEAR}</span>
              <strong>{year}</strong>
              <span>{MAX_YEAR}</span>
            </div>
            <div className="ow-fab__wrap">
              <button
                type="button"
                className={'ow-fab__chip' + (oldWeb ? ' is-active' : '')}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onWayback(year)
                }}
              >
                Time-travel to {year}
              </button>
              <button
                type="button"
                className={'ow-fab__chip' + (!oldWeb ? ' is-active' : '')}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onWaybackOff()
                }}
              >
                Today
              </button>
            </div>
          </div>

          <div className="ow-fab__section">
            <div className="ow-fab__title">Connection speed</div>
            <div className="ow-fab__wrap">
              {speedOpts.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={'ow-fab__chip' + ((speed || 'full') === s.id ? ' is-active' : '')}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onSpeed(s.id)
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        className="ow-fab__btn"
        title="Reframe controls — theme, Wayback year, connection speed"
        aria-label="Reframe controls"
        onMouseDown={(e) => {
          e.preventDefault()
          setOpen((o) => !o)
        }}
      >
        <span className="ow-fab__glyph" aria-hidden>
          {open ? '▾' : '◷'}
        </span>
      </button>
    </div>
  )
}
