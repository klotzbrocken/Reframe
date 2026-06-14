import {
  app,
  BaseWindow,
  WebContentsView,
  ipcMain,
  nativeImage,
  Menu,
  dialog,
  shell as electronShell
} from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import electronUpdater from 'electron-updater'
import { BrowserShell } from './browser-shell'
import { registerIpc } from './ipc'

const { autoUpdater } = electronUpdater

const __dirname = dirname(fileURLToPath(import.meta.url))

const HOME_URL = 'https://www.myretromac.app'

// The current window's shell. IPC handlers (registered once) resolve this.
let shell: BrowserShell | null = null

// Reframe app / dock icon. We load a PNG rather than the .icns: nativeImage
// parses PNG reliably at runtime (some .icns variants come back empty), and a
// 512px master scales cleanly to every dock size. The .icns is still used by
// electron-builder when packaging the .app (build/icon.icns).
function setDockIcon(): void {
  if (process.platform !== 'darwin' || !app.dock) return
  const base = app.isPackaged
    ? join(process.resourcesPath, 'app-icons')
    : join(app.getAppPath(), 'resources/app-icons')
  for (const file of ['reframe.png', 'reframe.icns']) {
    const img = nativeImage.createFromPath(join(base, file))
    if (!img.isEmpty()) {
      app.dock.setIcon(img)
      return
    }
  }
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

// Native application menu — Settings live here (global), not in the theme menus.
function buildAppMenu(): void {
  const menu = Menu.buildFromTemplate([
    {
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
    },
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
  ])
  Menu.setApplicationMenu(menu)
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
    roundedCorners: false
  })

  // The chrome UI (toolbar/tabs/statusbar) lives in its own WebContentsView that
  // fills the whole window. Page views are stacked on top in the content region.
  const chromeView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
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

  if (process.env['ELECTRON_RENDERER_URL']) {
    chromeView.webContents.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    chromeView.webContents.loadFile(join(__dirname, '../renderer/index.html'))
  }

  chromeView.webContents.once('did-finish-load', () => {
    if (activeShell.tabCount() === 0) activeShell.createTab(HOME_URL)
  })

  win.on('closed', () => {
    /* window gone; views are released with it */
  })
}

app.whenReady().then(() => {
  setDockIcon()
  buildAppMenu()
  setupAutoUpdate()
  ipcMain.handle('app:setIcon', () => {})
  ipcMain.handle('app:openExternal', (_e, url: string) => electronShell.openExternal(url))
  registerIpc(() => shell)
  createWindow()
  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
