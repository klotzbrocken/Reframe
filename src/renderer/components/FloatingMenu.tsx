/**
 * FloatingMenu — the bottom-centre Reframe control hub.
 *
 *  - Entry point is a neutral "R✦" disc (CSS-only), kept bottom-centre.
 *  - Panel: 90s-grey card; Time Machine leads (year + Today / Time-Travel),
 *    then a compact Theme dropdown and the page-load speed.
 *  - Slider has no fill, is full-width, and is disabled in Today mode.
 *
 * Styling lives in the "Floating controls — redesign" block of base.css.
 */
import { useEffect, useRef, useState } from 'react'
import { requestChromeTop } from '../shell/chromeTop'
import { WAYBACK_MIN_YEAR as MIN_YEAR, WAYBACK_MAX_YEAR as MAX_YEAR } from '../shell/wayback'

interface ThemeItem {
  id: string
  name: string
  /** e.g. "1999 · Win 98" — abbreviate "Windows" → "Win". Optional. */
  era?: string
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
  /** "Today" — back to today's live web. */
  onWaybackOff: () => void
  /** Persist the slider year (no time-travel); drives Time-Travel. */
  onYearChange: (year: number) => void
  /** "Today vs {year}" share/export. */
  shareYear: string
  onShare: () => void
  /** Force the flyout open (used by the first-run coachmark tour). */
  forceOpen?: boolean
  speed: string
  speedOpts: SpeedItem[]
  onSpeed: (id: string) => void
}

export function FloatingMenu({
  themes,
  themeId,
  onTheme,
  oldWeb,
  waybackYear,
  onWayback,
  onWaybackOff,
  onYearChange,
  shareYear,
  onShare,
  forceOpen,
  speed,
  speedOpts,
  onSpeed
}: Props) {
  const [open, setOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [year, setYear] = useState(waybackYear || 2001)
  const ref = useRef<HTMLDivElement>(null)
  const panelOpen = open || !!forceOpen

  // Derived "mode": where the page comes from.
  const mode: 'today' | 'travel' = oldWeb ? 'travel' : 'today'

  useEffect(() => {
    if (waybackYear) setYear(waybackYear)
  }, [waybackYear])

  useEffect(() => {
    requestChromeTop('fab', panelOpen)
    return () => requestChromeTop('fab', false)
  }, [panelOpen])

  // Click-outside closes the panel (and the theme dropdown with it).
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setThemeOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Escape closes the theme dropdown first, then the panel.
  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (themeOpen) setThemeOpen(false)
      else setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [panelOpen, themeOpen])

  const current = themes.find((t) => t.id === themeId) || themes[0]
  const bigText = mode === 'today' ? 'Today' : String(year)
  const statusText = mode === 'today' ? 'live web · today' : 'Wayback archive'

  return (
    <div className={'ow-fab' + (panelOpen ? ' is-open' : '')} ref={ref}>
      {panelOpen && (
        <div className="ow-fab__panel">
          {/* ---- Time Machine (hero) ---- */}
          <div className="ow-fab__section" data-tour="timemachine">
            <div className="ow-fab__hd">
              <span className="ow-fab__mark" aria-hidden>
                R<i>✦</i>
              </span>
              <span className="ow-fab__title">Time Machine</span>
              <button
                type="button"
                className="ow-fab__close"
                aria-label="Close"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setOpen(false)
                }}
              >
                ▾
              </button>
            </div>

            <div className="ow-fab__big">
              <span className={'ow-fab__bigval' + (mode === 'today' ? ' is-word' : '')}>
                {bigText}
              </span>
              <span className="ow-fab__bigmeta">
                <span className={'ow-fab__status ow-fab__status--' + mode}>{statusText}</span>
                {mode === 'today' && <span className="ow-fab__target">· target {year}</span>}
              </span>
            </div>

            <input
              type="range"
              className="ow-fab__range"
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={year}
              disabled={mode === 'today'}
              onChange={(e) => {
                const y = Number(e.target.value)
                setYear(y)
                onYearChange(y)
              }}
            />
            <div className="ow-fab__years">
              <span>{MIN_YEAR}</span>
              <span>{MAX_YEAR}</span>
            </div>

            {/* mode segment */}
            <div className="ow-fab__seg" role="group" aria-label="Page source">
              <button
                type="button"
                className={'ow-fab__segbtn' + (mode === 'today' ? ' is-active' : '')}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onWaybackOff()
                }}
              >
                Today
              </button>
              <button
                type="button"
                className={'ow-fab__segbtn' + (mode === 'travel' ? ' is-active' : '')}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onWayback(year)
                }}
              >
                Time-Travel
              </button>
            </div>

            <button
              type="button"
              className="ow-fab__share"
              onMouseDown={(e) => {
                e.preventDefault()
                onShare()
                setOpen(false)
              }}
            >
              <span aria-hidden>↗</span> Share · Today vs {shareYear}
            </button>
          </div>

          <div className="ow-fab__div" />

          {/* ---- Theme (dropdown) ---- */}
          <div className="ow-fab__section" data-tour="theme">
            <div className="ow-fab__title">Theme</div>
            <div className="ow-fab__dd">
              <button
                type="button"
                className="ow-fab__ddtrigger"
                aria-haspopup="listbox"
                aria-expanded={themeOpen}
                onMouseDown={(e) => {
                  e.preventDefault()
                  setThemeOpen((o) => !o)
                }}
              >
                <span className="ow-fab__ddname">{current?.name}</span>
                {current?.era && <span className="ow-fab__ddera">{current.era}</span>}
                <span className="ow-fab__ddchev" aria-hidden>
                  ▾
                </span>
              </button>
              {themeOpen && (
                <div className="ow-fab__ddlist" role="listbox">
                  {themes.map((t) => {
                    const active = t.id === themeId
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={'ow-fab__ddrow' + (active ? ' is-active' : '')}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          onTheme(t.id)
                          setThemeOpen(false)
                        }}
                      >
                        <span className="ow-fab__ddname">{t.name}</span>
                        {t.era && <span className="ow-fab__ddera">{t.era}</span>}
                        <span className="ow-fab__ddcheck" aria-hidden>
                          {active ? '✓' : ''}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="ow-fab__div" />

          {/* ---- Page-Load Speed ---- */}
          <div className="ow-fab__section">
            <div className="ow-fab__title">Page-Load Speed</div>
            <div className="ow-fab__seg ow-fab__seg--speed">
              {speedOpts.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={'ow-fab__segbtn' + ((speed || 'full') === s.id ? ' is-active' : '')}
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

      {/* ---- Entry point: the R✦ marker ---- */}
      <button
        type="button"
        className="ow-fab__btn"
        data-tour="fab"
        title="Reframe controls — theme, time machine, page-load speed"
        aria-label="Reframe controls"
        onMouseDown={(e) => {
          e.preventDefault()
          setOpen((o) => !o)
        }}
      >
        <span className="ow-fab__mark ow-fab__mark--btn" aria-hidden>
          R<i>✦</i>
        </span>
      </button>
    </div>
  )
}
