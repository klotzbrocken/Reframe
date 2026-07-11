import {
  app,
  BaseWindow,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  nativeImage,
  Menu,
  dialog,
  protocol,
  net,
  session,
  shell as electronShell
} from 'electron'
import { join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, relative, isAbsolute } from 'path'
import electronUpdater from 'electron-updater'
import type { MenuItemConstructorOptions } from 'electron'
import { BrowserShell } from './browser-shell'
import { registerIpc } from './ipc'
import { pageUrl } from './page-url'
import type { NativeMenuModel } from '../shared/types'
import { isAllowedExternal } from '../shared/url'

const { autoUpdater } = electronUpdater

const __dirname = dirname(fileURLToPath(import.meta.url))

// Name the app as early as possible (before `ready`) so the macOS app menu,
// the About panel and the dock all read "Reframe" rather than "Electron".
app.setName('Reframe')
app.setAboutPanelOptions({ applicationName: 'Reframe' })

// Present as plain Chrome: Electron's default user agent carries
// "Electron/<ver>" and "<appname>/<ver>" tokens, which Cloudflare and similar
// bot-protection layers flag — sites like thomas-klotz.de or yellowpages.com
// answered every page view with "Sorry, you have been blocked". Stripping the
// two tokens (set before any window/view is created, so all tabs inherit it)
// makes Reframe indistinguishable from the bundled Chromium.
app.userAgentFallback = app.userAgentFallback
  .replace(/\sElectron\/[\d.]+/i, '')
  .replace(/\s(?:reframe|Reframe)\/[\d.]+/, '')

// Give that Chrome UA its matching User-Agent Client Hints. Editing the UA
// *string* (above) is not enough for Google sign-in — worse, overriding the UA
// makes Chromium DROP the Sec-CH-UA* headers entirely (verified: a request then
// carries a Chrome user-agent but zero client hints). Google's sign-in reads the
// hints, not just the UA: the first (identifier) page loads, but its response
// asks — via Accept-CH — for the full high-entropy set (Arch, Bitness,
// Full-Version[-List], Model, Platform[-Version], …). A real Chrome answers those
// on the next request; Reframe, sending none, is flagged on the password step as
// an unsupported/embedded browser ("This browser or app may not be secure"). So
// we present the complete hint set a genuine Chrome would, brand list included.
const CH_MAJOR = process.versions.chrome.split('.')[0]
const CH_FULL = process.versions.chrome
const SEC_CH_UA = `"Chromium";v="${CH_MAJOR}", "Google Chrome";v="${CH_MAJOR}", "Not?A_Brand";v="99"`
const SEC_CH_UA_FVL = `"Chromium";v="${CH_FULL}", "Google Chrome";v="${CH_FULL}", "Not?A_Brand";v="99.0.0.0"`
const SEC_CH_UA_PLATFORM =
  process.platform === 'darwin'
    ? '"macOS"'
    : process.platform === 'win32'
      ? '"Windows"'
      : '"Linux"'
const SEC_CH_UA_PLATFORM_VERSION = `"${process.getSystemVersion()}"`
const SEC_CH_UA_ARCH = process.arch === 'arm64' ? '"arm"' : '"x86"'
// Full client-hint set. Sent on every secure request — like a Chrome that has
// already answered a site's Accept-CH — so the high-entropy hints Google asks for
// after the identifier page are present when the password step checks them.
const CLIENT_HINTS: Record<string, string> = {
  'Sec-CH-UA': SEC_CH_UA,
  'Sec-CH-UA-Mobile': '?0',
  'Sec-CH-UA-Platform': SEC_CH_UA_PLATFORM,
  'Sec-CH-UA-Platform-Version': SEC_CH_UA_PLATFORM_VERSION,
  'Sec-CH-UA-Arch': SEC_CH_UA_ARCH,
  'Sec-CH-UA-Bitness': '"64"',
  'Sec-CH-UA-Full-Version': `"${CH_FULL}"`,
  'Sec-CH-UA-Full-Version-List': SEC_CH_UA_FVL,
  'Sec-CH-UA-Model': '""',
  'Sec-CH-UA-WoW64': '?0',
  'Sec-CH-UA-Form-Factors': '"Desktop"'
}
function applyClientHints(ses: Electron.Session): void {
  ses.webRequest.onBeforeSendHeaders((details, cb) => {
    const h = details.requestHeaders
    // Only https origins, matching where Chrome itself attaches these hints.
    if (/^https:/i.test(details.url)) Object.assign(h, CLIENT_HINTS)
    cb({ requestHeaders: h })
  })
}

