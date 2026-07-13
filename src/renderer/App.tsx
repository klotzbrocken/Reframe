import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AddressBar } from './components/AddressBar'
import { MenuBar, type Menu, type MenuItem } from './components/MenuBar'
import { NavButton } from './components/NavButton'
import { FloatingMenu } from './components/FloatingMenu'
import { TourOverlay, TOUR_STEPS, TOUR_VERSION } from './components/TourOverlay'
import { ShareDialog } from './components/ShareDialog'
import { SecurityInfoDialog } from './components/SecurityInfoDialog'
import { composeShare } from './shell/shareCompose'
import { BookmarkEditDialog, type BookmarkDraft } from './components/BookmarkEditDialog'
import { Panel, type PanelEntry } from './components/Panel'
import { PersonalBar, type PersonalBarItem } from './components/PersonalBar'
import { SearchBox } from './components/SearchBox'
import { HotListPanel, type HotListEntry } from './components/HotListPanel'
import { Clock } from './components/Clock'
import { requestChromeTop } from './shell/chromeTop'
import { SettingsDialog, type Settings } from './components/SettingsDialog'
import { StatusBar } from './components/StatusBar'
import { ModemStatus, type ModemPhase } from './components/ModemStatus'
import { playDialup, dialupTimings, type DialupHandle, type ModemSpeed } from './shell/modem-sound'
import { TabStrip } from './components/TabStrip'
import { Throbber } from './components/Throbber'
import { DialGif } from './components/DialGif'
import { TitleBar } from './components/TitleBar'
import { WhatsNewDialog, WHATS_NEW_VERSION } from './components/WhatsNewDialog'
import { UrlDialog } from './components/UrlDialog'
import { DEFAULT_ENGINE_ID } from './shell/engines'
import { useShell } from './shell/useShell'
import { stripWaybackDisplay, unwrapWayback, waybackDisplay, wrapWayback } from './shell/wayback'
import type { WaybackTimeline } from '../shared/types'
import { themeEngine, safeThemeId } from './theme/loader'
import {
  DEFAULT_LABELS,
  DEFAULT_MENUS,
  DEFAULT_TOOLBAR,
  type ThemeManifest,
  type ThemeSummary,
  type ToolbarItem
} from './theme/types'

// "Time Warp Modem" speed choices shown in the Help menu (Help → Time Warp Modem).
const SPEED_OPTS: { id: NonNullable<Settings['connectionSpeed']>; label: string }[] = [
  { id: 'full', label: 'Off' },
  { id: 'isdn', label: 'ISDN (64 kbit/s)' },
  { id: '56k', label: '56K Modem' },
  { id: '28.8k', label: '28.8 Modem' }
]

// Themes whose lineage is Mac/NeXT (vs. the Windows/PC themes). Drives which
// dial-up GIF + backdrop the modem overlay shows.
const MAC_THEMES = new Set([
  'safari',
  'ie4mac',
  'ie45mac',
  'ie45macmono',
  'camino',
  'omniweb',
  'netscape4mac',
  'ns7modern'
])

