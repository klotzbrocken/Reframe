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

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]

interface Props {
  themes: ThemeItem[]
  themeId: string
  onTheme: (id: string) => void
  oldWeb: boolean
  /** Currently selected Wayback year (0 / undefined = none yet). */
  waybackYear: number
  /** Currently selected Wayback month (1–12). */
  waybackMonth: number
  /** Set the Wayback year+month AND time-travel to it immediately (Old Web on). */
  onWayback: (year: number, month: number) => void
  /** "Today" — back to today's live web. */
  onWaybackOff: () => void
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
  waybackMonth,
  onWayback,
  onWaybackOff,
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
  const [month, setMonth] = useState(waybackMonth || 6)
  const ref = useRef<HTMLDivElement>(null)
  const panelOpen = open || !!forceOpen

  // Time-travel on slider RELEASE (so the page loads as soon as you pick a year
  // or month, without flooding loads while dragging). Refs keep the values
  // current inside the release handler.
  const yearRef = useRef(year)
  yearRef.current = year
  const monthRef = useRef(month)
  monthRef.current = month
  const travel = (): void => onWayback(yearRef.current, monthRef.current)

  // Derived "mode": where the page comes from.
  const mode: 'today' | 'travel' = oldWeb ? 'travel' : 'today'

  useEffect(() => {
    if (waybackYear) setYear(waybackYear)
  }, [waybackYear])
  useEffect(() => {
    if (waybackMonth) setMonth(waybackMonth)
  }, [waybackMonth])

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
  const statusText =
    mode === 'today' ? 'live web · today' : `Wayback archive · ${MONTHS[month - 1]}`

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

            {/* Year — selecting a value loads that archived page immediately. */}
            <input
              type="range"
              className="ow-fab__range"
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={year}
              aria-label="Wayback year"
              onChange={(e) => setYear(Number(e.target.value))}
              onPointerUp={travel}
              onKeyUp={travel}
            />
            <div className="ow-fab__years">
              <span>{MIN_YEAR}</span>
              <span>{MAX_YEAR}</span>
            </div>

            {/* Month — 12 discrete steps; release reloads that month's snapshot.
                The chosen month shows in the status line above, not in the scale. */}
            <input
              type="range"
              className="ow-fab__range"
              min={1}
              max={12}
              step={1}
              value={month}
              aria-label={'Wayback month — ' + MONTHS[month - 1]}
              onChange={(e) => setMonth(Number(e.target.value))}
              onPointerUp={travel}
              onKeyUp={travel}
            />
            <div className="ow-fab__years">
              <span>Jan</span>
              <span>Dec</span>
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
                  onWayback(year, month)
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