// Optional launch parameter: start with a specific theme for THIS run, e.g.
//   Reframe --theme=netscape        (packaged: open -a Reframe --args --theme=netscape)
//   npm run dev -- --theme=ie4mac   (dev)
// Accepts "--theme=<id>" and "--theme <id>"; the id is validated here and again
// by the renderer's safeThemeId. It overrides the saved theme only for this
// launch — it is not persisted.
function launchTheme(): string | null {
  const argv = process.argv
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const id = a.startsWith('--theme=') ? a.slice(8) : a === '--theme' ? argv[i + 1] : null
    if (id && /^[a-z0-9-]+$/i.test(id)) return id
  }
  return null
}

// In the packaged app the renderer is served from this custom scheme instead of
// file://, so absolute URLs (`/themes/…`, `/splash/…`) and fetch() resolve
// against the renderer root — exactly like the Vite dev server. Under plain
// file:// they would point at the filesystem root and fetch is blocked, which is
// why the bundled themes failed to load. Must be registered before app ready.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
  }
])

const HOME_URL = 'https://www.myretromac.app'

// The current window's shell. IPC handlers (registered once) resolve this.
let shell: BrowserShell | null = null
let mainWindow: BaseWindow | null = null
let splashWin: BrowserWindow | null = null

const PRELOAD = () => join(__dirname, '../preload/index.cjs')

const RENDERER_DIR = join(__dirname, '../renderer')

/** Serve the bundled renderer (out/renderer) over app://bundle/<path>. */
function registerAppProtocol(): void {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url)
    const rel = pathname === '/' ? '/index.html' : decodeURIComponent(pathname)
    const file = join(RENDERER_DIR, rel)
    // Guard against path traversal. A prefix check (startsWith) would also accept
    // sibling dirs like "<root>_evil"; instead resolve the path relative to the
    // renderer root and reject anything that escapes it (starts with "..") or is
    // absolute.
    const within = relative(RENDERER_DIR, file)
    if (within.startsWith('..') || isAbsolute(within)) {
      return new Response('Forbidden', { status: 403 })
    }
    return net.fetch(pathToFileURL(file).toString())
  })
}

// Period boot splashes shown (as their own frameless, transparent windows) when
// switching to these themes — sized to each image's aspect ratio.
const THEME_SPLASH: Record<string, { img: string; w: number; h: number }> = {
  ie5: { img: 'splash/ie5.png', w: 540, h: 322 },
  netscape: { img: 'splash/netscape.png', w: 500, h: 375 },
  // Netscape Navigator Gold 3 splash — shown at the image's native 211×318 (1:1)
  // so it stays crisp and period-authentic (no upscaling, no distortion).
  netscape3: { img: 'splash/netscape3.png', w: 211, h: 318 },
  // Netscape Communicator Pro 4.04 (Mac) splash — shown at native 390×261 (1:1).
  netscape4mac: { img: 'splash/netscape4mac.png', w: 390, h: 261 }
}

function newSplashWindow(w: number, h: number): BrowserWindow {
  return new BrowserWindow({
    width: w,
    height: h,
    useContentSize: true,
    center: true,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: { preload: PRELOAD(), contextIsolation: true, sandbox: false }
  })
}

let startupFinished = false
const THEME_SPLASH_MS = 4000

/** Animate a window's opacity (soft fade in/out instead of a hard cut). */
function fadeWindow(win: BrowserWindow, to: number, ms: number, done?: () => void): void {
  const steps = 14
  const start = win.getOpacity()
  let i = 0
  const iv = setInterval(() => {
    if (win.isDestroyed()) {
      clearInterval(iv)
      return
    }
    i++
    win.setOpacity(Math.max(0, Math.min(1, start + (to - start) * (i / steps))))
    if (i >= steps) {
      clearInterval(iv)
      done?.()
    }
  }, ms / steps)
}

/** The Reframe startup splash — shown before the app window, on its own. */
function showStartupSplash(): void {
  splashWin = newSplashWindow(460, 345)
  splashWin.setOpacity(0)
  splashWin.webContents.once('did-finish-load', () => {
    if (splashWin && !splashWin.isDestroyed()) fadeWindow(splashWin, 1, 350)
  })
  splashWin.loadURL(pageUrl('startup.html'))
}

