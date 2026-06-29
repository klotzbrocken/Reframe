import {
  app,
  BaseWindow,
  WebContentsView,
  WebContents,
  Menu,
  dialog,
  clipboard,
  nativeImage,
  shell as electronShell
} from 'electron'
import { basename, join } from 'path'
import { writeFile } from 'fs/promises'
import { pathToFileURL } from 'url'
import type { ContentInsets, MenuCommand, ShellEvent, TabState } from '../shared/types'
import { normalizeInput, isAllowedExternal } from '../shared/url'
import { renderPeriodImage, pickSize, type PeriodQuality } from './period-render'

/** Runs in a page: resolves once every <img> has loaded (or after 6s). */
const WAIT_IMAGES_JS = `new Promise((resolve) => {
  try {
    const imgs = Array.prototype.slice.call(document.images || []);
    let pending = imgs.filter((i) => !i.complete).length;
    const done = () => resolve(true);
    if (pending === 0) { setTimeout(done, 50); return; }
    const tick = () => { if (--pending <= 0) done(); };
    imgs.forEach((i) => {
      if (!i.complete) {
        i.addEventListener('load', tick, { once: true });
        i.addEventListener('error', tick, { once: true });
      }
    });
    setTimeout(done, 6000);
  } catch (e) { resolve(true); }
})`

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

  /** WebContents id of the chrome UI — the ONLY sender allowed on IPC channels
   *  (page tabs have no preload, so this is a defence-in-depth check). */
  chromeWebContentsId(): number | null {
    const wc = this.chromeView.webContents
    return wc.isDestroyed() ? null : wc.id
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
        sandbox: true,
        // Tiny sandboxed preload: only turns a 2-finger swipe into back/forward.
        // It exposes nothing to the page (no window.oldweb here).
        preload: join(__dirname, '../preload/page.mjs')
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

  /** A 2-finger swipe came from a page view: navigate the owning tab's history.
   *  Matching by sender id keeps a page from steering any other tab. */
  swipeNavigate(senderWebContentsId: number, dir: 'back' | 'forward'): void {
    for (const tab of this.tabs.values()) {
      if (tab.view.webContents.id === senderWebContentsId) {
        if (dir === 'back') this.goBack(tab.id)
        else this.goForward(tab.id)
        return
      }
    }
  }

  /** Step the page zoom up/down (the themes' Font +/- buttons), clamped. */
  zoomStep(id: number, dir: number): void {
    const wc = this.tabs.get(id)?.view.webContents
    if (!wc || wc.isDestroyed()) return
    const next = Math.min(2.5, Math.max(0.5, wc.getZoomFactor() + (dir >= 0 ? 0.1 : -0.1)))
    wc.setZoomFactor(next)
  }

  reload(id: number): void {
    this.tabs.get(id)?.view.webContents.reload()
  }

  stop(id: number): void {
    this.tabs.get(id)?.view.webContents.stop()
  }

  /** Clipboard / selection commands targeting the page itself, so the themes'
   *  Edit menus and Cut/Copy/Paste toolbar buttons act on the live web page. */
  editCommand(id: number, cmd: 'cut' | 'copy' | 'paste' | 'selectAll'): void {
    const wc = this.tabs.get(id)?.view.webContents
    if (!wc || wc.isDestroyed()) return
    if (cmd === 'cut') wc.cut()
    else if (cmd === 'copy') wc.copy()
    else if (cmd === 'paste') wc.paste()
    else wc.selectAll()
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

  /** Period Render: screenshot the live viewport + text, ask OpenAI to re-style
   *  it in {year}, then show the result (fit to window) in the same tab. Returns
   *  the live URL so the UI can offer "back to live"; restores it on failure. */
  async periodRender(
    id: number,
    opts: { key: string; year: number; quality: PeriodQuality; prompt?: string }
  ): Promise<{ liveUrl?: string; error?: string }> {
    const wc = this.tabs.get(id)?.view.webContents
    if (!wc || wc.isDestroyed()) return { error: 'No active page' }
    const liveUrl = wc.getURL()
    try {
      // Capture the live viewport + text BEFORE swapping to the placeholder.
      const [w, h] = this.win.getContentSize()
      const png = (await wc.capturePage()).toPNG()
      const text = String(
        await wc.executeJavaScript('document.body ? document.body.innerText : ""').catch(() => '')
      )
      const title = wc.getTitle() || ''

      // Visible progress while the model works (can take up to ~2 min).
      await wc.loadURL(placeholderPage(opts.year))

      const out = await renderPeriodImage({
        key: opts.key,
        year: opts.year,
        quality: opts.quality,
        png,
        text,
        title,
        size: pickSize(w, h),
        prompt: opts.prompt
      })

      const stamp = Date.now()
      const dir = app.getPath('temp')
      const pngFile = join(dir, `reframe-period-${id}-${stamp}.png`)
      const htmlFile = join(dir, `reframe-period-${id}-${stamp}.html`)
      await writeFile(pngFile, out)
      await writeFile(htmlFile, viewerPage(basename(pngFile), opts.year))
      if (!wc.isDestroyed()) await wc.loadURL(pathToFileURL(htmlFile).toString())
      return { liveUrl }
    } catch (e) {
      if (!wc.isDestroyed()) wc.loadURL(liveUrl).catch(() => {})
      return { error: e instanceof Error ? e.message : 'Render failed' }
    }
  }

  /** "Today vs {year}" share: capture the live viewport (Today) plus the {year}
   *  side (AI Period Render of the same shot, or a real Wayback capture). Returns
   *  both as base64 PNG data URLs; the renderer composes the final image. */
  async shareSources(
    id: number,
    opts: {
      source: 'ai' | 'wayback'
      year: number
      key?: string
      quality?: PeriodQuality
      prompt?: string
      originalUrl?: string
    }
  ): Promise<{
    today?: string
    year?: string
    snapYear?: string
    suggestYear?: string
    error?: string
  }> {
    const wc = this.tabs.get(id)?.view.webContents
    if (!wc || wc.isDestroyed()) return { error: 'No active page' }
    try {
      const todayPng = (await wc.capturePage()).toPNG()
      let yearPng: Buffer
      let snapYear: string | undefined
      if (opts.source === 'ai') {
        if (!opts.key) return { error: 'No OpenAI API key set (Settings).' }
        const [w, h] = this.win.getContentSize()
        const text = String(
          await wc.executeJavaScript('document.body ? document.body.innerText : ""').catch(() => '')
        )
        yearPng = await renderPeriodImage({
          key: opts.key,
          year: opts.year,
          quality: opts.quality ?? 'medium',
          png: todayPng,
          text,
          title: wc.getTitle() || '',
          size: pickSize(w, h),
          prompt: opts.prompt
        })
      } else {
        if (!opts.originalUrl) return { error: 'No page URL' }
        // Resolve a REAL snapshot via the availability API — loading a bare
        // /web/{date}/ URL silently redirects to the nearest snapshot (often a
        // modern year), which would look like "today".
        const snap = await this.findSnapshot(opts.originalUrl, opts.year)
        if (!snap) {
          return { error: 'No archive snapshot found for this page.' }
        }
        // Respect the chosen year: the availability API returns the closest
        // snapshot across ALL time (1999 often resolves to 2015). Within ±1 year
        // use it; otherwise don't silently jump — hand the closest back so the
        // renderer can ASK the user to confirm it (one-click OK).
        if (Math.abs(Number(snap.year) - opts.year) > 1) {
          return { suggestYear: snap.year }
        }
        snapYear = snap.year
        yearPng = await this.captureUrl(snap.url)
      }
      const toUrl = (b: Buffer): string => 'data:image/png;base64,' + b.toString('base64')
      return { today: toUrl(todayPng), year: toUrl(yearPng), snapYear }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Share failed' }
    }
  }

  /** Ask the Wayback availability API for the closest real snapshot to {year}. */
  private async findSnapshot(
    url: string,
    year: number
  ): Promise<{ url: string; year: string } | null> {
    try {
      const ts = `${year}0915`
      const res = await fetch(
        `https://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=${ts}`
      )
      if (!res.ok) return null
      const j = (await res.json()) as {
        archived_snapshots?: { closest?: { available?: boolean; timestamp?: string } }
      }
      const c = j.archived_snapshots?.closest
      if (!c?.available || !c.timestamp) return null
      // banner-free `if_` snapshot at the exact resolved timestamp
      return { url: `https://web.archive.org/web/${c.timestamp}if_/${url}`, year: c.timestamp.slice(0, 4) }
    } catch {
      return null
    }
  }

  /** Load a URL in a temporary view hidden BEHIND the active page (no flicker)
   *  and capture it, then tear the view down. */
  private async captureUrl(url: string): Promise<Buffer> {
    const [w, h] = this.win.getContentSize()
    const { top, right, bottom, left } = this.insets
    const view = new WebContentsView({
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    this.win.contentView.addChildView(view)
    view.setBounds({
      x: Math.round(left),
      y: Math.round(top),
      width: Math.max(0, Math.round(w - left - right)),
      height: Math.max(0, Math.round(h - top - bottom))
    })
    // Keep it invisible: raise the active page (and chrome, if floating) on top.
    const active = this.activeId != null ? this.tabs.get(this.activeId) : undefined
    if (active) this.win.contentView.addChildView(active.view)
    if (this.chromeOnTop) this.win.contentView.addChildView(this.chromeView)
    try {
      await view.webContents.loadURL(url)
      await view.webContents.executeJavaScript(WAIT_IMAGES_JS).catch(() => {})
      await new Promise((r) => setTimeout(r, 400)) // final paint settle
      return (await view.webContents.capturePage()).toPNG()
    } finally {
      this.win.contentView.removeChildView(view)
      if (!view.webContents.isDestroyed()) view.webContents.close()
    }
  }

  /** Save a base64 PNG data URL via a native dialog, then reveal it. */
  async saveShareImage(dataUrl: string, name: string): Promise<{ path?: string; error?: string }> {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: name,
        filters: [{ name: 'PNG image', extensions: ['png'] }]
      })
      if (canceled || !filePath) return {}
      await writeFile(filePath, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'))
      electronShell.showItemInFolder(filePath)
      return { path: filePath }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Save failed' }
    }
  }

  /** Copy a base64 PNG data URL to the system clipboard. */
  copyShareImage(dataUrl: string): void {
    clipboard.writeImage(nativeImage.createFromDataURL(dataUrl))
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

  /**
   * Show the native Open-File dialog and load the chosen local file into the
   * active tab. file:// URLs are constructed and loaded here in the main
   * process only — they are never accepted from renderer input or bookmarks
   * (normalizeInput rejects them), so local-file access is gated by this dialog.
   */
  async openLocalFile(): Promise<void> {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Web pages', extensions: ['html', 'htm', 'mht', 'mhtml'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (canceled || !filePaths.length) return
    const id = this.activeId
    const wc = id != null ? this.tabs.get(id)?.view.webContents : undefined
    if (!wc || wc.isDestroyed()) return
    wc.loadURL(pathToFileURL(filePaths[0]).toString()).catch(() => {})
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
          if (isAllowedExternal(url)) void electronShell.openExternal(url)
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

/** A self-contained "rendering…" page shown while the Period Render runs; it
 *  cycles a few playful time-travel messages on a timer. */
function placeholderPage(year: number): string {
  const msgs = [
    'Going back in time…',
    'Spinning up the flux capacitor…',
    'Accelerating to 88 mph…',
    'Re-pixelating the photographs…',
    'Dialing up a 56k connection…',
    'Asking the archive nicely…'
  ]
  const html =
    '<!doctype html><meta charset=utf-8><style>' +
    'html,body{margin:0;height:100%;display:flex;flex-direction:column;align-items:center;' +
    'justify-content:center;gap:18px;background:#0f1216;color:#cdd6e4;' +
    'font:600 16px -apple-system,Segoe UI,Tahoma,sans-serif}' +
    '.s{width:34px;height:34px;border:4px solid #2a3340;border-top-color:#4a86e8;border-radius:50%;' +
    'animation:r 1s linear infinite}#m{min-height:20px}.y{font-size:12px;color:#7e8aa0}' +
    '@keyframes r{to{transform:rotate(360deg)}}</style>' +
    '<div class=s></div><div id=m>' +
    msgs[0] +
    '</div><div class=y>Rendering this page in ' +
    year +
    '</div><script>var m=' +
    JSON.stringify(msgs) +
    ',i=0,e=document.getElementById("m");' +
    'setInterval(function(){i=(i+1)%m.length;e.textContent=m[i]},2400);</script>'
  return 'data:text/html,' + encodeURIComponent(html)
}

/** The viewer page that shows the rendered image fit to the window. The image
 *  is referenced by basename (same temp dir → same file:// origin). */
function viewerPage(imgName: string, year: number): string {
  return (
    '<!doctype html><meta charset=utf-8><title>Reframe · ' +
    year +
    '</title><style>html,body{margin:0;height:100%;background:#000}' +
    'img{position:fixed;inset:0;width:100%;height:100%;object-fit:contain}</style>' +
    '<img alt="" src="' +
    imgName +
    '">'
  )
}

