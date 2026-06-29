import { useEffect, useRef, useState } from 'react'
import { requestChromeTop } from '../shell/chromeTop'
import { WAYBACK_MIN_YEAR as MIN_YEAR, WAYBACK_MAX_YEAR as MAX_YEAR } from '../shell/wayback'

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
  /** "Off" — back to today's live web (also exits a Period Render). */
  onWaybackOff: () => void
  /** Persist the slider year (no time-travel); drives Time-Travel + Period Render. */
  onYearChange: (year: number) => void
  /** Period Render (AI): can it run (key set + active tab), and its state. */
  canPeriodRender: boolean
  periodBusy: boolean
  periodActive: boolean
  periodError: string | null
  onPeriodRender: () => void
  /** "Today vs {year}" share/export. */
  shareYear: string
  onShare: () => void
  /** Force the flyout open (used by the first-run coachmark tour). */
  forceOpen?: boolean
  speed: string
  speedOpts: SpeedItem[]
  onSpeed: (id: string) => void
}


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
  onYearChange,
  canPeriodRender,
  periodBusy,
  periodActive,
  periodError,
  onPeriodRender,
  shareYear,
  onShare,
  forceOpen,
  speed,
  speedOpts,
  onSpeed
}: Props) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(waybackYear || 2001)
  const ref = useRef<HTMLDivElement>(null)
  // The tour forces the panel open; user toggle/outside-click only drive `open`.
  const panelOpen = open || !!forceOpen

  useEffect(() => {
    if (waybackYear) setYear(waybackYear)
  }, [waybackYear])

  useEffect(() => {
    requestChromeTop('fab', panelOpen)
    return () => requestChromeTop('fab', false)
  }, [panelOpen])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className={'ow-fab' + (panelOpen ? ' is-open' : '')} ref={ref}>
      {panelOpen && (
        <div className="ow-fab__panel">
          <div className="ow-fab__section" data-tour="theme">
            <div className="ow-fab__title">Theme</div>
            <div className="ow-fab__wrap ow-fab__wrap--grid">
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

          <div className="ow-fab__section" data-tour="timemachine">
            <div className="ow-fab__title">Time machine{oldWeb ? ` · ${year}` : ''}</div>
            <input
              type="range"
              className="ow-fab__range"
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={year}
              onChange={(e) => {
                const y = Number(e.target.value)
                setYear(y)
                onYearChange(y)
              }}
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
                Time-Travel
              </button>
              <button
                type="button"
                className={'ow-fab__chip' + (!oldWeb && !periodActive ? ' is-active' : '')}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onWaybackOff()
                }}
              >
                Off
              </button>
            </div>
            <button
              type="button"
              className={'ow-fab__chip ow-fab__chip--wide' + (periodActive ? ' is-active' : '')}
              disabled={!canPeriodRender || periodBusy}
              onMouseDown={(e) => {
                e.preventDefault()
                onPeriodRender()
                setOpen(false)
              }}
            >
              {periodBusy ? 'Rendering…' : 'Period-Render this Page (AI)'}
            </button>
            <button
              type="button"
              className="ow-fab__chip ow-fab__chip--wide"
              onMouseDown={(e) => {
                e.preventDefault()
                onShare()
                setOpen(false)
              }}
            >
              Share: Today vs {shareYear}
            </button>
            {!canPeriodRender && (
              <div className="ow-fab__hint">Add your OpenAI key in Settings for Period Render.</div>
            )}
            {periodError && <div className="ow-fab__hint ow-fab__hint--err">{periodError}</div>}
          </div>

          <div className="ow-fab__section">
            <div className="ow-fab__title">Page-Load Speed</div>
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
        data-tour="fab"
        title="Reframe controls — theme, Wayback, Period Render, page-load speed"
        aria-label="Reframe controls"
        onMouseDown={(e) => {
          e.preventDefault()
          setOpen((o) => !o)
        }}
      >
        <span className="ow-fab__glyph" aria-hidden>
          {panelOpen ? '▾' : '◷'}
        </span>
      </button>
    </div>
  )
}
