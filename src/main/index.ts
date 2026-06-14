import {
  app,
  BaseWindow,
  WebContentsView,
  ipcMain,
  nativeImage,
  Menu,
  shell as electronShell
} from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { BrowserShell } from './browser-shell'
import { registerIpc } from './ipc'

const __dirname = dirname(fileURLToPath(import.meta.url))

const HOME_URL = 'https://www.myretromac.app'

// The current window's shell. IPC handlers (registered once) resolve this.
let shell: BrowserShell | null = null

// Reframe app / dock icon.
function setDockIcon(): void {
  if (process.platform !== 'darwin' || !app.dock) return
  const img = nativeImage.createFromPath(
    join(app.getAppPath(), 'resources/app-icons/reframe.icns')
  )
  if (!img.isEmpty()) app.dock.setIcon(img)
}

// Native application menu — Settings live here (global), not in the theme menus.
function buildAppMenu(): void {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Reframe',
      submenu: [
        { label: 'About Reframe', click: () => shell?.sendMenuCommand({ cmd: 'about' }) },
        { type: 'separator' },
        {
          label: 'Settings…',
          accelerator: 'Cmd+,',
          click: () => shell?.sendMenuCommand({ cmd: 'settings' })
        },
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