function finishStartup(): void {
  if (startupFinished) return
  startupFinished = true
  const w = splashWin
  splashWin = null
  mainWindow?.show()
  mainWindow?.focus()
  if (w && !w.isDestroyed()) {
    fadeWindow(w, 0, 300, () => {
      if (!w.isDestroyed()) w.close()
    })
  }
}

/**
 * A theme's boot splash — its own frameless window, fading in/out and holding
 * for a few seconds. The main window is hidden for the duration so the splash
 * is seen alone, then revealed again with the new theme applied.
 */
function showThemeSplash(themeId: string): void {
  const s = THEME_SPLASH[themeId]
  if (!s) return
  const win = newSplashWindow(s.w, s.h)
  win.setOpacity(0)
  mainWindow?.hide()
  win.webContents.once('did-finish-load', () => {
    if (!win.isDestroyed()) fadeWindow(win, 1, 300)
  })
  win.loadURL(pageUrl(`splash.html?img=${encodeURIComponent(s.img)}`))
  setTimeout(() => {
    fadeWindow(win, 0, 350, () => {
      if (!win.isDestroyed()) win.close()
      mainWindow?.show()
    })
  }, THEME_SPLASH_MS)
}

// Reframe app / dock icon. We load a PNG rather than the .icns: nativeImage
// parses PNG reliably at runtime (some .icns variants come back empty), and a
// 512px master scales cleanly to every dock size. The .icns is still used by
// electron-builder when packaging the .app (build/icon.icns).
function setDockIcon(): void {
  if (process.platform !== 'darwin' || !app.dock) return
  // Try several roots: in dev getAppPath() may resolve to the project root OR to
  // the out/ build dir, so also probe relative to this module (out/main).
  const bases = app.isPackaged
    ? [join(process.resourcesPath, 'app-icons')]
    : [
        join(app.getAppPath(), 'resources/app-icons'),
        join(__dirname, '../../resources/app-icons')
      ]
  for (const base of bases) {
    for (const file of ['reframe.png', 'reframe.icns']) {
      const img = nativeImage.createFromPath(join(base, file))
      if (!img.isEmpty()) {
        app.dock.setIcon(img)
        return
      }
    }
  }
  console.error('[reframe] dock icon not found; tried:', bases.join(', '))
}

// --- auto-update (electron-updater, fed by GitHub Releases) ---------------
// The Electron-idiomatic equivalent of Sparkle: on a packaged, signed build it
// checks the repo's Releases for a newer version, downloads it in the
// background, and offers a restart. A no-op in dev (nothing to update).
let updateCheckInteractive = false

function checkForUpdates(interactive: boolean): void {
  if (!app.isPackaged) {
    if (interactive) {
      void dialog.showMessageBox({
        type: 'info',
        message: 'Updates are available in the installed app',
        detail: 'Auto-update runs in the packaged Reframe build, not in development.'
      })
    }
    return
  }
  updateCheckInteractive = interactive
  autoUpdater.checkForUpdates().catch((err) => {
    if (updateCheckInteractive) {
      updateCheckInteractive = false
      void dialog.showMessageBox({ type: 'error', message: 'Update check failed', detail: String(err) })
    }
  })
}

function setupAutoUpdate(): void {
  autoUpdater.autoDownload = true
  autoUpdater.on('update-not-available', () => {
    if (updateCheckInteractive) {
      updateCheckInteractive = false
      void dialog.showMessageBox({ type: 'info', message: 'You’re up to date', detail: `Reframe ${app.getVersion()} is the latest version.` })
    }
  })
  autoUpdater.on('error', (err) => {
    if (updateCheckInteractive) {
      updateCheckInteractive = false
      void dialog.showMessageBox({ type: 'error', message: 'Update error', detail: String(err) })
    }
  })
  autoUpdater.on('update-downloaded', (info) => {
    void dialog
      .showMessageBox({
        type: 'info',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        message: `Reframe ${info.version} is ready to install`,
        detail: 'Restart to finish updating.'
      })
      .then((r) => {
        if (r.response === 0) autoUpdater.quitAndInstall()
      })
  })
  // silent check on launch
  if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => {})
}

// Menus a theme wants shown in the real macOS menu bar (Camino has no in-window
// menu bar). Cleared to null → the default built-in Edit/Window menus are used.
let themeMenuModel: NativeMenuModel | null = null

