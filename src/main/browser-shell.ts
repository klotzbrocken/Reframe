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
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { pathToFileURL } from 'url'
import type { ContentInsets, MenuCommand, ShellEvent, TabState } from '../shared/types'
import { normalizeInput, isAllowedExternal } from '../shared/url'
import { pageUrl } from './page-url'
import { applyAdblock } from './adblock'

/** SSO / OAuth provider hosts whose window.open popups must stay real popups
 *  (with an intact window.opener) instead of being rerouted to a tab. */
const AUTH_HOSTS =
  /(^|\.)(accounts\.google\.com|appleid\.apple\.com|login\.microsoftonline\.com|login\.live\.com|github\.com|www\.facebook\.com|login\.yahoo\.com|www\.linkedin\.com|www\.dropbox\.com|slack\.com)$/i
function isAuthPopup(u: string): boolean {
  try {
    return AUTH_HOSTS.test(new URL(u).hostname)
  } catch {
    return false
  }
}

// Real Chrome exposes window.chrome.{app,csi,loadTimes}; an embedded Chromium
// leaves window.chrome an empty object. Google's sign-in bot-check reads exactly
// those, so with the honest empty object it rejects the login as an "insecure /
// embedded browser" — even with a spotless Chrome user-agent and client hints
// (verified: adding this shim is what turns Google's "browser may not be secure"
// page into the normal sign-in flow). Injected into every document at start.
const CHROME_SHIM = `(() => { try {
  if (!window.chrome) window.chrome = {};
  if (!window.chrome.app) window.chrome.app = { isInstalled: false,
    InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
    RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
    getDetails: function getDetails() { return null; },
    getIsInstalled: function getIsInstalled() { return false; },
    runningState: function runningState() { return 'cannot_run'; } };
  if (!window.chrome.csi) window.chrome.csi = function csi() {
    return { onloadT: Date.now(), startE: Date.now(), pageT: performance.now(), tran: 15 }; };
  if (!window.chrome.loadTimes) window.chrome.loadTimes = function loadTimes() {
    var t = performance.timing || {}; var s = function (x) { return (x || Date.now()) / 1000; };
    return { requestTime: s(t.navigationStart), startLoadTime: s(t.navigationStart),
      commitLoadTime: s(t.responseStart), finishDocumentLoadTime: s(t.domContentLoadedEventEnd),
      finishLoadTime: s(t.loadEventEnd), firstPaintTime: s(t.responseStart), firstPaintAfterLoadTime: 0,
      navigationType: 'Other', wasFetchedViaSpdy: true, wasNpnNegotiated: true,
      npnNegotiatedProtocol: 'h2', wasAlternateProtocolAvailable: false, connectionInfo: 'h2' }; };
} catch (e) {} })();`

/** Cache of Archive-Timeline month lookups, keyed "url|year" (10 min TTL). */
const timelineCache = new Map<string, { at: number; months: number[] }>()
/** Hard cap on cached timeline entries — oldest is evicted when full so the map
 *  can't grow without bound over a long session. */
