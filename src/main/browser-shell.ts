import {
  BaseWindow,
  WebContentsView,
  WebContents,
  Menu,
  dialog,
  shell as electronShell
} from 'electron'
import { join } from 'path'
import type { ContentInsets, MenuCommand, ShellEvent, TabState } from '../shared/types'

interface Tab {
  id: number
  view: WebContentsView
  retro: boolean
  favicon: string | null
  /** Key of the injected "hide images" stylesheet, when images are off. */
  imagesOffKey?: string
  /** Whether the CDP debugger is attached (for network throttling). */
  dbgAttached?: boolean
}

const DEFAULT_INSETS: ContentInsets = { top: 78, right: 0, bottom: 26, left: 0 }

/**
 * "Time Warp Modem" — period connection speeds. Throughput is in bytes/sec
 * (CDP units); latency in ms. `full` clears emulation (today's broadband).
 * Real-world-ish: a modem only delivered ~80-90% of its rated line speed.
 */
const SPEEDS: Record<string, { down: number; up: number; latency: number }> = {
  full: { down: -1, up: -1, latency: 0 },
  isdn: { down: 8000, up: 8000, latency: 80 }, // 64 kbit/s ISDN
  '56k': { down: 7000, up: 4200, latency: 180 }, // 56k down / 33.6k up
  '28.8k': { down: 3500, up: 3500, latency: 320 }
}

/**
 * Owns the real browser engine (Electron WebContentsViews) and presents a
 * small, engine-neutral surface to the chrome UI. The UI never touches Electron
 * directly — this class is the only thing that does. That is what keeps a future
 * Chromium-fork swap cheap: re-implement this file, keep UI + themes untouched.
 */
export class BrowserShell {
  private tabs = new Map<number, Tab>()
  private order: number[] = []
  private activeId: number | null = null
  private nextId = 1
  private insets: ContentInsets = { ...DEFAULT_INSETS }
  private chromeOnTop = false
  private speed = 'full'

  constructor(
    private win: BaseWindow,
    private chromeView: WebContentsView
  ) {}

  // --- engine -> UI events -------------------------------------------------

  private emit(event: ShellEvent): void {
    const wc = this.chromeView.webContents
    if (!wc.isDestroyed()) wc.send('shell-event', event)
  }

  private stateOf(tab: Tab): TabState {
    const wc = tab.view.webContents
    const nav = wc.navigationHistory
    return {
      id: tab.id,
      url: wc.getURL(),
      title: wc.getTitle() || 'Untitled',
      isLoading: wc.isLoadingMainFrame(),
      canGoBack: nav ? nav.canGoBack() : wc.canGoBack(),
      canGoForward: nav ? nav.canGoForward() : wc.canGoForward(),
      favicon: tab.favicon
    }
  }

  // --- window controls -----------------------------------------------------

  wireWindow(): void {
    const send = (): void =>
      this.emit({ type: 'window-maximize', maximized: this.win.isMaximized() })
    this.win.on('maximize', send)
    this.win.on('unmaximize', send)
  }

  minimizeWindow(): void {
    this.win.minimize()
  }

  toggleMaximizeWindow(): void {
    if (this.win.isMaximized()) this.win.unmaximize()
    else this.win.maximize()
  }

  closeWindow(): void {
    this.win.close()
  }

  isWindowMaximized(): boolean {
    return this.win.isMaximized()
  }

  // --- layout --------------------------------------------------------------

  tabCount(): number {
    return this.tabs.size
  }

  setInsets(insets: ContentInsets): void {
    this.insets = insets
    this.layoutActiveTab()
  }

  layoutActiveTab(): void {
    if (this.activeId == null) return
    const tab = this.tabs.get(this.activeId)
    if (!tab) return
    const [w, h] = this.win.getContentSize()
    const { top, right, bottom, left } = this.insets
    tab.view.setBounds({
      x: Math.round(left),
      y: Math.round(top),
      width: Math.max(0, Math.round(w - left - right)),
      height: Math.max(0, Math.round(h - top - bottom))
    })
  }

  // --- tab lifecycle -------------------------------------------------------

  createTab(url = 'about:blank'): number {
    const id = this.nextId++
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    const tab: Tab = { id, view, retro: false, favicon: null }
    this.tabs.set(id, tab)
    this.order.push(id)
    this.win.contentView.addChildView(view)
    this.wire(tab)
    void this.applySpeed(tab)

    this.emit({ type: 'tab-created', tab: this.stateOf(tab) })
    this.activateTab(id)

    const target = normalizeInput(url)
    if (target) {
      view.webContents.loadURL(target).catch(() => {})
    }
    return id
  }

  closeTab(id: number): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    this.win.contentView.removeChildView(tab.view)
    try {
      tab.view.webContents.close()
    } catch {
      /* already gone */
    }
    this.tabs.delete(id)
    this.order = this.order.filter((t) => t !== id)
    this.emit({ type: 'tab-closed', id })