// Native application menu — Settings live here (global), not in the theme menus.
// When a theme supplies `themeMenuModel`, its menus replace the default
// Edit/Window entries and route clicks back to the renderer by (menu, item).
function buildAppMenu(): void {
  const appMenu: MenuItemConstructorOptions = {
    label: 'Reframe',
    submenu: [
      { label: 'About Reframe', click: () => shell?.sendMenuCommand({ cmd: 'about' }) },
      { label: 'What’s New', click: () => shell?.sendMenuCommand({ cmd: 'whats-new' }) },
      { type: 'separator' },
      {
        label: 'Settings…',
        accelerator: 'Cmd+,',
        click: () => shell?.sendMenuCommand({ cmd: 'settings' })
      },
      { label: 'Check for Updates…', click: () => checkForUpdates(true) },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'quit' }
    ]
  }
  const template: MenuItemConstructorOptions[] = [appMenu]

  if (themeMenuModel) {
    themeMenuModel.menus.forEach((m, mi) => {
      template.push({
        label: m.label,
        submenu: m.items.map((it, ii): MenuItemConstructorOptions => {
          if (it.type === 'sep') return { type: 'separator' }
          if (it.type === 'title') return { label: it.label ?? '', enabled: false }
          return {
            label: it.label ?? '',
            enabled: !it.disabled,
            type: it.checked !== undefined ? 'checkbox' : 'normal',
            checked: it.checked === true,
            click: () => shell?.sendMenuCommand({ cmd: 'theme-menu', menu: mi, item: ii })
          }
        })
      })
    })
  } else {
    template.push(
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }] }
    )
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  const win = new BaseWindow({
    width: 1100,
    height: 760,
    minWidth: 480,
    minHeight: 360,
    title: 'Reframe',
    backgroundColor: '#c0c0c0',
    // Frameless: no macOS traffic lights. The active theme draws its own
    // period-accurate title bar + window controls (Win98 for the IE5 theme).
    frame: false,
    // Square corners — macOS rounds frameless windows by default, which would
    // clip the title-bar icon and window controls in the corners.
    roundedCorners: false,
    // Hidden until the startup splash finishes (it shows on its own first).
    show: false
  })
  mainWindow = win

  // The chrome UI (toolbar/tabs/statusbar) lives in its own WebContentsView that
  // fills the whole window. Page views are stacked on top in the content region.
  const chromeView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  // Transparent chrome view: its content area is see-through, so when the
  // chrome is floated above the page (open dropdown/menu) the page still shows
  // through — only the opaque bars and the popup overlay it.
  chromeView.setBackgroundColor('#00000000')
  win.contentView.addChildView(chromeView)

  const activeShell = new BrowserShell(win, chromeView)
  activeShell.wireWindow()
  shell = activeShell

  const layout = (): void => {
    const [w, h] = win.getContentSize()
    chromeView.setBounds({ x: 0, y: 0, width: w, height: h })
    activeShell.layoutActiveTab()
  }
  layout()
  win.on('resize', layout)

  const theme = launchTheme()
  chromeView.webContents.loadURL(
    pageUrl('index.html') + (theme ? `?theme=${encodeURIComponent(theme)}` : '')
  )

  chromeView.webContents.once('did-finish-load', () => {
    if (activeShell.tabCount() === 0) activeShell.createTab(HOME_URL)
  })

  win.on('closed', () => {
    /* window gone; views are released with it */
  })
}

app.whenReady().then(() => {
  registerAppProtocol()
  applyClientHints(session.defaultSession)
  setDockIcon()
  buildAppMenu()
  setupAutoUpdate()
  ipcMain.handle('app:setIcon', () => {})
  // A theme (e.g. Camino) asks to render its menus in the real macOS menu bar.
  ipcMain.handle('menu:setNative', (_e, model: NativeMenuModel | null) => {
    themeMenuModel = model && Array.isArray(model.menus) ? model : null
    buildAppMenu()
  })
  ipcMain.handle('app:openExternal', (_e, url: unknown) => {
    // Only hand http/https/mailto to the OS default handler; reject everything
    // else (file:, smb:, custom protocol handlers, malformed bookmarks, …).
    if (typeof url === 'string' && isAllowedExternal(url)) return electronShell.openExternal(url)
    return undefined
  })
  // Splash control (from the splash windows + the renderer on theme switch).
  ipcMain.on('splash:done', () => finishStartup())
  ipcMain.on('splash:theme', (_e, themeId: string) => showThemeSplash(themeId))
  registerIpc(() => shell)
  createWindow()
  showStartupSplash()
  // Fallback: never leave the app hidden if the splash window dies early.
  setTimeout(finishStartup, 10000)
  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