const TIMELINE_CACHE_MAX = 200

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
  /**
   * Optional retro display effect applied to page content (not the chrome):
   * reduced colour depth + optional ordered dither. `off` = today's true colour.
   * The page preload (page.cjs) reads this at document-start and applies it via
   * webFrame.insertCSS (before first paint, and immune to the page's CSP).
   */
  // Global default display mode + optional per-origin overrides. A tab resolves
  // to its origin's override (depth/typo) falling back to the global default;
  // dither is always the global setting.
  private globalDisplay: { depth: string; dither: boolean; typo: string } = {
    depth: 'off',
    dither: true,
    typo: 'off'
  }
  private displayBySite: Record<string, { depth?: string; typo?: string }> = {}

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
        // It exposes nothing to the page (no window.oldweb here). CommonJS (.cjs)
        // because sandboxed preloads can't be ESM.
        preload: join(__dirname, '../preload/page.cjs')
      }
    })
    const tab: Tab = { id, view, favicon: null }
    this.tabs.set(id, tab)
    this.order.push(id)
    this.win.contentView.addChildView(view)
    this.wire(tab)
    // Register the Chrome shim before the first navigation commits.
    if (this.ensureDebugger(view.webContents)) tab.dbgAttached = true
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

  /** Load a theme's bundled "About <browser>" history page in the given tab. */
  openAbout(id: number, themeId: string): void {
    const safe = /^[a-z0-9-]+$/i.test(themeId) ? themeId : ''
    const wc = this.tabs.get(id)?.view.webContents
    if (!safe || !wc || wc.isDestroyed()) return
    void wc.loadURL(pageUrl(`about/${safe}.html`))
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


  print(id: number): void {
    const wc = this.tabs.get(id)?.view.webContents
    if (wc && !wc.isDestroyed()) wc.print()
  }

  /** "Today vs {year}" share: capture the live viewport (Today) plus a real
   *  Wayback Machine snapshot of the same page for {year}. Returns both as
   *  base64 PNG data URLs; the renderer composes the final image. */
  async shareSources(
    id: number,
    opts: {
      source: 'wayback'
      year: number
      /** Wayback month 1–12 (snapshot targeted mid-month); defaults to September. */
      month?: number
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
      // "Today" must be the LIVE page. If the tab is currently showing an
      // archived snapshot (Time-Travel via the slider), capturePage() would grab
      // the OLD page — so load the live original off-screen for the Today shot.
      const onWayback = /(^|\/\/)web\.archive\.org\//i.test(wc.getURL())
      const todayPng =
        onWayback && opts.originalUrl
          ? (await this.captureUrlFull(opts.originalUrl)).png
          : (await wc.capturePage()).toPNG()

      if (!opts.originalUrl) return { error: 'No page URL' }
      // Resolve a REAL snapshot via the availability API — loading a bare
      // /web/{date}/ URL silently redirects to the nearest snapshot (often a
      // modern year), which would look like "today".
      const snap = await this.findSnapshot(opts.originalUrl, opts.year, opts.month)
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
      const yearPng = await this.captureUrl(snap.url)
      const toUrl = (b: Buffer): string => 'data:image/png;base64,' + b.toString('base64')
      return { today: toUrl(todayPng), year: toUrl(yearPng), snapYear: snap.year }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Share failed' }
    }
  }

  /** Ask the Wayback availability API for the closest real snapshot to
   *  mid-{month} {year} (month defaults to September). */
  private async findSnapshot(
    url: string,
    year: number,
    month?: number
  ): Promise<{ url: string; year: string } | null> {
    try {
      const ts = `${year}${String(month ?? 9).padStart(2, '0')}15`
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

  /**
   * Archive Timeline: which months of `year` actually have a Wayback snapshot of
   * `url`. Uses the Wayback calendar API (`calendarcaptures/2`) — fast and bounded
   * to a single year, unlike a CDX `collapse` query which scans every capture and
   * routinely times out. Each `items[i][0]` encodes the capture time within the
   * year as `MMDDhhmmss` (leading zero stripped), so the first two digits give the
   * month. Cached per url+year; failures / non-http return no months.
   */
  async waybackMonths(url: string, year: number): Promise<number[]> {
    if (!/^https?:\/\//i.test(url) || !Number.isInteger(year)) return []
    const key = `${url}|${year}`
    const hit = timelineCache.get(key)
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.months
    try {
      const api =
        'https://web.archive.org/__wb/calendarcaptures/2?date=' +
        year +
        '&url=' +
        encodeURIComponent(url)
      const res = await fetch(api, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Reframe)' }
      })
      if (!res.ok) return []
      const j = (await res.json()) as { items?: Array<[number, ...unknown[]]> }
      const counts = new Array(12).fill(0) as number[]
      for (const it of j.items ?? []) {
        const m = Number(String(it[0]).padStart(10, '0').slice(0, 2))
        if (m >= 1 && m <= 12) counts[m - 1]++
      }
      // Evict the oldest entry when full (Map preserves insertion order).
      if (timelineCache.size >= TIMELINE_CACHE_MAX) {
        const oldest = timelineCache.keys().next().value
        if (oldest !== undefined) timelineCache.delete(oldest)
      }
      timelineCache.set(key, { at: Date.now(), months: counts })
      return counts
    } catch {
      return []
    }
  }

  /** Load a URL in a temporary view hidden BEHIND the active page (no flicker)
   *  and capture it, then tear the view down. */
  private async captureUrl(url: string): Promise<Buffer> {
    return (await this.captureUrlFull(url)).png
  }

  /** Load `url` in a hidden off-screen view and return its screenshot plus the
   *  page's innerText and title (used for the live "Today" shot + AI prompt). */
  private async captureUrlFull(
    url: string
  ): Promise<{ png: Buffer; text: string; title: string }> {
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
      const text = String(
        await view.webContents
          .executeJavaScript('document.body ? document.body.innerText : ""')
          .catch(() => '')
      )
      const title = view.webContents.getTitle() || ''
      const png = (await view.webContents.capturePage()).toPNG()
      return { png, text, title }
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

  /** Attach the CDP debugger (idempotent) and register the window.chrome shim so
   *  it runs at the start of every future document. Also enables the Network
   *  domain so speed throttling reuses the same attachment. Returns false when the
   *  debugger can't be attached (e.g. DevTools is open) so callers degrade. */
  ensureDebugger(wc: WebContents): boolean {
    if (wc.isDestroyed()) return false
    try {
      if (!wc.debugger.isAttached()) {
        wc.debugger.attach('1.3')
        void wc.debugger.sendCommand('Page.enable')
        void wc.debugger.sendCommand('Network.enable')
        void wc.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
          source: CHROME_SHIM
        })
      }
      return true
    } catch {
      return false
    }
  }

  private async applySpeed(tab: Tab): Promise<void> {
    const wc = tab.view.webContents
    if (wc.isDestroyed()) return
    const p = SPEEDS[this.speed] ?? SPEEDS.full
    // The debugger is attached up front (for the Chrome shim); reuse it here.
    // `full` maps to down/up = -1, which clears throttling, so this is a no-op at
    // full speed rather than a special case.
    if (!this.ensureDebugger(wc)) return
    tab.dbgAttached = true
    try {
      await wc.debugger.sendCommand('Network.emulateNetworkConditions', {
        offline: false,
        latency: p.latency,
        downloadThroughput: p.down,
        uploadThroughput: p.up
      })
    } catch {
      /* debugger unavailable — skip throttling */
    }
  }

  /** Toggle uBlock-Origin-style ad/tracker blocking on the page session, then
   *  reload every tab so the change takes effect right away (not just the active
   *  one — otherwise background tabs stay inconsistent until their next reload). */
  async setAdblock(enabled: boolean): Promise<void> {
    await applyAdblock(enabled)
    for (const tab of this.tabs.values()) {
      const wc = tab.view.webContents
      if (!wc.isDestroyed()) wc.reload()
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

    // Hovering a link -> show target in the status bar (period-accurate detail).
    wc.on('update-target-url', (_e, url) => {
      this.emit({ type: 'status-text', id: tab.id, text: url })
    })

    // right-click "Send to" menu
    wc.on('context-menu', () => this.showPageMenu(tab))

    // target=_blank / window.open -> open as a new tab instead of a new window,
    // EXCEPT single-sign-on popups. Providers like Google open their sign-in in a
    // real popup and hand the result back through window.opener.postMessage; if we
    // reroute that to a plain tab the opener link is lost and the login can't
    // complete. So auth-provider popups are allowed as genuine child windows
    // (they inherit the Chrome UA + client-hint headers from the shared session).
    wc.setWindowOpenHandler(({ url }) => {
      if (isAuthPopup(url)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 500,
            height: 650,
            autoHideMenuBar: true,
            webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
          }
        }
      }
      this.createTab(url)
      return { action: 'deny' }
    })

    // An allowed auth popup is its own window, so give it the Chrome shim too —
    // Google's bot-check runs inside the sign-in popup as well.
    wc.on('did-create-window', (win) => {
      this.ensureDebugger(win.webContents)
    })
  }

  /**
   * Set the retro display effect for all page content. `depth` is one of
   * off | 16bit | 8bit | 1bit; `dither` toggles ordered (Bayer) dithering on the
   * quantised modes. The page preload reads the current value at document-start
   * (page:getDisplay) and applies live changes (page:setDisplay) without a reload.
   */
  setPageDisplay(depth: string, dither: boolean, typo: string): void {
    this.globalDisplay = { depth, dither, typo }
    this.broadcastDisplay()
  }

  /** Replace the per-origin override map (e.g. `{ "https://x.com": {depth,typo} }`). */
  setDisplayBySite(bySite: Record<string, { depth?: string; typo?: string }>): void {
    this.displayBySite = bySite || {}
    this.broadcastDisplay()
  }

  /** Effective mode for an origin: its override (depth/typo) over the global
   *  default; dither always comes from the global setting. */
  getPageDisplay(origin?: string): { depth: string; dither: boolean; typo: string } {
    const o = origin ? this.displayBySite[origin] : undefined
    return {
      depth: o?.depth ?? this.globalDisplay.depth,
      dither: this.globalDisplay.dither,
      typo: o?.typo ?? this.globalDisplay.typo
    }
  }

  /** Push each open tab the mode resolved for ITS current origin. */
  private broadcastDisplay(): void {
    for (const tab of this.tabs.values()) {
      const wc = tab.view.webContents
      if (wc.isDestroyed()) continue
      let origin = ''
      try {
        origin = new URL(wc.getURL()).origin
      } catch {
        /* about:blank / no URL — global default applies */
      }
      wc.send('page:setDisplay', this.getPageDisplay(origin))
    }
  }

}


