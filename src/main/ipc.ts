import { ipcMain, app } from 'electron'
import type { BrowserShell } from './browser-shell'
import { validId, asString, asBool, sanitizeInsets } from './validate'

/**
 * Register the renderer-facing IPC channels ONCE. Handlers resolve the current
 * BrowserShell via `getShell()` at call time, so reopening the window (which
 * creates a fresh shell) keeps working without re-registering — re-registering
 * would throw "second handler" on macOS reactivation.
 *
 * Every argument from the (untrusted) renderer is validated/coerced here before
 * it reaches the engine: ids must be positive integers, strings/booleans are
 * coerced, insets are made finite and bounded, and URL content is gatekept by
 * normalizeInput inside the shell.
 */
export function registerIpc(getShell: () => BrowserShell | null): void {
  const s = getShell
  ipcMain.handle('shell:createTab', (_e, url?: unknown) => s()?.createTab(asString(url) || undefined))
  ipcMain.handle('shell:closeTab', (_e, id: unknown) => (validId(id) ? s()?.closeTab(id) : undefined))
  ipcMain.handle('shell:activateTab', (_e, id: unknown) =>
    validId(id) ? s()?.activateTab(id) : undefined
  )
  ipcMain.handle('shell:navigate', (_e, id: unknown, input: unknown) =>
    validId(id) ? s()?.navigate(id, asString(input)) : undefined
  )
  ipcMain.handle('shell:goBack', (_e, id: unknown) => (validId(id) ? s()?.goBack(id) : undefined))
  ipcMain.handle('shell:goForward', (_e, id: unknown) =>
    validId(id) ? s()?.goForward(id) : undefined
  )
  ipcMain.handle('shell:reload', (_e, id: unknown) => (validId(id) ? s()?.reload(id) : undefined))
  ipcMain.handle('shell:stop', (_e, id: unknown) => (validId(id) ? s()?.stop(id) : undefined))
  ipcMain.handle('shell:setRetroContent', (_e, id: unknown, enabled: unknown) =>
    validId(id) ? s()?.setRetroContent(id, asBool(enabled)) : undefined
  )
  ipcMain.handle('shell:setNetworkSpeed', (_e, profile: unknown) =>
    s()?.setNetworkSpeed(asString(profile))
  )
  ipcMain.handle('shell:print', (_e, id: unknown) => (validId(id) ? s()?.print(id) : undefined))
  ipcMain.handle('shell:savePage', (_e, id: unknown) => (validId(id) ? s()?.savePage(id) : undefined))
  ipcMain.handle('shell:setImagesEnabled', (_e, id: unknown, enabled: unknown) =>
    validId(id) ? s()?.setImagesEnabled(id, asBool(enabled)) : undefined
  )
  ipcMain.handle('shell:setChromeOnTop', (_e, onTop: unknown) => s()?.setChromeOnTop(asBool(onTop)))
  ipcMain.handle('shell:setContentInsets', (_e, insets: unknown) =>
    s()?.setInsets(sanitizeInsets(insets))
  )
  ipcMain.handle('shell:getTabs', () => s()?.getSnapshot() ?? { tabs: [], activeId: null })
  ipcMain.handle('shell:minimizeWindow', () => s()?.minimizeWindow())
  ipcMain.handle('shell:toggleMaximizeWindow', () => s()?.toggleMaximizeWindow())
  ipcMain.handle('shell:closeWindow', () => s()?.closeWindow())
  ipcMain.handle('shell:isWindowMaximized', () => s()?.isWindowMaximized() ?? false)
  ipcMain.handle('app:quit', () => app.quit())
  // Local files are opened only via this native dialog; the chosen file is
  // loaded into the active tab inside the shell (main process) — no file:// URL
  // ever crosses from the renderer.
  ipcMain.handle('app:openFile', () => s()?.openLocalFile())
}