    if (this.activeId === id) {
      this.activeId = null
      const next = this.order[this.order.length - 1]
      if (next != null) this.activateTab(next)
    }
  }

  activateTab(id: number): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    for (const [tid, t] of this.tabs) t.view.setVisible(tid === id)
    // Raise the active view above the chrome view (chrome stays at index 0).
    this.win.contentView.addChildView(tab.view)
    // …unless the chrome is meant to float on top (open menu, dialog, splash):
    // keep it above the freshly-raised page.
    if (this.chromeOnTop) this.win.contentView.addChildView(this.chromeView)
    this.activeId = id
    this.layoutActiveTab()
    this.emit({ type: 'tab-activated', id })
    this.emit({ type: 'tab-updated', tab: this.stateOf(tab) })
  }

  // --- navigation ----------------------------------------------------------

  navigate(id: number, input: string): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    const target = normalizeInput(input)
    if (target) tab.view.webContents.loadURL(target).catch(() => {})
  }

  goBack(id: number): void {
    const wc = this.tabs.get(id)?.view.webContents
    if (!wc) return
    if (wc.navigationHistory) wc.navigationHistory.goBack()
    else wc.goBack()
  }

  goForward(id: number): void {
    const wc = this.tabs.get(id)?.view.webContents
    if (!wc) return
    if (wc.navigationHistory) wc.navigationHistory.goForward()
    else wc.goForward()
  }

  reload(id: number): void {
    this.tabs.get(id)?.view.webContents.reload()
  }

  stop(id: number): void {
    this.tabs.get(id)?.view.webContents.stop()
  }

  setRetroContent(id: number, enabled: boolean): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    tab.retro = enabled
    this.applyRetro(tab)
  }

  print(id: number): void {
    const wc = this.tabs.get(id)?.view.webContents
    if (wc && !wc.isDestroyed()) wc.print()
  }

  /**
   * "Time Warp Modem" — throttle the network to a period connection speed so
   * pages crawl in and images paint top-to-bottom, like the dial-up days.
   * Applied to every tab (current + future) via the Chrome DevTools Protocol.
   */
  setNetworkSpeed(profile: string): void {
    this.speed = SPEEDS[profile] ? profile : 'full'
    for (const tab of this.tabs.values()) void this.applySpeed(tab)
  }

  private async applySpeed(tab: Tab): Promise<void> {
    const wc = tab.view.webContents
    if (wc.isDestroyed()) return
    const p = SPEEDS[this.speed] ?? SPEEDS.full
    // At full speed with no debugger yet, do nothing — never attach the CDP
    // debugger unless a period speed is actually selected.
    if (this.speed === 'full' && !tab.dbgAttached) return
    try {
      if (!tab.dbgAttached) {
        wc.debugger.attach('1.3')
        tab.dbgAttached = true
        await wc.debugger.sendCommand('Network.enable')
      }
      await wc.debugger.sendCommand('Network.emulateNetworkConditions', {
        offline: false,
        latency: p.latency,
        downloadThroughput: p.down,
        uploadThroughput: p.up
      })
    } catch {
      /* debugger already in use (e.g. DevTools open) — skip throttling */
    }
  }

  /** Opera "Save to file": save the page as a complete HTML file. */
  async savePage(id: number): Promise<void> {
    const wc = this.tabs.get(id)?.view.webContents
    if (!wc || wc.isDestroyed()) return
    const safe = (wc.getTitle() || 'page').replace(/[^\w.\- ]+/g, '_').trim().slice(0, 60)
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `${safe || 'page'}.html`,
      filters: [{ name: 'Web page, complete', extensions: ['html'] }]
    })
    if (canceled || !filePath) return
    try {
      await wc.savePage(filePath, 'HTMLComplete')
    } catch {
      /* user cancelled or save failed — ignore */
    }
  }

  /** Opera image toggle: hide/show all images on the current page. */
  async setImagesEnabled(id: number, enabled: boolean): Promise<void> {
    const tab = this.tabs.get(id)
    if (!tab) return
    const wc = tab.view.webContents
    if (wc.isDestroyed()) return
    // Always clear any previous key first (it may be stale after a navigation,
    // which drops injected CSS), then re-inject when images should stay hidden.
    if (tab.imagesOffKey) {
      await wc.removeInsertedCSS(tab.imagesOffKey).catch(() => {})
      tab.imagesOffKey = undefined
    }
    if (!enabled) {
      // Hide image elements (keeps layout, like Opera's "no images") and strip
      // CSS background images too, so the page genuinely shows no imagery.
      tab.imagesOffKey = await wc
        .insertCSS(
          'img,picture,svg,video,canvas,object,embed,iframe{visibility:hidden!important}' +
            '*{background-image:none!important}'
        )
        .catch(() => undefined)
    }
  }

  /** Push a command from the native menu / context menu to the chrome UI. */
  sendMenuCommand(cmd: MenuCommand): void {
    const wc = this.chromeView.webContents
    if (!wc.isDestroyed()) wc.send('menu-command', cmd)
  }

  /** Right-click "Send to" menu on a page. */
  private showPageMenu(tab: Tab): void {
    const wc = tab.view.webContents
    const url = wc.getURL()
    const title = wc.getTitle() || url
    const menu = Menu.buildFromTemplate([
      {
        label: 'Open in default browser',
        click: () => {
          if (url) electronShell.openExternal(url)
        }
      },
      {
        label: 'Save as bookmark',
        click: () => this.sendMenuCommand({ cmd: 'add-bookmark', title, url })
      },
      { type: 'separator' },
      { label: 'Reload', click: () => wc.reload() },
      {
        label: 'Reload (Wayback)',
        click: () => this.sendMenuCommand({ cmd: 'reload-wayback', id: tab.id, url })
      }
    ])
    menu.popup()
  }

  /**
   * Raise the chrome UI above the page so DOM popups (menus) are fully visible.
   * The page is a separate native WebContentsView stacked above the chrome view,
   * so a dropdown extending into the content area would otherwise be clipped by
   * it. While a menu is open we float the chrome on top; closing restores the
   * active page on top.
   */
  setChromeOnTop(onTop: boolean): void {
    this.chromeOnTop = onTop
    if (onTop) {
      this.win.contentView.addChildView(this.chromeView)
    } else if (this.activeId != null) {
      const tab = this.tabs.get(this.activeId)
      if (tab) this.win.contentView.addChildView(tab.view)
    }
  }

  getSnapshot(): { tabs: TabState[]; activeId: number | null } {
    return {
      tabs: this.order.map((id) => this.stateOf(this.tabs.get(id)!)),
      activeId: this.activeId
    }
  }

  // --- internals -----------------------------------------------------------

  private push(tab: Tab): void {
    this.emit({ type: 'tab-updated', tab: this.stateOf(tab) })
  }

  private wire(tab: Tab): void {
    const wc = tab.view.webContents

    wc.on('did-start-loading', () => {
      tab.favicon = null // clear stale favicon while the next page loads
      this.emit({ type: 'load-start', id: tab.id })
      this.push(tab)
    })
    wc.on('page-favicon-updated', (_e, favicons) => {
      tab.favicon = favicons?.[0] ?? null
      this.push(tab)
    })
    wc.on('did-stop-loading', () => {
      this.emit({ type: 'load-stop', id: tab.id })
      this.push(tab)
    })
    wc.on('did-navigate', () => this.push(tab))
    wc.on('did-navigate-in-page', () => this.push(tab))
    wc.on('page-title-updated', () => this.push(tab))
    wc.on('did-fail-load', () => this.push(tab))
    wc.on('dom-ready', () => this.applyRetro(tab))

    // Hovering a link -> show target in the status bar (period-accurate detail).
    wc.on('update-target-url', (_e, url) => {
      this.emit({ type: 'status-text', id: tab.id, text: url })
    })

    // right-click "Send to" menu
    wc.on('context-menu', () => this.showPageMenu(tab))

    // target=_blank / window.open -> open as a new tab instead of a new window.
    wc.setWindowOpenHandler(({ url }) => {
      this.createTab(url)
      return { action: 'deny' }
    })
  }

  private applyRetro(tab: Tab): void {
    const wc = tab.view.webContents
    if (wc.isDestroyed()) return
    // Insert/remove a CRT overlay. Kept additive so it can be toggled live.
    wc.executeJavaScript(
      `(${injectRetro.toString()})(${tab.retro});`
    ).catch(() => {})
  }
}