export function App() {
  const loadSettings = (): Settings => {
    try {
      const s = JSON.parse(localStorage.getItem('reframe.settings') || '{}') as Settings
      // Connection speed always starts at "full" (off): the dial-up is a
      // per-session choice and never carries a slow speed across restarts.
      return { ...s, connectionSpeed: 'full' }
    } catch {
      return {}
    }
  }
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const saveSettings = (s: Settings): void => {
    setSettings(s)
    localStorage.setItem('reframe.settings', JSON.stringify(s))
  }
  const [dialogOpen, setDialogOpen] = useState(false)
  const [whatsNewOpen, setWhatsNewOpen] = useState(false)
  const [tourActive, setTourActive] = useState(false)
  const whatsNewRef = useRef(whatsNewOpen)
  whatsNewRef.current = whatsNewOpen

  // Show the What's New dialog once per version (after an update bumps it).
  useEffect(() => {
    if (localStorage.getItem('reframe.whatsnew.version') !== WHATS_NEW_VERSION) {
      setWhatsNewOpen(true)
      localStorage.setItem('reframe.whatsnew.version', WHATS_NEW_VERSION)
    }
  }, [])

  // First-run coachmark tour, once per version. Independent of What's New, but it
  // waits until that dialog (if any) has been closed so the two don't overlap.
  useEffect(() => {
    if (localStorage.getItem('reframe.tour.version') === TOUR_VERSION) return
    let cancelled = false
    const tick = (): void => {
      if (cancelled) return
      if (whatsNewRef.current) {
        window.setTimeout(tick, 400)
        return
      }
      localStorage.setItem('reframe.tour.version', TOUR_VERSION)
      setTourActive(true)
    }
    const t = window.setTimeout(tick, 350)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [])

  const [themes, setThemes] = useState<ThemeSummary[]>([])
  const [themeId, setThemeId] = useState(() => {
    // "--theme=<id>" launch parameter (main appends it as ?theme=<id> to the
    // chrome URL): overrides the saved theme for this run only, not persisted.
    const param = new URLSearchParams(window.location.search).get('theme')
    return safeThemeId(param || loadSettings().defaultTheme)
  })
  const [manifest, setManifest] = useState<ThemeManifest | null>(null)

  const { state, actions, oldWeb } = useShell(() =>
    themeEngine.playSound('navigate')
  )

  const [addrHistory, setAddrHistory] = useState<string[]>([])
  const submitAddress = (input: string): void => {
    // Clearing the whole address while time-travelling drops back to today's
    // live web instead of navigating to nothing.
    if (!input.trim()) {
      if (oldWeb) goToday()
      return
    }
    // "2007://…" — an explicit year prefix time-travels to that year, for the
    // page that follows it (or the current page if nothing follows). The year is
    // applied here; the plain display form below just strips the prefix.
    const ym = input.trim().match(/^(\d{4}):\/\/(.*)$/)
    if (ym) {
      const year = Number(ym[1])
      const date = `${year}${String(waybackMonth).padStart(2, '0')}15`
      actions.setOldWebDate(date)
      saveSettings({ ...settings, waybackYear: year })
      actions.setOldWebActive(true) // Old Web on at the chosen year
      const rest = ym[2].trim()
      if (rest) {
        const target = stripWaybackDisplay(rest)
        const full = /^[a-z][a-z0-9+.-]*:\/\//i.test(target) ? target : 'https://' + target
        setAddrHistory((h) => [full, ...h.filter((x) => x !== full)].slice(0, 10))
        if (activeTab) {
          const id = activeTab.id
          const doNav = (): void => {
            void window.oldweb.navigate(id, wrapWayback(full, date))
          }
          if (modemArmed && !connectedRef.current) startDial(doNav)
          else doNav()
        }
      }
      return
    }
    // The field may show the friendly "1999://…" wayback form — turn it back
    // into the real target before navigating (the engine re-wraps if Old Web is on).
    const original = stripWaybackDisplay(input.trim())
    const shown = /^[a-z][a-z0-9+.-]*:\/\//i.test(original) ? original : 'https://' + original
    setAddrHistory((h) => [shown, ...h.filter((x) => x !== shown)].slice(0, 10))
    gatedNavigate(original)
  }

  const waybackMonth = settings.waybackMonth || 6
  const waybackDate = settings.waybackYear
    ? `${settings.waybackYear}${String(waybackMonth).padStart(2, '0')}15`
    : manifest?.oldWebDate ?? (manifest?.oldWebYear ? String(manifest.oldWebYear) : '2002')

  // --- bookmarks & browsing history (persisted in localStorage) ---
  const loadStore = (key: string): PanelEntry[] => {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]') as PanelEntry[]
    } catch {
      return []
    }
  }
  // Default bookmarks seeded into every theme: shown in the bookmark bar where a
  // theme has one (see defaultBarItems), and always reachable via the
  // Favorites/Bookmarks panel — so they're available in every theme.
  const DEFAULT_LINKS: { label: string; url: string }[] = [
    { label: 'Weather Channel', url: 'https://weather.com/retro/' },
    { label: 'RetroMac', url: 'https://myretromac.app/' },
    { label: 'Hamsterdance', url: 'https://originalhampster.ytmnd.com/' },
    { label: 'reddit', url: 'https://old.reddit.com/' },
    { label: 'OldaVista', url: 'https://oldavista.com/' },
    // 68k.news is HTTP-only (its TLS cert doesn't match the host), so https
    // dead-ends on a cert error — keep the explicit http:// URL.
    { label: '68k.news', url: 'http://68k.news/' }
  ]
  const normUrl = (u: string): string =>
    u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')
  const [bookmarks, setBookmarks] = useState<PanelEntry[]>(() => {
    const stored = loadStore('reframe.bookmarks')
    const defaults = DEFAULT_LINKS.map((d) => ({ title: d.label, url: d.url }))
    // Per-link seeding: remember which default links have already been offered (by
    // normalized URL) so NEW defaults added in later versions still reach existing
    // installs once, while defaults the user has since deleted are not re-added.
    // (Replaces the coarse one-shot `reframe.defaultLinks.v1` flag, which froze the
    // default set at whatever shipped when a user first ran the app.)
    let seeded = new Set<string>()
    try {
      const raw = localStorage.getItem('reframe.defaultLinks.seeded')
      if (raw) seeded = new Set(JSON.parse(raw) as string[])
      else if (localStorage.getItem('reframe.defaultLinks.v1'))
        // Migrate from the old flag: the four original defaults were already
        // offered — mark them seeded so deletions of them stick.
        seeded = new Set([
          'weather.com/retro',
          'myretromac.app',
          'originalhampster.ytmnd.com',
          'old.reddit.com'
        ])
    } catch {
      /* ignore malformed storage */
    }
    const have = new Set(stored.map((b) => normUrl(b.url)))
    const toAdd = defaults.filter((d) => !seeded.has(normUrl(d.url)) && !have.has(normUrl(d.url)))
    // Record every current default as seeded so none is ever re-added later.
    localStorage.setItem(
      'reframe.defaultLinks.seeded',
      JSON.stringify([...new Set([...seeded, ...defaults.map((d) => normUrl(d.url))])])
    )
    if (stored.length === 0 && toAdd.length === 0) return defaults
    return [...toAdd, ...stored]
  })
  const [history, setHistory] = useState<PanelEntry[]>(() => loadStore('reframe.history'))
  const [panel, setPanel] = useState<{
    kind: 'bookmarks' | 'history'
    x: number
    y: number
  } | null>(null)
  useEffect(() => localStorage.setItem('reframe.bookmarks', JSON.stringify(bookmarks)), [bookmarks])
  useEffect(() => localStorage.setItem('reframe.history', JSON.stringify(history)), [history])

  // record the active tab's page into history whenever its URL settles
  const lastUrlRef = useRef('')
  useEffect(() => {
    const at = state.tabs.find((t) => t.id === state.activeId)
    const u = at?.url
    if (u && /^https?:/i.test(u) && u !== lastUrlRef.current) {
      lastUrlRef.current = u
      const title = at?.title || u
      const last = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      setHistory((h) => [{ title, url: u, last }, ...h.filter((x) => x.url !== u)].slice(0, 50))
    }
  }, [state.tabs, state.activeId])

  // --- user bookmarks on the personal/bookmark toolbar (drag & drop) ---
  interface BarBookmark {
    id: string
    label: string
    url?: string
    favicon?: string
    /** Present → this entry is a folder. */
    type?: 'folder'
    /** Id of the folder this entry lives in; top-level entries have none. The
     *  folder can be a user folder OR a theme/manifest folder ("m:<index>"), so
     *  a page can be dropped into either. */
    parentId?: string
  }
  const [barBookmarks, setBarBookmarks] = useState<BarBookmark[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('reframe.barBookmarks') || '[]') as BarBookmark[]
    } catch {
      return []
    }
  })
  const [editBookmark, setEditBookmark] = useState<{
    id: string
    label: string
    url?: string
    folder?: boolean
  } | null>(null)
  const [barMenuOpen, setBarMenuOpen] = useState(false)
  // Bookmarks-bar visibility, toggled by the Camino toolbar bookmark button.
  const [showBar, setShowBar] = useState(true)
  // Toolbar collapse (Camino's Aqua "hide toolbar" pill, top-right of the titlebar).
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  useEffect(
    () => localStorage.setItem('reframe.barBookmarks', JSON.stringify(barBookmarks)),
    [barBookmarks]
  )
  // Local overrides for the theme's DEFAULT bookmark-bar entries, so the user can
  // rename or remove them without editing the theme. Keyed by a stable "m:…" id.
  const [barOverrides, setBarOverrides] = useState<{
    hidden: string[]
    labels: Record<string, string>
    urls: Record<string, string>
  }>(() => {
    try {
      const s = JSON.parse(localStorage.getItem('reframe.barOverrides') || '{}')
      return {
        hidden: Array.isArray(s.hidden) ? s.hidden : [],
        labels: s.labels && typeof s.labels === 'object' ? s.labels : {},
        urls: s.urls && typeof s.urls === 'object' ? s.urls : {}
      }
    } catch {
      return { hidden: [], labels: {}, urls: {} }
    }
  })
  useEffect(
    () => localStorage.setItem('reframe.barOverrides', JSON.stringify(barOverrides)),
    [barOverrides]
  )
  const isManifestId = (id: string): boolean => id.startsWith('m:')
  const activeFavicon = (url: string): string | undefined => {
    const at = state.tabs.find((t) => t.id === state.activeId)
    return at && unwrapWayback(at.url) === url ? at.favicon ?? undefined : undefined
  }
  const dropBarBookmark = (url: string, title: string): void =>
    setBarBookmarks((b) => [
      ...b,
      { id: crypto.randomUUID(), label: title || url, url, favicon: activeFavicon(url) }
    ])
  const addBarFolder = (): void =>
    setBarBookmarks((b) => [...b, { id: crypto.randomUUID(), label: 'New Folder', type: 'folder' }])
  // File a dropped page inside a folder (user OR manifest folder id).
  const dropIntoFolder = (folderId: string, url: string, title: string): void =>
    setBarBookmarks((b) => [
      ...b,
      {
        id: crypto.randomUUID(),
        label: title || url,
        url,
        favicon: activeFavicon(url),
        parentId: folderId
      }
    ])
  // Remove an entry. Theme-default ("m:…") entries are hidden via an override;
  // user entries (and, if a folder, their children) are dropped from storage.
  const removeBarBookmark = (id: string): void => {
    if (isManifestId(id)) {
      setBarOverrides((o) => ({ ...o, hidden: [...o.hidden, id] }))
      return
    }
    setBarBookmarks((b) => b.filter((x) => x.id !== id && x.parentId !== id))
  }
  const saveBarBookmark = (d: BookmarkDraft): void => {
    if (isManifestId(d.id)) {
      setBarOverrides((o) => ({
        ...o,
        labels: { ...o.labels, [d.id]: d.label },
        urls: d.folder ? o.urls : { ...o.urls, [d.id]: d.url }
      }))
      return
    }
    setBarBookmarks((b) =>
      b.map((x) =>
        x.id === d.id ? { ...x, label: d.label, ...(x.type === 'folder' ? {} : { url: d.url }) } : x
      )
    )
  }

  // Opera HotList side panel — docked open by default.
  const [hotlistOpen, setHotlistOpen] = useState(true)
  // Opera image button: hide/show page images on the active tab.
  const [imagesOff, setImagesOff] = useState(false)
  // Opera "Direct URL input": a small modal to type a URL and open it.
  const [urlDialogOpen, setUrlDialogOpen] = useState(false)
  // Netscape "Security" toolbar button → the period Security Info dialog.
  const [securityOpen, setSecurityOpen] = useState(false)

  // float the chrome above the page while a panel or the settings dialog is open
  useEffect(() => {
    requestChromeTop(
      'overlays',
      panel !== null ||
        dialogOpen ||
        whatsNewOpen ||
        editBookmark !== null ||
        barMenuOpen ||
        urlDialogOpen ||
        securityOpen
    )
  }, [panel, dialogOpen, whatsNewOpen, editBookmark, barMenuOpen, urlDialogOpen, securityOpen])

  const openPanel = (kind: 'bookmarks' | 'history', selector: string): void => {
    const r = document.querySelector(selector)?.getBoundingClientRect()
    setPanel({ kind, x: r ? Math.round(r.left) : 8, y: r ? Math.round(r.bottom) : 56 })
  }
  const addBookmarkEntry = (title: string, url: string): void => {
    if (!url || !/^https?:/i.test(url)) return
    setBookmarks((b) => (b.some((x) => x.url === url) ? b : [{ title: title || url, url }, ...b]))
  }
  const addBookmark = (): void => {
    const at = state.tabs.find((t) => t.id === state.activeId)
    if (at) addBookmarkEntry(at.title, at.url)
  }

  // commands from the native app menu and the page context menu
  const waybackRef = useRef(waybackDate)
  waybackRef.current = waybackDate
  // Live copy of the theme menus shown in the real macOS bar, for routing clicks.
  const nativeMenuRef = useRef<Menu[]>([])
  useEffect(() => {
    return window.oldweb.onMenuCommand((m) => {
      if (m.cmd === 'about' || m.cmd === 'settings') setDialogOpen(true)
      else if (m.cmd === 'whats-new') setWhatsNewOpen(true)
      else if (m.cmd === 'add-bookmark') addBookmarkEntry(m.title, m.url)
      else if (m.cmd === 'reload-wayback') {
        window.oldweb.navigate(m.id, `https://web.archive.org/web/${waybackRef.current}if_/${m.url}`)
      } else if (m.cmd === 'theme-menu') {
        const it = nativeMenuRef.current[m.menu]?.items[m.item]
        if (it && it.type === 'item') it.onSelect?.()
      }
    })
  }, [])

  const contentRef = useRef<HTMLDivElement>(null)

  // --- themes ---
  useEffect(() => {
    themeEngine.list().then(setThemes)
  }, [])
  useEffect(() => {
    themeEngine.apply(themeId).then(setManifest).catch(() => setManifest(null))
  }, [themeId])
  // Switch theme on an explicit user choice. The boot splash is fired here (not
  // in an effect) so it only shows on a real switch — never at startup, where
  // the Reframe splash already runs and the main window must stay hidden.
  const switchTheme = (id: string): void => {
    if (id === themeId) return
    if (settings.themeSplash !== false) window.oldweb.showThemeSplash(id)
    setThemeId(id)
  }
  const setConnectionSpeed = (id: Settings['connectionSpeed']): void => {
    saveSettings({ ...settings, connectionSpeed: id })
    window.oldweb.setNetworkSpeed(id ?? 'full')
  }
  // Pick a Wayback year+month AND time-travel to it (the floating control's
  // sliders load on release). The date ref is updated first so the immediate
  // re-navigation uses the new date.
  const applyWayback = (year: number, month: number): void => {
    const mm = String(month).padStart(2, '0')
    actions.setOldWebDate(`${year}${mm}15`)
    saveSettings({ ...settings, waybackYear: year, waybackMonth: month })
    actions.setOldWebActive(true)
  }

  // Apply the "Time Warp Modem" speed on startup (and whenever it changes) so it
  // covers the initial tab. (Speed resets to "full" each launch — see loadSettings.)
  useEffect(() => {
    window.oldweb.setNetworkSpeed(settings.connectionSpeed || 'full')
  }, [settings.connectionSpeed])
  // Apply the opt-in ad/tracker blocker on startup and whenever it's toggled.
  useEffect(() => {
    window.oldweb.setAdblock(settings.adblock ?? false)
  }, [settings.adblock])
  // Retro "display" effect on page content: colour-depth reduction + dither, plus
  // the Classic Web Typography level. Both default OFF — pages render normally
  // unless the user opts in via Settings. `era` resolves against the theme's era
  // (older themes → the heavier 'full' serif look; newer → milder 'light').
  useEffect(() => {
    let depth = settings.colorDepth ?? 'off'
    if (depth === 'auto') depth = 'off' // legacy value → treat as off
    const classic = settings.classicType ?? 'off'
    let typo = 'off'
    if (classic === 'light' || classic === 'full') typo = classic
    else if (classic === 'era') {
      const year = parseInt((manifest?.oldWebDate ?? '').slice(0, 4), 10)
      typo = year && year <= 2000 ? 'full' : 'light'
    }
    window.oldweb.setPageDisplay(depth, settings.pageDither ?? true, typo)
    window.oldweb.setDisplayBySite(settings.displayBySite ?? {})
  }, [settings.colorDepth, settings.pageDither, settings.classicType, settings.displayBySite, manifest])
  useEffect(() => {
    actions.setOldWebDate(waybackDate)
  }, [waybackDate, actions])

  // --- report the page content area to the engine so it can place the page ---
  const report = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    window.oldweb.setContentInsets({
      top: Math.round(r.top),
      left: Math.round(r.left),
      right: Math.round(window.innerWidth - r.right),
      bottom: Math.round(window.innerHeight - r.bottom)
    })
  }, [])

  useLayoutEffect(report, [report, state.tabs.length, themeId, manifest, hotlistOpen])

  useEffect(() => {
    let raf = 0
    const schedule = (): void => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(report)
    }
    // Observe the content box itself: its size changes whenever the chrome's
    // height changes (theme swap, async theme.css applying, window resize),
    // which is exactly when the page view needs repositioning.
    const ro = new ResizeObserver(schedule)
    if (contentRef.current) ro.observe(contentRef.current)
    window.addEventListener('resize', schedule)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(raf)
    }
  }, [report])

  const labels = { ...DEFAULT_LABELS, ...(manifest?.labels ?? {}) }
  const layout = manifest?.layout ?? {}
  const hasSidePanel = layout.sidePanel === 'hotlist'
  const activeTab = state.tabs.find((t) => t.id === state.activeId) ?? null
  const loading = activeTab?.isLoading ?? false

  // --- Archive Timeline: which Wayback snapshots really exist for this page. ---
  // The Wayback calendar API is queried one year at a time, so the timeline fills
  // in progressively as the user scrubs the year slider. It resets per page URL.
  const [timeline, setTimeline] = useState<WaybackTimeline>({ years: {}, months: {}, total: 0 })
  const [timelineLoading, setTimelineLoading] = useState(false)
  const activeUrl = unwrapWayback(activeTab?.url ?? '')
  // Reset only when the *page* changes — not when time-travel swaps the snapshot
  // URL (which flaps trailing slash / http↔https on redirects). Normalise so
  // scrubbing years keeps accumulating instead of clearing the bars each time.
  const baseKey = activeUrl
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
    .toLowerCase()
  useEffect(() => {
    setTimeline({ years: {}, months: {}, total: 0 })
  }, [baseKey])
  // Track the current page key so an in-flight month fetch that resolves after
  // the user has navigated away is dropped instead of polluting the new timeline.
  const baseKeyRef = useRef(baseKey)
  baseKeyRef.current = baseKey
  const loadYear = useCallback(
    async (year: number): Promise<void> => {
      if (!/^https?:\/\//i.test(activeUrl) || !year) return
      const reqKey = baseKey
      setTimelineLoading(true)
      try {
        const counts = await window.oldweb.waybackMonths(activeUrl, year)
        if (baseKeyRef.current !== reqKey) return // navigated away — drop stale result
        setTimeline((prev) => {
          const months = { ...prev.months }
          let present = 0
          for (let i = 0; i < 12; i++) {
            const c = counts[i] ?? 0
            if (c > 0) {
              months[`${year}${String(i + 1).padStart(2, '0')}`] = c
              present++
            }
          }
          const years = { ...prev.years, [year]: present }
          const total = Object.values(years).reduce((a, b) => a + b, 0)
          return { years, months, total }
        })
      } finally {
        if (baseKeyRef.current === reqKey) setTimelineLoading(false)
      }
    },
    [activeUrl, baseKey]
  )
  // Explicit user home > the theme's era-appropriate homeUrl (manifest) > default.
  const homeUrl = settings.home || manifest?.homeUrl || 'https://www.myretromac.app'
  const searchUrl = 'https://www.google.com'

  // "Today" in the flyout: return to today's live page (exit Wayback).
  const goToday = (): void => actions.setOldWebActive(false)

  // --- Modem dial-up emulation ---------------------------------------------
  // The first navigation of a session is gated behind a synthesized dial-up
  // handshake (sound + LED widget). The actual slow paint comes from the
  // existing connectionSpeed CDP throttle; this only delays the start and, when
  // armed, boots "offline" until the user dials in (audio needs a user gesture).
  // Modem widget is on by default (opt-out); at the default "full" speed it just
  // shows as always-online, so it's visible without forcing a dial-up.
  const modemOn = settings.modemExtension !== false
  const modemArmed = modemOn && (settings.connectionSpeed ?? 'full') !== 'full'
  const modemSpeed = (settings.connectionSpeed ?? 'full') as ModemSpeed | 'full'
  const [modemPhase, setModemPhase] = useState<ModemPhase>('off')
  // Mac-lineage themes get the "Dial Up: The Struggle" GIF on white; every other
  // (Windows/PC) theme gets the retro-internet GIF on a #008C64 field.
  const isMacTheme = MAC_THEMES.has(themeId)
  // Holds the dial-up overlay open for a beat after connect so the Mac GIF's
  // final frame plays exactly as the line comes up (see DialGif + startDial).
  const [modemEndFrame, setModemEndFrame] = useState(false)
  const connectedRef = useRef(false)
  const dialRef = useRef<DialupHandle | null>(null)
  const dialTimersRef = useRef<number[]>([])
  const bootStoppedRef = useRef(false)
  // Active tab id, read inside effects that must not re-run once per tab.
  const activeTabIdRef = useRef<number | null>(null)
  activeTabIdRef.current = activeTab?.id ?? null

  const clearDialTimers = (): void => {
    dialTimersRef.current.forEach((t) => clearTimeout(t))
    dialTimersRef.current = []
  }

  // Bundled real dial-up recordings (served from public/sounds). Durations are
  // known, so the phase transitions + connect fire in sync with the audio.
  const MODEM_SAMPLES: Record<'us' | 'europe', { url: string; duration: number }> = {
    us: { url: '/sounds/dialup-us.m4a', duration: 17 },
    europe: { url: '/sounds/dialup-eu.m4a', duration: 17.5 }
  }

  // Run the dial-up (call from a user gesture so AudioContext is allowed), then
  // `then` (the real navigation) once "connected". ISDN was a digital line — it
  // never had dial tones or the carrier screech, so it connects quickly + silent.
  const startDial = (then: () => void): void => {
    if (modemSpeed === 'full') {
      then()
      return
    }
    clearDialTimers()
    dialRef.current?.stop()
    dialRef.current = null
    bootStoppedRef.current = false
    setModemPhase('dialing')

    let ring: number
    let handshake: number
    let total: number
    if (modemSpeed === 'isdn') {
      // ISDN: no analog tones — a short, silent digital connect.
      ring = 0.4
      handshake = 0.8
      total = 1.4
    } else {
      const sound = settings.modemSound ?? 'us'
      const volume = (settings.modemVolume ?? 70) / 100
      const sampleUrl =
        sound === 'us'
          ? MODEM_SAMPLES.us.url
          : sound === 'europe'
            ? MODEM_SAMPLES.europe.url
            : sound === 'custom'
              ? settings.modemSampleUrl || ''
              : '' // 'synth'
      if (sampleUrl) {
        total =
          sound === 'us'
            ? MODEM_SAMPLES.us.duration
            : sound === 'europe'
              ? MODEM_SAMPLES.europe.duration
              : 18 // custom recording — unknown length
        // Real recordings: dial tone/dialing first, ringing ~30% in, then the
        // carrier handshake screech to the end. LED phases approximate that.
        ring = total * 0.28
        handshake = total * 0.46
        dialRef.current = playDialup(modemSpeed, { volume, sampleUrl })
      } else {
        dialRef.current = playDialup(modemSpeed, { volume })
        const tm = dialupTimings(modemSpeed)
        ring = tm.ring
        handshake = tm.handshake
        total = tm.duration
      }
    }

    dialTimersRef.current.push(
      window.setTimeout(() => setModemPhase('ring'), ring * 1000),
      window.setTimeout(() => setModemPhase('handshake'), handshake * 1000),
      window.setTimeout(() => {
        connectedRef.current = true
        setModemPhase('online')
        // Mac themes: keep the overlay up a moment longer so the "struggle" GIF
        // resolves to its final frame right as the connection comes up.
        if (isMacTheme) {
          setModemEndFrame(true)
          dialTimersRef.current.push(window.setTimeout(() => setModemEndFrame(false), 1600))
        }
        then()
      }, total * 1000)
    )
  }

  // Every user navigation passes through here; the first one (when armed) dials.
  const gatedNavigate = (url: string): void => {
    if (modemArmed && !connectedRef.current) startDial(() => actions.navigate(url))
    else actions.navigate(url)
  }

  // Cancel an in-progress dial (or hang up): stop the sound + timers, back offline.
  const abortDial = (): void => {
    clearDialTimers()
    dialRef.current?.stop()
    dialRef.current = null
    connectedRef.current = false
    setModemPhase('offline')
  }

  // Widget click / overlay click: dial up when offline; while dialing, cancel;
  // when connected, hang up. (Armed only — at full speed the modem is always on.)
  const handleModemToggle = (): void => {
    if (!modemArmed) return
    if (modemPhase === 'offline') startDial(() => actions.navigate(homeUrl))
    else abortDial()
  }

  // Escape cancels an in-progress dial-up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (
        e.key === 'Escape' &&
        (modemPhase === 'dialing' || modemPhase === 'ring' || modemPhase === 'handshake')
      ) {
        abortDial()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modemPhase])

  const modemDialing =
    modemPhase === 'dialing' || modemPhase === 'ring' || modemPhase === 'handshake'
  const showModemOffline =
    (modemArmed && !connectedRef.current && (modemPhase === 'offline' || modemDialing)) ||
    modemEndFrame

  // Raise the chrome over the page view while the offline/dialing screen shows.
  useEffect(() => {
    requestChromeTop('modem', showModemOffline)
  }, [showModemOffline])

  // Reconcile the modem on mount and whenever the extension or speed changes:
  //  • off            → widget dark
  //  • full speed     → always "connected"/online (LEDs live, no dial-up)
  //  • a period speed → disconnect and require a fresh dial, so changing speed
  //                     re-dials on the next page load.
  useEffect(() => {
    clearDialTimers()
    dialRef.current?.stop()
    dialRef.current = null
    const wasStopped = bootStoppedRef.current
    bootStoppedRef.current = false
    if (!modemOn) {
      connectedRef.current = false
      setModemPhase('off')
      if (wasStopped && activeTabIdRef.current != null) actions.navigate(homeUrl)
      return
    }
    if (!modemArmed) {
      // Full speed: no dial-up — the modem is simply always online.
      connectedRef.current = true
      setModemPhase(loading ? 'loading' : 'online')
      if (wasStopped && activeTabIdRef.current != null) actions.navigate(homeUrl)
      return
    }
    // Period speed: (re)connect required — go offline; the next navigation dials.
    connectedRef.current = false
    bootStoppedRef.current = true
    setModemPhase('offline')
    const id = activeTabIdRef.current
    if (id != null) window.oldweb.stop(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modemOn, settings.connectionSpeed])

  // The boot page may arrive a moment after mount; stop it while we wait offline.
  useEffect(() => {
    if (modemArmed && !connectedRef.current && bootStoppedRef.current && activeTab) {
      window.oldweb.stop(activeTab.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.id])

  // Once connected (including full-speed "always online"), mirror page streaming
  // on the LEDs — RX/TX blink while loading, steady when idle.
  useEffect(() => {
    if (!connectedRef.current) return
    setModemPhase(loading ? 'loading' : 'online')
  }, [loading])

  // "Not connected / dialing" screen shown over the page area while offline.
  // During the actual dial-in a period GIF plays, centered on a themed backdrop
  // (Mac themes: the "struggle" GIF on white, final frame held for connect;
  // Windows themes: the retro-internet GIF on #008C64).
  const modemOverlay = showModemOffline ? (
    <div
      className={'ow-modem-offline ' + (isMacTheme ? 'ow-modem-offline--mac' : 'ow-modem-offline--win')}
      role="button"
      tabIndex={0}
      onClick={handleModemToggle}
    >
      {modemDialing || modemEndFrame ? (
        isMacTheme ? (
          <DialGif
            src="/modem/dial-up-struggle.gif"
            connected={modemEndFrame}
            width={400}
            height={242}
          />
        ) : (
          <img className="ow-modem-gif" src="/modem/retro-internet.gif" alt="" />
        )
      ) : (
        <>
          <div className="ow-modem-offline__title">Not connected</div>
          <div className="ow-modem-offline__hint">Click to dial up</div>
        </>
      )}
    </div>
  ) : null

  // "Today vs {year}" share/export (real Wayback snapshot vs the live page).
  const [shareOpen, setShareOpen] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareImg, setShareImg] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareLabelYear, setShareLabelYear] = useState('')
  const [shareReqYear, setShareReqYear] = useState(2001)
  const [shareSuggest, setShareSuggest] = useState<number | null>(null)
  useEffect(() => {
    requestChromeTop('share', shareOpen)
    return () => requestChromeTop('share', false)
  }, [shareOpen])
  const runShare = async (year: number): Promise<void> => {
    if (!activeTab) return
    setShareReqYear(year)
    setShareOpen(true)
    setShareBusy(true)
    setShareError(null)
    setShareImg(null)
    setShareSuggest(null)
    const res = await window.oldweb.shareSources(activeTab.id, {
      source: 'wayback',
      year,
      // Share targets the same month the Time Machine is set to.
      month: Number(waybackDate.slice(4, 6)) || undefined,
      originalUrl: unwrapWayback(activeTab.url)
    })
    // No snapshot at the chosen year — ask the user to confirm the closest one.
    if (res.suggestYear) {
      setShareSuggest(Number(res.suggestYear))
      setShareBusy(false)
      return
    }
    if (res.error || !res.today || !res.year) {
      setShareError(res.error ?? 'Share failed')
      setShareBusy(false)
      return
    }
    const labelYear = res.snapYear ?? String(year)
    setShareLabelYear(labelYear)
    try {
      setShareImg(await composeShare(res.today, res.year, labelYear))
    } catch {
      setShareError('Could not compose the image')
    }
    setShareBusy(false)
  }
  const openShare = (): void => void runShare(Number(waybackDate.slice(0, 4)))

  // The toolbar is fully theme-defined: the manifest lists exactly which
  // buttons appear and in what order. Each action maps to a handler here.
  const navAction: Record<
    Exclude<ToolbarItem, '|'>,
    { label: string; onClick: () => void; disabled?: boolean }
  > = {
    back: { label: labels.back, onClick: actions.back, disabled: !activeTab?.canGoBack },
    forward: { label: labels.forward, onClick: actions.forward, disabled: !activeTab?.canGoForward },
    stop: { label: labels.stop, onClick: actions.stop, disabled: !loading },
    refresh: { label: labels.reload, onClick: actions.reload },
    home: { label: labels.home, onClick: () => gatedNavigate(homeUrl) },
    search: { label: labels.search, onClick: () => gatedNavigate(searchUrl) },
    favorites: {
      label: labels.favorites,
      onClick: () => openPanel('bookmarks', '.ow-btn[data-action="favorites"]')
    },
    history: {
      label: labels.history,
      onClick: () => openPanel('history', '.ow-btn[data-action="history"]')
    },
    mail: {
      label: labels.mail,
      // Configurable in Settings: open a webmail site, or the local mail app.
      onClick: () =>
        settings.mailUseLocal
          ? void window.oldweb.openExternal('mailto:')
          : actions.navigate(settings.mailUrl?.trim() || 'https://mail.google.com')
    },
    print: { label: labels.print, onClick: actions.print },
    edit: { label: labels.edit, onClick: () => {}, disabled: true },
    netscape: { label: labels.netscape, onClick: () => gatedNavigate(homeUrl) },
    security: { label: labels.security, onClick: () => setSecurityOpen(true) },
    shop: { label: labels.shop, onClick: () => gatedNavigate('https://www.amazon.com') },
    // Opera 3.x toolbar actions (period MDI features map to the closest action).
    new: { label: labels.new, onClick: actions.newTab },
    open: {
      label: labels.open,
      // The main process shows the dialog AND loads the file into the active
      // tab; no file:// URL is constructed here (it would be rejected anyway).
      onClick: () => void window.oldweb.openLocalFile()
    },
    save: {
      label: labels.save,
      onClick: () => {
        if (activeTab) window.oldweb.savePage(activeTab.id)
      }
    },
    copy: {
      label: labels.copy,
      onClick: () => {
        if (activeTab) window.oldweb.editCommand(activeTab.id, 'copy')
      }
    },
    url: {
      label: labels.url,
      onClick: () => setUrlDialogOpen(true)
    },
    hotlist: {
      label: labels.hotlist,
      onClick: () =>
        hasSidePanel
          ? setHotlistOpen((o) => !o)
          : openPanel('bookmarks', '.ow-btn[data-action="hotlist"]')
    },
    tile: { label: labels.tile, onClick: () => {}, disabled: true },
    cascade: { label: labels.cascade, onClick: () => {}, disabled: true },
    // Internet Explorer 1.0 toolbar actions
    favadd: { label: labels.favadd, onClick: addBookmark },
    fontup: {
      label: labels.fontup,
      onClick: () => {
        if (activeTab) window.oldweb.zoomStep(activeTab.id, 1)
      }
    },
    fontdown: {
      label: labels.fontdown,
      onClick: () => {
        if (activeTab) window.oldweb.zoomStep(activeTab.id, -1)
      }
    },
    cut: {
      label: labels.cut,
      onClick: () => {
        if (activeTab) window.oldweb.editCommand(activeTab.id, 'cut')
      }
    },
    paste: {
      label: labels.paste,
      onClick: () => {
        if (activeTab) window.oldweb.editCommand(activeTab.id, 'paste')
      }
    },
    // Internet Explorer 4.01 (Mac): Preferences opens Reframe Settings.
    preferences: {
      label: labels.preferences,
      onClick: () => setDialogOpen(true)
    },
    // Internet Explorer 6.0 (Windows XP): the Messenger toolbar button. Windows
    // Messenger was a separate app we can't launch — kept for authenticity as an
    // inert period button (see the "never delete theme elements" note).
    messenger: {
      label: labels.messenger,
      onClick: () => {}
    },
    // NCSA Mosaic: the Help (?) toolbar button opens the theme's About page.
    help: {
      label: labels.help,
      onClick: () => {
        if (activeTab) void window.oldweb.openAbout(activeTab.id, themeId)
      }
    },
    // NCSA Mosaic: "Load to Disk" (the down-arrow button) saves the page.
    loaddisk: {
      label: labels.loaddisk,
      onClick: () => {
        if (activeTab) window.oldweb.savePage(activeTab.id)
      }
    },
    // Netscape 3.04: Edit (page editor) and Find are inert period buttons kept
    // for authenticity; Images (auto-load) is permanently disabled, as in the app.
    nsedit: { label: labels.nsedit, onClick: () => {} },
    find: { label: labels.find, onClick: () => {} },
    images: { label: labels.images, onClick: () => {}, disabled: true }
  }
  const toolbarItems = manifest?.toolbar ?? DEFAULT_TOOLBAR
  const menus = manifest?.menus ?? DEFAULT_MENUS

  // Menu dropdown contents. The Help menu hosts the Oldweb controls (theme
  // picker, CRT shader, Old Web/Wayback) — shaders will live here too.
  const buildMenu = (name: string): MenuItem[] => {
    // Camino 2.0 — Mac-native menu bar. 'Help' falls through to the shared Help
    // menu so the theme picker / Old Web controls stay reachable.
    if (themeId === 'camino') {
      const cut = () => activeTab && window.oldweb.editCommand(activeTab.id, 'cut')
      const copy = () => activeTab && window.oldweb.editCommand(activeTab.id, 'copy')
      const paste = () => activeTab && window.oldweb.editCommand(activeTab.id, 'paste')
      switch (name) {
        case 'Camino':
          return [
            {
              type: 'item',
              label: 'About Camino',
              onSelect: () => {
                if (activeTab) void window.oldweb.openAbout(activeTab.id, themeId)
              }
            },
            { type: 'sep' },
            { type: 'item', label: 'Preferences…', onSelect: () => setDialogOpen(true) },
            { type: 'sep' },
            { type: 'item', label: 'Quit Camino', onSelect: () => window.oldweb.quitApp() }
          ]
        case 'File':
          return [
            { type: 'item', label: 'New Window', onSelect: () => actions.newTab() },
            { type: 'item', label: 'New Tab', onSelect: () => actions.newTab() },
            { type: 'sep' },
            { type: 'item', label: 'Open Location…', onSelect: () => setUrlDialogOpen(true) },
            { type: 'item', label: 'Open File…', onSelect: () => void window.oldweb.openLocalFile() },
            { type: 'sep' },
            {
              type: 'item',
              label: 'Save Page As…',
              onSelect: () => activeTab && window.oldweb.savePage(activeTab.id)
            },
            { type: 'item', label: 'Print…', onSelect: () => actions.print() },
            { type: 'sep' },
            {
              type: 'item',
              label: 'Close Tab',
              onSelect: () => activeTab && actions.closeTab(activeTab.id)
            }
          ]
        case 'Edit':
          return [
            { type: 'item', label: 'Undo', disabled: true },
            { type: 'sep' },
            { type: 'item', label: 'Cut', onSelect: cut },
            { type: 'item', label: 'Copy', onSelect: copy },
            { type: 'item', label: 'Paste', onSelect: paste },
            { type: 'sep' },
            {
              type: 'item',
              label: 'Select All',
              onSelect: () => activeTab && window.oldweb.editCommand(activeTab.id, 'selectAll')
            }
          ]
        case 'View':
          return [
            { type: 'item', label: 'Reload', onSelect: () => actions.reload() },
            { type: 'item', label: 'Stop', disabled: !loading, onSelect: () => actions.stop() },
            { type: 'sep' },
            { type: 'item', label: 'View Page Source', disabled: true }
          ]
        case 'History':
          return [
            {
              type: 'item',
              label: 'Back',
              disabled: !activeTab?.canGoBack,
              onSelect: () => actions.back()
            },
            {
              type: 'item',
              label: 'Forward',
              disabled: !activeTab?.canGoForward,
              onSelect: () => actions.forward()
            },
            { type: 'sep' },
            { type: 'item', label: 'Home', onSelect: () => actions.navigate(homeUrl) },
            { type: 'sep' },
            { type: 'item', label: 'Show All History', onSelect: () => openPanel('history', '.ow-menu') }
          ]
        case 'Bookmarks':
          return [
            { type: 'item', label: 'Bookmark This Page', onSelect: addBookmark },
            { type: 'sep' },
            {
              type: 'item',
              label: 'Show All Bookmarks',
              onSelect: () => openPanel('bookmarks', '.ow-menu')
            }
          ]
        case 'Window':
          return [
            { type: 'item', label: 'Minimize', disabled: true },
            { type: 'item', label: 'Zoom', disabled: true },
            { type: 'sep' },
            { type: 'item', label: 'Bookmarks', onSelect: () => openPanel('bookmarks', '.ow-menu') },
            { type: 'item', label: 'History', onSelect: () => openPanel('history', '.ow-menu') }
          ]
      }
    }
    // Netscape Navigator 3.04 Gold — period-accurate menus. 'Help' falls through
    // to the shared Help menu so the theme picker / Old Web controls stay reachable.
    if (themeId === 'netscape3') {
      const cut = () => activeTab && window.oldweb.editCommand(activeTab.id, 'cut')
      const copy = () => activeTab && window.oldweb.editCommand(activeTab.id, 'copy')
      const paste = () => activeTab && window.oldweb.editCommand(activeTab.id, 'paste')
      switch (name) {
        case 'File':
          return [
            { type: 'item', label: 'New Web Browser', onSelect: () => actions.newTab() },
            { type: 'item', label: 'New Mail Message', disabled: true },
            { type: 'item', label: 'Mail Document…', disabled: true },
            { type: 'sep' },
            { type: 'item', label: 'Open Location…', onSelect: () => setUrlDialogOpen(true) },
            { type: 'item', label: 'Open File…', onSelect: () => void window.oldweb.openLocalFile() },
            {
              type: 'item',
              label: 'Save as…',
              onSelect: () => activeTab && window.oldweb.savePage(activeTab.id)
            },
            { type: 'item', label: 'Upload File…', disabled: true },
            { type: 'sep' },
            { type: 'item', label: 'Page Setup…', disabled: true },
            { type: 'item', label: 'Print…', onSelect: () => actions.print() },
            { type: 'sep' },
            { type: 'item', label: 'Close', onSelect: () => window.oldweb.closeWindow() },
            { type: 'item', label: 'Exit', onSelect: () => window.oldweb.quitApp() }
          ]
        case 'Edit':
          return [
            { type: 'item', label: 'Undo', disabled: true },
            { type: 'sep' },
            { type: 'item', label: 'Cut', onSelect: cut },
            { type: 'item', label: 'Copy', onSelect: copy },
            { type: 'item', label: 'Paste', onSelect: paste },
            { type: 'sep' },
            {
              type: 'item',
              label: 'Select All',
              onSelect: () => activeTab && window.oldweb.editCommand(activeTab.id, 'selectAll')
            },
            { type: 'sep' },
            { type: 'item', label: 'Find…', disabled: true },
            { type: 'item', label: 'Find Again', disabled: true }
          ]
        case 'View':
          return [
            { type: 'item', label: 'Reload', onSelect: () => actions.reload() },
            { type: 'item', label: 'Load Images', disabled: true },
            { type: 'item', label: 'Refresh', onSelect: () => actions.reload() },
            { type: 'sep' },
            { type: 'item', label: 'Document Source', disabled: true },
            { type: 'item', label: 'Document Info', disabled: true }
          ]
        case 'Go':
          return [
            { type: 'item', label: 'Back', disabled: !activeTab?.canGoBack, onSelect: () => actions.back() },
            {
              type: 'item',
              label: 'Forward',
              disabled: !activeTab?.canGoForward,
              onSelect: () => actions.forward()
            },
            { type: 'item', label: 'Home', onSelect: () => actions.navigate(homeUrl) },
            { type: 'sep' },
            { type: 'item', label: 'Stop Loading', disabled: !loading, onSelect: () => actions.stop() }
          ]
        // IE 4.5 for Mac names this menu "Favorites"; same contents as Bookmarks.
        case 'Favorites':
        case 'Bookmarks':
          return [
            { type: 'item', label: 'Add Bookmark', onSelect: addBookmark },
            { type: 'sep' },
            {
              type: 'item',
              label: 'Go to Bookmarks…',
              onSelect: () => openPanel('bookmarks', '.ow-menu')
            }
          ]
        case 'Options':
          return [
            { type: 'item', label: 'General Preferences…', onSelect: () => setDialogOpen(true) },
            { type: 'item', label: 'Mail and News Preferences…', disabled: true },
            { type: 'item', label: 'Network Preferences…', disabled: true },
            { type: 'item', label: 'Security Preferences…', disabled: true },
            { type: 'sep' },
            { type: 'item', label: 'Show Toolbar', checked: true, disabled: true },
            { type: 'item', label: 'Show Location', checked: true, disabled: true },
            { type: 'item', label: 'Show Directory Buttons', checked: true, disabled: true },
            { type: 'sep' },
            { type: 'item', label: 'Auto Load Images', checked: !imagesOff, onSelect: () => toggleImages() }
          ]
        case 'Directory':
          return [
            { type: 'item', label: "Netscape's Home", onSelect: () => actions.navigate(homeUrl) },
            { type: 'item', label: "What's New?", onSelect: () => actions.navigate('https://www.mozilla.org/en-US/firefox/new/') },
            { type: 'item', label: "What's Cool?", onSelect: () => actions.navigate('https://www.awwwards.com') },
            { type: 'item', label: 'Netscape Destinations', onSelect: () => actions.navigate('https://www.timeout.com') },
            { type: 'item', label: 'Internet Search', onSelect: () => actions.navigate('https://duckduckgo.com') },
            { type: 'item', label: 'People', onSelect: () => actions.navigate('https://www.whitepages.com') },
            { type: 'item', label: 'About the Internet', disabled: true }
          ]
        case 'Window':
          return [
            { type: 'item', label: 'Netscape Mail', disabled: true },
            { type: 'item', label: 'Netscape News', disabled: true },
            { type: 'item', label: 'Address Book', disabled: true },
            { type: 'sep' },
            { type: 'item', label: 'Bookmarks', onSelect: () => openPanel('bookmarks', '.ow-menu') },
            { type: 'item', label: 'History', onSelect: () => openPanel('history', '.ow-menu') }
          ]
      }
    }
    // NCSA Mosaic has its own period-accurate menus (from the prototype spec).
    // 'Help' falls through to the shared Help menu so the theme picker / Old Web
    // controls stay reachable.
    if (themeId === 'mosaic') {
      switch (name) {
        case 'File':
          return [
            { type: 'item', label: 'New Window', disabled: true },
            { type: 'item', label: 'Open URL…', onSelect: () => setUrlDialogOpen(true) },
            { type: 'item', label: 'Open Local File…', onSelect: () => void window.oldweb.openLocalFile() },
            { type: 'sep' },
            {
              type: 'item',
              label: 'Save As…',
              onSelect: () => activeTab && window.oldweb.savePage(activeTab.id)
            },
            { type: 'item', label: 'Document Source', disabled: true },
            { type: 'sep' },
            { type: 'item', label: 'Reload', onSelect: actions.reload },
            { type: 'sep' },
            { type: 'item', label: 'Print…', onSelect: actions.print },
            { type: 'sep' },
            { type: 'item', label: 'Exit', onSelect: () => window.oldweb.closeWindow() }
          ]
        case 'Edit':
          return [
            {
              type: 'item',
              label: 'Copy',
              onSelect: () => activeTab && window.oldweb.editCommand(activeTab.id, 'copy')
            },
            { type: 'item', label: 'Find in Current…', disabled: true },
            { type: 'sep' },
            { type: 'item', label: 'Preferences…', onSelect: () => setDialogOpen(true) }
          ]
        case 'Options':
          return [
            {
              type: 'item',
              label: 'Load Images Automatically',
              checked: !imagesOff,
              // Lazy closure: toggleImages is declared later in the component, so
              // referencing it directly here (buildMenu runs during render, before
              // that declaration) would hit the temporal dead zone and crash.
              onSelect: () => toggleImages()
            },
            { type: 'item', label: 'Show Toolbar', checked: true, disabled: true },
            { type: 'item', label: 'Show Status Bar', checked: true, disabled: true },
            { type: 'sep' },
            { type: 'item', label: 'Choose Font…', disabled: true }
          ]
        case 'Navigate':
          return [
            { type: 'item', label: 'Back', disabled: !activeTab?.canGoBack, onSelect: actions.back },
            {
              type: 'item',
              label: 'Forward',
              disabled: !activeTab?.canGoForward,
              onSelect: actions.forward
            },
            { type: 'item', label: 'Home', onSelect: () => actions.navigate(homeUrl) },
            { type: 'item', label: 'Reload', onSelect: actions.reload },
            { type: 'sep' },
            { type: 'item', label: 'History…', disabled: true }
          ]
        case 'Hotlist':
          return [
            { type: 'item', label: 'Add Current to Hotlist', onSelect: addBookmark },
            { type: 'sep' },
            { type: 'item', label: 'NCSA Mosaic Home Page', onSelect: () => actions.navigate(homeUrl) },
            {
              type: 'item',
              label: 'Mosaic for Microsoft Windows',
              onSelect: () => actions.navigate('https://en.wikipedia.org/wiki/Mosaic_(web_browser)')
            }
          ]
        case 'Annotate':
          return [
            { type: 'item', label: 'Annotate…', disabled: true },
            { type: 'item', label: 'Delete Annotation', disabled: true }
          ]
      }
    }
    switch (name) {
      case 'File':
        return [
          { type: 'item', label: 'New Window', disabled: true },
          { type: 'item', label: 'Print…', onSelect: actions.print },
          { type: 'sep' },
          { type: 'item', label: 'Close', onSelect: () => window.oldweb.closeWindow() }
        ]
      case 'Edit':
        return [
          {
            type: 'item',
            label: 'Cut',
            onSelect: () => activeTab && window.oldweb.editCommand(activeTab.id, 'cut')
          },
          {
            type: 'item',
            label: 'Copy',
            onSelect: () => activeTab && window.oldweb.editCommand(activeTab.id, 'copy')
          },
          {
            type: 'item',
            label: 'Paste',
            onSelect: () => activeTab && window.oldweb.editCommand(activeTab.id, 'paste')
          },
          { type: 'sep' },
          {
            type: 'item',
            label: 'Select All',
            onSelect: () => activeTab && window.oldweb.editCommand(activeTab.id, 'selectAll')
          }
        ]
      case 'View':
        return [
          { type: 'item', label: 'Reload', onSelect: actions.reload },
          { type: 'item', label: 'Stop', onSelect: actions.stop }
        ]
      case 'Go':
        return [
          { type: 'item', label: 'Back', disabled: !activeTab?.canGoBack, onSelect: actions.back },
          {
            type: 'item',
            label: 'Forward',
            disabled: !activeTab?.canGoForward,
            onSelect: actions.forward
          },
          { type: 'item', label: 'Home', onSelect: () => actions.navigate(homeUrl) }
        ]
      case 'Help':
        return [
          {
            type: 'item',
            label: `About ${themes.find((t) => t.id === themeId)?.name ?? 'this browser'}`,
            onSelect: () => {
              if (activeTab) void window.oldweb.openAbout(activeTab.id, themeId)
            }
          },
          { type: 'sep' },
          { type: 'title', label: 'Theme' },
          ...themes.map(
            (t): MenuItem => ({
              type: 'item',
              label: t.name,
              checked: t.id === themeId,
              onSelect: () => switchTheme(t.id)
            })
          ),
          { type: 'sep' },
          { type: 'item', label: 'Old Web (Wayback)', checked: oldWeb, onSelect: actions.toggleOldWeb },
          { type: 'sep' },
          { type: 'title', label: 'Time Warp Modem' },
          ...SPEED_OPTS.map(
            (s): MenuItem => ({
              type: 'item',
              label: s.label,
              checked: (settings.connectionSpeed || 'full') === s.id,
              onSelect: () => setConnectionSpeed(s.id)
            })
          ),
          { type: 'sep' },
          { type: 'item', label: 'Show Feature Tour', onSelect: () => setTourActive(true) },
          { type: 'item', label: 'About Reframe', onSelect: () => setDialogOpen(true) }
        ]
      default:
        return [{ type: 'item', label: '(empty)', disabled: true }]
    }
  }
  const menuModel: Menu[] = menus.map((name) => ({ name, items: buildMenu(name) }))

  // Themes with no in-window menu bar (Camino) render their menus in the real
  // macOS menu bar. Serialize the model (minus the redundant app menu) and hand
  // it to the main process; clicks route back by (menu,item) via onMenuCommand.
  const isMac = navigator.userAgent.includes('Macintosh')
  const nativeMenus = isMac && layout.nativeMenus === true
  const nativeMenuList = nativeMenus ? menuModel.filter((m) => m.name !== 'Camino') : []
  nativeMenuRef.current = nativeMenuList
  const nativeMenuJson = JSON.stringify(
    nativeMenuList.map((m) => ({
      label: m.name,
      items: m.items.map((it) =>
        it.type === 'item'
          ? { type: 'item', label: it.label, disabled: it.disabled ?? false, checked: it.checked }
          : it.type === 'title'
            ? { type: 'title', label: it.label }
            : { type: 'sep' }
      )
    }))
  )
  useEffect(() => {
    void window.oldweb.setNativeMenu(nativeMenus ? { menus: JSON.parse(nativeMenuJson) } : null)
  }, [nativeMenus, nativeMenuJson])

  const tabStrip = (
    <TabStrip
      tabs={state.tabs}
      activeId={state.activeId}
      newTabLabel={labels.newTab}
      onActivate={actions.activate}
      onClose={actions.closeTab}
      onNew={actions.newTab}
    />
  )

  // Injected CSS is dropped on navigation; re-hide images when still toggled off.
  useEffect(() => {
    if (imagesOff && activeTab) window.oldweb.setImagesEnabled(activeTab.id, false)
  }, [activeTab?.url, activeTab?.id, imagesOff])

  const titleText = (activeTab?.title ? `${activeTab.title} - ` : '') + 'Reframe'

  // Firefox-era layout: the address field + search box sit on the nav-button
  // row itself, and the throbber lives in the menu bar (not the toolbar).
  const unified = layout.unifiedToolbar === true
  // Camino's Aqua pill collapses the toolbar row; only meaningful for that theme.
  const toolbarHidden = toolbarCollapsed && themeId === 'camino'
  const addressAtBottom = layout.addressPosition === 'bottom'
  const toggleImages = (): void => {
    if (!activeTab) return
    const next = !imagesOff
    setImagesOff(next)
    window.oldweb.setImagesEnabled(activeTab.id, !next)
  }
  const addressBarEl = (
    <AddressBar
      url={waybackDisplay(activeTab?.url ?? '', waybackDate.slice(0, 4))}
      label={labels.address}
      goLabel={labels.go}
      history={addrHistory}
      favicon={layout.showFavicon ? activeTab?.favicon ?? null : null}
      dragUrl={unwrapWayback(activeTab?.url ?? '')}
      dragTitle={activeTab?.title}
      documentTitle={layout.documentTitle ? activeTab?.title ?? '' : undefined}
      imagesOff={imagesOff}
      onToggleImages={addressAtBottom ? toggleImages : undefined}
      onSubmit={submitAddress}
      onBookmarks={() => openPanel('bookmarks', '.ow-loc-bookmarks')}
      onLinks={() => openPanel('bookmarks', '.ow-loc-links')}
      onRelated={() => {
        const u = unwrapWayback(activeTab?.url ?? '')
        if (u) actions.navigate('https://www.google.com/search?q=related:' + encodeURIComponent(u))
      }}
    />
  )
  // User bookmarks filed inside a given folder id, as dropdown child items.
  const folderChildren = (folderId: string): PersonalBarItem[] =>
    barBookmarks
      .filter((b) => b.parentId === folderId)
      .map((c) => ({
        label: c.label,
        url: c.url,
        favicon: c.favicon,
        id: c.id,
        user: true,
        icon: 'doc'
      }))
  // App-wide default links, shown at the head of every theme's bookmark bar.
  // They carry stable "m:__default:<i>" ids so the existing rename/hide override
  // system treats them exactly like theme-default entries (Edit/Remove work).
  const defaultBarItems: PersonalBarItem[] = DEFAULT_LINKS.map(
    (d, i): PersonalBarItem | null => {
      const id = `m:__default:${i}`
      if (barOverrides.hidden.includes(id)) return null
      return {
        label: barOverrides.labels[id] ?? d.label,
        url: barOverrides.urls[id] ?? d.url,
        icon: 'doc',
        id,
        user: true
      }
    }
  ).filter((x): x is PersonalBarItem => x !== null)
  const barItems: PersonalBarItem[] = [
    // Every theme's bookmark bar shows the same global defaults only — the
    // theme's own manifest personalBar entries (manifestItems) are intentionally
    // NOT rendered here; the manifest still gates whether a bar shows at all.
    ...defaultBarItems,
    // The user's own top-level bookmarks and folders.
    ...barBookmarks
      .filter((b) => !b.parentId)
      .map(
        (b): PersonalBarItem =>
          b.type === 'folder'
            ? {
                label: b.label,
                id: b.id,
                user: true,
                icon: 'folder',
                children: folderChildren(b.id)
              }
            : { label: b.label, url: b.url, favicon: b.favicon, id: b.id, user: true, icon: 'doc' }
      )
  ]
  // Entries for the Opera HotList tree/list — bookmarks with last-visited dates + history folder.
  const historyMap = new Map(history.map((h) => [h.url, h.last]))
  const hotlistEntries: HotListEntry[] = [
    ...bookmarks.map((b) => ({ title: b.title, url: b.url, last: historyMap.get(b.url) })),
    ...(manifest?.personalBar ?? []).map((p) => ({
      title: p.label,
      url: p.url,
      last: historyMap.get(p.url ?? '')
    })),
    ...(barBookmarks.length > 0
      ? [
          {
            title: 'Personal Bar',
            folder: true,
            children: barBookmarks
              .filter((b) => b.url)
              .map((b) => ({
                title: b.label,
                url: b.url,
                last: historyMap.get(b.url ?? '')
              }))
          }
        ]
      : []),
    ...(history.length > 0
      ? [
          {
            title: 'History',
            folder: true,
            children: history.slice(0, 15).map((h) => ({ title: h.title, url: h.url, last: h.last }))
          }
        ]
      : [])
  ]
  const searchBoxEl = (
    <SearchBox
      engineId={settings.searchEngine || DEFAULT_ENGINE_ID}
      onEngineChange={(id) => saveSettings({ ...settings, searchEngine: id })}
      onSearch={(url) => gatedNavigate(url)}
    />
  )

  return (
    <div
      className="ow-root"
      data-menu-style={settings.menuStyle || 'win98'}
      data-theme={themeId}
      data-loading={loading ? '' : undefined}
      data-toolbar-collapsed={toolbarHidden ? '' : undefined}
      data-menu-size={settings.menuFontSize || 'normal'}
      data-label-size={settings.labelFontSize || 'normal'}
    >
      <TitleBar
        title={titleText}
        maximized={state.maximized}
        onClose={() =>
          settings.closeAction === 'minimize'
            ? window.oldweb.minimizeWindow()
            : window.oldweb.quitApp()
        }
        rightExtra={
          themeId === 'camino' ? (
            <button
              type="button"
              className="ow-titlebar-pill"
              title={toolbarHidden ? 'Show Toolbar' : 'Hide Toolbar'}
              aria-label="Toggle toolbar"
              aria-pressed={toolbarHidden}
              onClick={() => setToolbarCollapsed((v) => !v)}
            />
          ) : undefined
        }
      />

      {layout.showMenuBar !== false && !nativeMenus && (
        <MenuBar model={menuModel} right={<Throbber active={loading} />} />
      )}

      <div className={'ow-toolbar' + (unified ? ' ow-toolbar--unified' : '')}>
        {toolbarItems.map((item, i) => {
          if (item === '|') {
            return <span key={`sep-${i}`} className="ow-toolbar-sep" aria-hidden />
          }
          // Defensive: a malformed manifest could list an unknown action; skip it
          // rather than crash on navAction[item].label.
          const a = navAction[item]
          if (!a) return null
          return (
            <NavButton
              key={`${item}-${i}`}
              action={item}
              label={a.label}
              disabled={a.disabled}
              onClick={a.onClick}
            />
          )
        })}

        {unified ? (
          <>
            {addressBarEl}
            {/* Small dot separator between the location and search fields
                (Camino). Hidden by default in base.css. */}
            <span className="ow-toolbar-dot" aria-hidden />
            {searchBoxEl}
            {/* Bookmarks-bar toggle (Camino: sits right of the search field).
                Hidden by default in base.css; themes opt in by styling it. */}
            {manifest?.personalBar && (
              <button
                type="button"
                className="ow-bmtoggle"
                title="Show/Hide Bookmarks Bar"
                aria-label="Toggle bookmarks bar"
                aria-pressed={showBar}
                onClick={() => setShowBar((v) => !v)}
              />
            )}
            {/* Netscape 6 animates its "N" logo here, over the toolbar artwork;
                Firefox hides this (.ow-toolbar .ow-throbber) and uses the menu bar. */}
            <Throbber active={loading} />
          </>
        ) : (
          <>
            <div className="ow-toolbar__spacer" />
            <Throbber active={loading} />
            {layout.showClock && <Clock />}
          </>
        )}
      </div>

      {!unified && !addressAtBottom && addressBarEl}

      {manifest?.personalBar && showBar && (
        <PersonalBar
          items={barItems}
          onItem={actions.navigate}
          onDropUrl={dropBarBookmark}
          onDropIntoFolder={dropIntoFolder}
          onNewFolder={addBarFolder}
          onEdit={(item) => setEditBookmark(item)}
          onRemove={removeBarBookmark}
          onMenuToggle={setBarMenuOpen}
        />
      )}

      {layout.showTabs !== false && (layout.tabsPosition ?? 'top') === 'top' && tabStrip}

      {/* The page WebContentsView is positioned by the engine to cover .ow-content.
          With a docked side panel, wrapping in a row shrinks .ow-content so the
          reported insets push the page to the right of the panel automatically. */}
      {hasSidePanel && hotlistOpen ? (
        <div className="ow-content-row">
          <HotListPanel
            entries={hotlistEntries}
            onNavigate={actions.navigate}
            onClose={() => setHotlistOpen(false)}
          />
          <div className="ow-content" ref={contentRef}>
            {modemOverlay}
          </div>
        </div>
      ) : (
        <div className="ow-content" ref={contentRef}>
          {modemOverlay}
        </div>
      )}

      {layout.showTabs !== false && layout.tabsPosition === 'bottom' && tabStrip}

      {/* Opera 3.x: the URL field lives in the status bar at the foot. */}
      {addressAtBottom && <div className="ow-bottombar">{addressBarEl}</div>}

      {layout.showStatusBar !== false && (
        <StatusBar
          text={state.statusText}
          loading={loading}
          right={
            modemOn ? (
              <ModemStatus
                active={modemOn}
                phase={modemPhase}
                speed={settings.connectionSpeed ?? 'full'}
                onToggle={handleModemToggle}
              />
            ) : undefined
          }
        />
      )}

      {panel && (
        <Panel
          kind={panel.kind}
          x={panel.x}
          y={panel.y}
          entries={panel.kind === 'bookmarks' ? bookmarks : history}
          onPick={(url) => {
            actions.navigate(url)
            setPanel(null)
          }}
          onAdd={panel.kind === 'bookmarks' ? addBookmark : undefined}
          onClose={() => setPanel(null)}
        />
      )}

      {dialogOpen && (
        <SettingsDialog
          settings={settings}
          themes={themes}
          currentOrigin={(() => {
            try {
              return new URL(activeUrl).origin
            } catch {
              return ''
            }
          })()}
          onSave={saveSettings}
          onClose={() => setDialogOpen(false)}
          onOpenExternal={(u) => window.oldweb.openExternal(u)}
        />
      )}

      {whatsNewOpen && (
        <WhatsNewDialog
          onClose={() => setWhatsNewOpen(false)}
          onOpenExternal={(u) => window.oldweb.openExternal(u)}
        />
      )}

      {urlDialogOpen && (
        <UrlDialog onOpen={(u) => submitAddress(u)} onClose={() => setUrlDialogOpen(false)} />
      )}

      {editBookmark && (
        <BookmarkEditDialog
          draft={{
            id: editBookmark.id,
            label: editBookmark.label,
            url: editBookmark.url ?? '',
            folder: editBookmark.folder
          }}
          onSave={saveBarBookmark}
          onRemove={removeBarBookmark}
          onClose={() => setEditBookmark(null)}
        />
      )}

      <FloatingMenu
        themes={themes.map((t) => ({ id: t.id, name: t.name, era: t.era.replace(/Windows/g, 'Win') }))}
        themeId={themeId}
        onTheme={switchTheme}
        oldWeb={oldWeb}
        waybackYear={Number(waybackDate.slice(0, 4)) || 0}
        waybackMonth={Number(waybackDate.slice(4, 6)) || waybackMonth}
        onWayback={applyWayback}
        onWaybackOff={goToday}
        shareYear={waybackDate.slice(0, 4)}
        onShare={openShare}
        forceOpen={tourActive}
        speed={settings.connectionSpeed || 'full'}
        speedOpts={SPEED_OPTS}
        onSpeed={(id) => setConnectionSpeed(id as Settings['connectionSpeed'])}
        timeline={timeline}
        timelineLoading={timelineLoading}
        onYear={loadYear}
      />
      {tourActive && <TourOverlay steps={TOUR_STEPS} onDone={() => setTourActive(false)} />}
      {shareOpen && (
        <ShareDialog
          year={shareLabelYear || String(shareReqYear)}
          reqYear={shareReqYear}
          busy={shareBusy}
          error={shareError}
          image={shareImg}
          suggestYear={shareSuggest}
          onUseSuggest={() => shareSuggest && void runShare(shareSuggest)}
          onYear={(y) => void runShare(y)}
          onReload={() => void runShare(shareReqYear)}
          onSave={() =>
            shareImg &&
            void window.oldweb.shareSave(
              shareImg,
              `reframe-today-vs-${shareLabelYear || waybackDate.slice(0, 4)}.png`
            )
          }
          onCopy={() => shareImg && void window.oldweb.shareCopy(shareImg)}
          onClose={() => setShareOpen(false)}
        />
      )}
      {securityOpen && (
        <SecurityInfoDialog
          url={unwrapWayback(activeTab?.url ?? '')}
          onClose={() => setSecurityOpen(false)}
        />
      )}
    </div>
  )
}
