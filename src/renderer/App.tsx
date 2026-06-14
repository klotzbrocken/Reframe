import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AddressBar } from './components/AddressBar'
import { MenuBar, type Menu, type MenuItem } from './components/MenuBar'
import { NavButton } from './components/NavButton'
import { Panel, type PanelEntry } from './components/Panel'
import { PersonalBar } from './components/PersonalBar'
import { SettingsDialog, type Settings } from './components/SettingsDialog'
import { StatusBar } from './components/StatusBar'
import { TabStrip } from './components/TabStrip'
import { Throbber } from './components/Throbber'
import { TitleBar } from './components/TitleBar'
import { useShell } from './shell/useShell'
import { themeEngine } from './theme/loader'
import {
  DEFAULT_LABELS,
  DEFAULT_MENUS,
  DEFAULT_TOOLBAR,
  type ThemeManifest,
  type ThemeSummary,
  type ToolbarItem
} from './theme/types'

export function App() {
  const loadSettings = (): Settings => {
    try {
      return JSON.parse(localStorage.getItem('reframe.settings') || '{}') as Settings
    } catch {
      return {}
    }
  }
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [dialogOpen, setDialogOpen] = useState(false)

  const [themes, setThemes] = useState<ThemeSummary[]>([])
  const [themeId, setThemeId] = useState(() => loadSettings().defaultTheme || 'ie5')
  const [manifest, setManifest] = useState<ThemeManifest | null>(null)

  const { state, actions, retro, oldWeb } = useShell(() => themeEngine.playSound('navigate'))

  const [addrHistory, setAddrHistory] = useState<string[]>([])
  const submitAddress = (input: string): void => {
    // store the full "https://…" form for the dropdown; the engine re-normalizes
    const shown = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : 'https://' + input
    setAddrHistory((h) => [shown, ...h.filter((x) => x !== shown)].slice(0, 10))
    actions.navigate(input)
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
      setHistory((h) => [{ title, url: u }, ...h.filter((x) => x.url !== u)].slice(0, 50))
    }
  }, [state.tabs, state.activeId])

  // float the chrome above the page while a panel or the settings dialog is open
  useEffect(() => {
    window.oldweb.setChromeOnTop(panel !== null || dialogOpen)
  }, [panel, dialogOpen])

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

  useLayoutEffect(report, [report, state.tabs.length, themeId, manifest])

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
  const activeTab = state.tabs.find((t) => t.id === state.activeId) ?? null
  const loading = activeTab?.isLoading ?? false
  const homeUrl = settings.home || 'https://www.myretromac.app'
  const searchUrl = 'https://www.google.com'

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
    edit: { label: labels.edit, onClick: () => {} },
    netscape: { label: labels.netscape, onClick: () => actions.navigate(homeUrl) },
    security: { label: labels.security, onClick: () => {} },
    shop: { label: labels.shop, onClick: () => actions.navigate('https://www.amazon.com') }
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
          { type: 'item', label: 'Cut', disabled: true },
          { type: 'item', label: 'Copy', disabled: true },
          { type: 'item', label: 'Paste', disabled: true }
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
              onSelect: () => setThemeId(t.id)
            })
          ),
          { type: 'sep' },
          { type: 'item', label: 'Old Web (Wayback)', checked: oldWeb, onSelect: actions.toggleOldWeb },
          { type: 'sep' },
          { type: 'item', label: 'About Oldweb', disabled: true }
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

  const titleText = (activeTab?.title ? `${activeTab.title} - ` : '') + 'Reframe'

  return (
    <div className="ow-root">
      <TitleBar title={titleText} maximized={state.maximized} />

      {layout.showMenuBar !== false && (
        <MenuBar model={menuModel} right={<Throbber active={loading} />} />
      )}

      <div className="ow-toolbar">
        {toolbarItems.map((item, i) =>
          item === '|' ? (
            <span key={`sep-${i}`} className="ow-toolbar-sep" aria-hidden />
          ) : (
            <NavButton
              key={`${item}-${i}`}
              action={item}
              label={navAction[item].label}
              disabled={navAction[item].disabled}
              onClick={navAction[item].onClick}
            />
          )
        )}

        <div className="ow-toolbar__spacer" />

        <Throbber active={loading} />
      </div>

      <AddressBar
        url={activeTab?.url ?? ''}
        label={labels.address}
        goLabel={labels.go}
        history={addrHistory}
        onSubmit={submitAddress}
        onBookmarks={() => openPanel('bookmarks', '.ow-loc-bookmarks')}
      />

      {manifest?.personalBar && manifest.personalBar.length > 0 && (
        <PersonalBar items={manifest.personalBar} onItem={actions.navigate} />
      )}

      {layout.showTabs !== false && (layout.tabsPosition ?? 'top') === 'top' && tabStrip}

      {/* The page WebContentsView is positioned by the engine to cover this. */}
      <div className="ow-content" ref={contentRef} />

      {layout.showTabs !== false && layout.tabsPosition === 'bottom' && tabStrip}

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
          onSave={(s) => {
            setSettings(s)
            localStorage.setItem('reframe.settings', JSON.stringify(s))
          }}
          onClose={() => setDialogOpen(false)}
          onOpenExternal={(u) => window.oldweb.openExternal(u)}
        />
      )}
    </div>
  )
}
