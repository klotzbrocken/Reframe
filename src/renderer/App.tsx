import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AddressBar } from './components/AddressBar'
import { MenuBar, type Menu, type MenuItem } from './components/MenuBar'
import { NavButton } from './components/NavButton'
import { FloatingMenu } from './components/FloatingMenu'
import { TourOverlay, TOUR_STEPS, TOUR_VERSION } from './components/TourOverlay'
import { ShareDialog } from './components/ShareDialog'
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
import { TabStrip } from './components/TabStrip'
import { Throbber } from './components/Throbber'
import { TitleBar } from './components/TitleBar'
import { WhatsNewDialog, WHATS_NEW_VERSION } from './components/WhatsNewDialog'
import { UrlDialog } from './components/UrlDialog'
import { DEFAULT_ENGINE_ID } from './shell/engines'
import { useShell } from './shell/useShell'
import { stripWaybackDisplay, unwrapWayback, waybackDisplay } from './shell/wayback'
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

export function App() {
  const loadSettings = (): Settings => {
    try {
      return JSON.parse(localStorage.getItem('reframe.settings') || '{}') as Settings
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
  const [themeId, setThemeId] = useState(() => safeThemeId(loadSettings().defaultTheme))
  const [manifest, setManifest] = useState<ThemeManifest | null>(null)

  const { state, actions, retro, oldWeb } = useShell(() =>
    themeEngine.playSound('navigate')
  )

  const [addrHistory, setAddrHistory] = useState<string[]>([])
  const submitAddress = (input: string): void => {
    // The field may show the friendly "1999://…" wayback form — turn it back
    // into the real target before navigating (the engine re-wraps if Old Web is on).
    const original = stripWaybackDisplay(input.trim())
    const shown = /^[a-z][a-z0-9+.-]*:\/\//i.test(original) ? original : 'https://' + original
    setAddrHistory((h) => [shown, ...h.filter((x) => x !== shown)].slice(0, 10))
    actions.navigate(original)
  }

  const waybackDate = settings.waybackYear
    ? `${settings.waybackYear}0924`
    : manifest?.oldWebDate ?? (manifest?.oldWebYear ? String(manifest.oldWebYear) : '2002')

  // --- bookmarks & browsing history (persisted in localStorage) ---
  const loadStore = (key: string): PanelEntry[] => {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]') as PanelEntry[]
    } catch {
      return []
    }
  }
  const RETROMAC: PanelEntry = { title: 'RetroMac', url: 'https://www.myretromac.app' }
  const [bookmarks, setBookmarks] = useState<PanelEntry[]>(() => {
    const stored = loadStore('reframe.bookmarks')
    return stored.length ? stored : [RETROMAC]
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
    url: string
    favicon?: string
  }
  const [barBookmarks, setBarBookmarks] = useState<BarBookmark[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('reframe.barBookmarks') || '[]') as BarBookmark[]
    } catch {
      return []
    }
  })
  const [editBookmark, setEditBookmark] = useState<BarBookmark | null>(null)
  const [barMenuOpen, setBarMenuOpen] = useState(false)
  useEffect(
    () => localStorage.setItem('reframe.barBookmarks', JSON.stringify(barBookmarks)),
    [barBookmarks]
  )
  const dropBarBookmark = (url: string, title: string): void => {
    const at = state.tabs.find((t) => t.id === state.activeId)
    const favicon = at && unwrapWayback(at.url) === url ? at.favicon ?? undefined : undefined
    const id = crypto.randomUUID()
    setBarBookmarks((b) => [...b, { id, label: title || url, url, favicon }])
  }
  const removeBarBookmark = (id: string): void =>
    setBarBookmarks((b) => b.filter((x) => x.id !== id))
  const saveBarBookmark = (d: BookmarkDraft): void =>
    setBarBookmarks((b) => b.map((x) => (x.id === d.id ? { ...x, label: d.label, url: d.url } : x)))

  // Opera HotList side panel — docked open by default.
  const [hotlistOpen, setHotlistOpen] = useState(true)
  // Opera image button: hide/show page images on the active tab.
  const [imagesOff, setImagesOff] = useState(false)
  // Opera "Direct URL input": a small modal to type a URL and open it.
  const [urlDialogOpen, setUrlDialogOpen] = useState(false)

  // float the chrome above the page while a panel or the settings dialog is open
  useEffect(() => {
    requestChromeTop(
      'overlays',
      panel !== null ||
        dialogOpen ||
        whatsNewOpen ||
        editBookmark !== null ||
        barMenuOpen ||
        urlDialogOpen
    )
  }, [panel, dialogOpen, whatsNewOpen, editBookmark, barMenuOpen, urlDialogOpen])

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
  useEffect(() => {
    return window.oldweb.onMenuCommand((m) => {
      if (m.cmd === 'about' || m.cmd === 'settings') setDialogOpen(true)
      else if (m.cmd === 'whats-new') setWhatsNewOpen(true)
      else if (m.cmd === 'add-bookmark') addBookmarkEntry(m.title, m.url)
      else if (m.cmd === 'reload-wayback') {
        window.oldweb.navigate(m.id, `https://web.archive.org/web/${waybackRef.current}if_/${m.url}`)
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
  // Pick a Wayback year AND time-travel to it (the floating control's
  // "set year" implies "make it active"). The date ref is updated first so the
  // immediate re-navigation uses the new year.
  const applyWaybackYear = (year: number): void => {
    actions.setOldWebDate(`${year}0924`)
    saveSettings({ ...settings, waybackYear: year })
    actions.setOldWebActive(true)
  }
  // Apply the saved "Time Warp Modem" speed on startup (and whenever it changes),
  // so it covers the initial tab and survives restarts.
  useEffect(() => {
    window.oldweb.setNetworkSpeed(settings.connectionSpeed || 'full')
  }, [settings.connectionSpeed])
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
  // Explicit user home > the theme's era-appropriate homeUrl (manifest) > default.
  const homeUrl = settings.home || manifest?.homeUrl || 'https://www.myretromac.app'
  const searchUrl = 'https://www.google.com'

  // Period Render (AI): re-style the current page as a year-appropriate image.
  const [periodBusy, setPeriodBusy] = useState(false)
  const [periodLive, setPeriodLive] = useState<string | null>(null)
  const [periodError, setPeriodError] = useState<string | null>(null)
  const canPeriodRender = !!settings.openaiApiKey?.trim() && !!activeTab
  const periodRender = async (): Promise<void> => {
    const key = settings.openaiApiKey?.trim()
    if (!activeTab || !key || periodBusy) return
    setPeriodError(null)
    setPeriodBusy(true)
    const res = await window.oldweb.periodRender(activeTab.id, {
      key,
      year: Number(waybackDate.slice(0, 4)),
      quality: settings.periodQuality ?? 'medium',
      prompt: settings.periodPrompt
    })
    setPeriodBusy(false)
    if (res.error) setPeriodError(res.error)
    else setPeriodLive(res.liveUrl ?? unwrapWayback(activeTab.url))
  }
  const periodBack = (): void => {
    if (periodLive && activeTab) window.oldweb.navigate(activeTab.id, periodLive)
    setPeriodLive(null)
    setPeriodError(null)
  }
  // "Off" in the flyout: return to today's live page (exit a Period Render, else Wayback).
  const goToday = (): void => {
    if (periodLive) periodBack()
    else actions.setOldWebActive(false)
  }

  // "Today vs {year}" share/export.
  const [shareOpen, setShareOpen] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareImg, setShareImg] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareSource, setShareSource] = useState<'ai' | 'wayback'>('wayback')
  const [shareLabelYear, setShareLabelYear] = useState('')
  const [shareReqYear, setShareReqYear] = useState(2001)
  const [shareSuggest, setShareSuggest] = useState<number | null>(null)
  useEffect(() => {
    requestChromeTop('share', shareOpen)
    return () => requestChromeTop('share', false)
  }, [shareOpen])
  const runShare = async (source: 'ai' | 'wayback', year: number): Promise<void> => {
    if (!activeTab) return
    setShareSource(source)
    setShareReqYear(year)
    setShareOpen(true)
    setShareBusy(true)
    setShareError(null)
    setShareImg(null)
    setShareSuggest(null)
    const res = await window.oldweb.shareSources(activeTab.id, {
      source,
      year,
      key: settings.openaiApiKey?.trim(),
      quality: settings.periodQuality ?? 'medium',
      prompt: settings.periodPrompt,
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
  // Always start with the real archive snapshot (works without an OpenAI key).
  const openShare = (): void => void runShare('wayback', Number(waybackDate.slice(0, 4)))

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
    home: { label: labels.home, onClick: () => actions.navigate(homeUrl) },
    search: { label: labels.search, onClick: () => actions.navigate(searchUrl) },
    favorites: {
      label: labels.favorites,
      onClick: () => openPanel('bookmarks', '.ow-btn[data-action="favorites"]')
    },
    history: {
      label: labels.history,
      onClick: () => openPanel('history', '.ow-btn[data-action="history"]')
    },
    mail: { label: labels.mail, onClick: () => actions.navigate('https://mail.google.com') },
    print: { label: labels.print, onClick: actions.print },
    edit: { label: labels.edit, onClick: () => {}, disabled: true },
    netscape: { label: labels.netscape, onClick: () => actions.navigate(homeUrl) },
    security: { label: labels.security, onClick: () => {}, disabled: true },
    shop: { label: labels.shop, onClick: () => actions.navigate('https://www.amazon.com') },
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
    }
  }
  const toolbarItems = manifest?.toolbar ?? DEFAULT_TOOLBAR
  const menus = manifest?.menus ?? DEFAULT_MENUS

  // Menu dropdown contents. The Help menu hosts the Oldweb controls (theme
  // picker, CRT shader, Old Web/Wayback) — shaders will live here too.
  const buildMenu = (name: string): MenuItem[] => {
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
  const barItems: PersonalBarItem[] = [
    ...(manifest?.personalBar ?? []),
    ...barBookmarks.map((b) => ({
      label: b.label,
      url: b.url,
      favicon: b.favicon,
      id: b.id,
      user: true,
      icon: 'doc'
    }))
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
            children: barBookmarks.map((b) => ({
              title: b.label,
              url: b.url,
              last: historyMap.get(b.url)
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
      onSearch={(url) => actions.navigate(url)}
    />
  )

  return (
    <div
      className="ow-root"
      data-menu-style={settings.menuStyle || 'win98'}
      data-theme={themeId}
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
      />

      {layout.showMenuBar !== false && (
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
            {searchBoxEl}
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

      {manifest?.personalBar && (
        <PersonalBar
          items={barItems}
          onItem={actions.navigate}
          onDropUrl={dropBarBookmark}
          onEdit={(id) => setEditBookmark(barBookmarks.find((b) => b.id === id) ?? null)}
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
          <div className="ow-content" ref={contentRef} />
        </div>
      ) : (
        <div className="ow-content" ref={contentRef} />
      )}

      {layout.showTabs !== false && layout.tabsPosition === 'bottom' && tabStrip}

      {/* Opera 3.x: the URL field lives in the status bar at the foot. */}
      {addressAtBottom && <div className="ow-bottombar">{addressBarEl}</div>}

      {layout.showStatusBar !== false && (
        <StatusBar text={state.statusText} loading={loading} />
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
          draft={{ id: editBookmark.id, label: editBookmark.label, url: editBookmark.url }}
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
        waybackYear={settings.waybackYear || 0}
        onWayback={applyWaybackYear}
        onWaybackOff={goToday}
        onYearChange={(y) => saveSettings({ ...settings, waybackYear: y })}
        canPeriodRender={canPeriodRender}
        periodBusy={periodBusy}
        periodActive={periodLive != null}
        periodError={periodError}
        onPeriodRender={periodRender}
        onOpenSettings={() => setDialogOpen(true)}
        shareYear={waybackDate.slice(0, 4)}
        onShare={openShare}
        forceOpen={tourActive}
        speed={settings.connectionSpeed || 'full'}
        speedOpts={SPEED_OPTS}
        onSpeed={(id) => setConnectionSpeed(id as Settings['connectionSpeed'])}
      />
      {tourActive && <TourOverlay steps={TOUR_STEPS} onDone={() => setTourActive(false)} />}
      {shareOpen && (
        <ShareDialog
          year={shareLabelYear || String(shareReqYear)}
          reqYear={shareReqYear}
          source={shareSource}
          canAi={!!settings.openaiApiKey?.trim()}
          busy={shareBusy}
          error={shareError}
          image={shareImg}
          suggestYear={shareSuggest}
          onUseSuggest={() => shareSuggest && void runShare(shareSource, shareSuggest)}
          onSource={(s) => void runShare(s, shareReqYear)}
          onYear={(y) => void runShare(shareSource, y)}
          onReload={() => void runShare(shareSource, shareReqYear)}
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
    </div>
  )
}