/** Runs inside the page. Adds or removes a CRT scanline/vignette overlay. */
function injectRetro(enabled: boolean): void {
  const ID = '__oldweb_crt__'
  const existing = document.getElementById(ID)
  if (!enabled) {
    existing?.remove()
    return
  }
  if (existing) return
  const el = document.createElement('div')
  el.id = ID
  el.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    'pointer-events:none',
    'mix-blend-mode:multiply',
    'background:repeating-linear-gradient(to bottom,rgba(0,0,0,0) 0,rgba(0,0,0,0) 2px,rgba(0,0,0,0.18) 3px,rgba(0,0,0,0) 4px)',
    'box-shadow:inset 0 0 140px 30px rgba(0,0,0,0.45)'
  ].join(';')
  document.documentElement.appendChild(el)
}

/** Turn whatever the user typed into a loadable URL (or a web search). */
export function normalizeInput(input: string): string | null {
  const raw = input.trim()
  if (!raw || raw === 'about:blank') return null
  if (/^[a-z]+:\/\//i.test(raw) || raw.startsWith('about:')) return raw
  // looks like a domain / has a dot and no spaces -> treat as URL
  if (/^[^\s]+\.[^\s]{2,}(\/.*)?$/.test(raw)) return 'https://' + raw
  if (raw === 'localhost' || raw.startsWith('localhost:')) return 'http://' + raw
  return 'https://duckduckgo.com/?q=' + encodeURIComponent(raw)
}
