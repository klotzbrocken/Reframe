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
import type { WaybackTimeline } from '../../shared/types'

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

// The year slider runs MIN_YEAR…MAX_YEAR, plus one extra stop on the far right
// that means "Today" (live web) — so the slider replaces the old Today/Time-Travel
// buttons: drag fully right for today, drag left to time-travel.
const TODAY_STOP = MAX_YEAR + 1

// Colour-depth choices for the flyout's quick Display control (short labels).
const DEPTH_OPTS: { id: string; label: string }[] = [
  { id: 'off', label: 'True colour' },
  { id: '16bit', label: '16-bit' },
  { id: '8bit', label: '256' },
  { id: '216', label: '216' },
  { id: '1bit', label: '1-bit' }
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
  /** "Today vs {year}" share/export (icon at the top of the panel). */
  shareYear: string
  onShare: () => void
  /** Force the flyout open (used by the first-run coachmark tour). */
  forceOpen?: boolean
  speed: string
  speedOpts: SpeedItem[]
  onSpeed: (id: string) => void
  /** Quick global colour-depth + dither controls (mirror of Settings). */
  colorDepth: string
  onColorDepth: (id: string) => void
  dither: boolean
  onDither: (on: boolean) => void
  /** Archive Timeline: real Wayback capture density for the current page. */
  timeline: WaybackTimeline
  /** True while the timeline for the current page is being fetched. */
  timelineLoading?: boolean
  /** Load the real captures for a given year (panel open + when the year changes). */
  onYear?: (year: number) => void
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
  onSpeed,
  colorDepth,
  onColorDepth,
  dither,
  onDither,
  timeline,
  timelineLoading,
  onYear
}: Props) {
  const [open, setOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [year, setYear] = useState(oldWeb ? waybackYear || 2001 : TODAY_STOP)
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
  // On release: the far-right stop returns to the live web, any year time-travels.
  const travel = (): void =>
    yearRef.current >= TODAY_STOP ? onWaybackOff() : onWayback(yearRef.current, monthRef.current)

  // Load a year's real captures when the panel opens and (debounced) whenever the
  // selected year settles — the calendar API is queried one year at a time.
  useEffect(() => {
    if (!panelOpen) return
    const t = setTimeout(() => onYear?.(yearRef.current), 250)
    return () => clearTimeout(t)
  }, [panelOpen, year, onYear])

  // --- Archive Timeline helpers: click a bar to land on a real snapshot. ---
  const YEARS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i)
  const monthCount = (y: number, m: number): number =>
    timeline.months[`${y}${String(m).padStart(2, '0')}`] ?? 0
  const maxMonth = Math.max(1, ...Array.from({ length: 12 }, (_, i) => monthCount(year, i + 1)))
  const firstMonth = (y: number): number => {
    for (let m = 1; m <= 12; m++) if (monthCount(y, m) > 0) return m
    return monthRef.current
  }
  const pickYear = (y: number): void => {
    const m = firstMonth(y)
    setYear(y)
    setMonth(m)
    onWayback(y, m)
  }
  const pickMonth = (m: number): void => {
    setMonth(m)
    onWayback(yearRef.current, m)
  }

  // Derived "mode" follows the slider position: the far-right stop = today.
  const isToday = year >= TODAY_STOP
  const mode: 'today' | 'travel' = isToday ? 'today' : 'travel'

  // Keep the thumb in sync with the actual page state: today parks it far right,
  // an active Wayback year moves it to that year.
  useEffect(() => {
    if (!oldWeb) setYear(TODAY_STOP)
    else if (waybackYear) setYear(waybackYear)
  }, [oldWeb, waybackYear])
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
                className="ow-fab__hdshare"
                title={`Share · Today vs ${shareYear}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onShare()
                  setOpen(false)
                }}
              >
                <span aria-hidden>↗</span> Share
              </button>
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
              </span>
            </div>

            {/* Archive Timeline — real capture density per year. Click a bar to
                jump to a year that actually has snapshots; empty years are dimmed. */}
            <div className={'ow-fab__hist' + (timelineLoading ? ' is-loading' : '')}>
              {YEARS.map((y) => {
                const known = timeline.years[y] !== undefined
                const n = timeline.years[y] ?? 0
                const cls = y === year ? ' is-sel' : known ? (n ? '' : ' is-empty') : ' is-unknown'
                const h = known ? (n ? 15 + Math.round((n / 12) * 85) : 8) : 22
                return (
                  <button
                    key={y}
                    type="button"
                    className={'ow-fab__bar' + cls}
                    style={{ height: h + '%' }}
                    title={
                      known
                        ? n
                          ? `${y} · ${n} month${n > 1 ? 's' : ''} archived`
                          : `${y} · no snapshots`
                        : String(y)
                    }
                    aria-label={String(y)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      pickYear(y)
                    }}
                  />
                )
              })}
            </div>

            {/* Year — selecting a value loads that archived page immediately. */}
            <input
              type="range"
              className="ow-fab__range"
              min={MIN_YEAR}
              max={TODAY_STOP}
              value={year}
              aria-label="Wayback year — far right is today"
              onChange={(e) => setYear(Number(e.target.value))}
              onPointerUp={travel}
              onKeyUp={travel}
            />
            <div className="ow-fab__years">
              <span>{MIN_YEAR}</span>
              <span>Today</span>
            </div>

            {/* Month controls only make sense while time-travelling — hidden at Today. */}
            {!isToday && (
              <>
                {/* Month timeline — which months of the selected year were archived. */}
                <div className="ow-fab__hist ow-fab__hist--month">
                  {MONTHS.map((mn, i) => {
                    const m = i + 1
                    const c = monthCount(year, m)
                    const has = c > 0
                    return (
                      <button
                        key={mn}
                        type="button"
                        className={
                          'ow-fab__bar' + (has ? '' : ' is-empty') + (m === month ? ' is-sel' : '')
                        }
                        style={{ height: has ? 15 + Math.round((c / maxMonth) * 85) + '%' : '8%' }}
                        title={`${mn} ${year}${has ? ` · ${c} capture${c > 1 ? 's' : ''}` : ' · no snapshot'}`}
                        aria-label={`${mn} ${year}${has ? '' : ' — no snapshot'}`}
                        disabled={!has}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          pickMonth(m)
                        }}
                      />
                    )
                  })}
                </div>

                {/* Month — 12 discrete steps; release reloads that month's snapshot. */}
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

                {timeline.years[year] === 0 && !timelineLoading && (
                  <div className="ow-fab__hint">No snapshots in {year} — try another year.</div>
                )}
              </>
            )}
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

          <div className="ow-fab__div" />

          {/* ---- Retro display (global colour depth + dither) ---- */}
          <div className="ow-fab__section">
            <div className="ow-fab__title">Retro Display</div>
            <div className="ow-fab__displayrow">
              <select
                className="ow-fab__select"
                value={colorDepth}
                aria-label="Colour depth"
                onChange={(e) => onColorDepth(e.target.value)}
              >
                {DEPTH_OPTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <label className="ow-fab__check">
                <input
                  type="checkbox"
                  checked={dither}
                  disabled={colorDepth === 'off'}
                  onChange={(e) => onDither(e.target.checked)}
                />
                <span>Dither</span>
              </label>
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
