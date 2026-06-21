import { ipcMain, dialog, app } from 'electron'
import type { BrowserShell } from './browser-shell'

/**
 * Register the renderer-facing IPC channels ONCE. Handlers resolve the current
 * BrowserShell via `getShell()` at call time, so reopening the window (which
 * creates a fresh shell) keeps working without re-registering — re-registering
 * would throw "second handler" on macOS reactivation.
 */
export function registerIpc(getShell: () => BrowserShell | null): void {
  const s = getShell
  ipcMain.handle('shell:createTab', (_e, url?: string) => s()?.createTab(url))
  ipcMain.handle('shell:closeTab', (_e, id: number) => s()?.closeTab(id))
  ipcMain.handle('shell:activateTab', (_e, id: number) => s()?.activateTab(id))
  ipcMain.handle('shell:navigate', (_e, id: number, input: string) => s()?.navigate(id, input))
  ipcMain.handle('shell:goBack', (_e, id: number) => s()?.goBack(id))
  ipcMain.handle('shell:goForward', (_e, id: number) => s()?.goForward(id))
  ipcMain.handle('shell:reload', (_e, id: number) => s()?.reload(id))
  ipcMain.handle('shell:stop', (_e, id: number) => s()?.stop(id))
  ipcMain.handle('shell:setRetroContent', (_e, id: number, enabled: boolean) =>
    s()?.setRetroContent(id, enabled)
  )
  ipcMain.handle('shell:setNetworkSpeed', (_e, profile: string) => s()?.setNetworkSpeed(profile))
  ipcMain.handle('shell:print', (_e, id: number) => s()?.print(id))
  ipcMain.handle('shell:savePage', (_e, id: number) => s()?.savePage(id))
  ipcMain.handle('shell:setImagesEnabled', (_e, id: number, enabled: boolean) =>
    s()?.setImagesEnabled(id, enabled)
  )
  ipcMain.handle('shell:setChromeOnTop', (_e, onTop: boolean) => s()?.setChromeOnTop(onTop))
  ipcMain.handle('shell:setContentInsets', (_e, insets) => s()?.setInsets(insets))
  ipcMain.handle('shell:getTabs', () => s()?.getSnapshot() ?? { tabs: [], activeId: null })
  ipcMain.handle('shell:minimizeWindow', () => s()?.minimizeWindow())
  ipcMain.handle('shell:toggleMaximizeWindow', () => s()?.toggleMaximizeWindow())
  ipcMain.handle('shell:closeWindow', () => s()?.closeWindow())
  ipcMain.handle('shell:isWindowMaximized', () => s()?.isWindowMaximized() ?? false)
  ipcMain.handle('app:quit', () => app.quit())
  ipcMain.handle('app:openFile', async () => {
    // No parent window: the main window is a BaseWindow, so getFocusedWindow()
    // returns null and `new BrowserWindow()` would pop a blank white window.
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Web pages', extensions: ['html', 'htm', 'mht', 'mhtml'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    return canceled || !filePaths.length ? null : filePaths[0]
  })
}
