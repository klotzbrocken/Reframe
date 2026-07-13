import { ipcMain, app, type IpcMainInvokeEvent } from 'electron'
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
 *
 * Defence-in-depth: every channel is wrapped so it only runs when the sender is
 * the live chrome WebContents. Page tabs are created without a preload, so they
 * cannot reach `window.oldweb` at all — but verifying the sender id means even a
 * future view that somehow gained a preload could not drive the engine.
 */
export function registerIpc(getShell: () => BrowserShell | null): void {
  const s = getShell
  const handle = (channel: string, fn: (...args: unknown[]) => unknown): void => {
    ipcMain.handle(channel, (e: IpcMainInvokeEvent, ...args: unknown[]) => {
      const chromeId = s()?.chromeWebContentsId()
      if (chromeId == null || e.sender.id !== chromeId) return undefined
      return fn(e, ...args)
    })
  }

  handle('shell:createTab', (_e, url) => s()?.createTab(asString(url) || undefined))
  handle('shell:closeTab', (_e, id) => (validId(id) ? s()?.closeTab(id) : undefined))
  handle('shell:activateTab', (_e, id) => (validId(id) ? s()?.activateTab(id) : undefined))
  handle('shell:navigate', (_e, id, input) =>
    validId(id) ? s()?.navigate(id, asString(input)) : undefined
  )
  handle('shell:goBack', (_e, id) => (validId(id) ? s()?.goBack(id) : undefined))
  handle('shell:goForward', (_e, id) => (validId(id) ? s()?.goForward(id) : undefined))
  handle('shell:openAbout', (_e, id, themeId) =>
    validId(id) ? s()?.openAbout(id, asString(themeId)) : undefined
  )

  // Two-finger swipe sent from a page's preload (a different sender than the
  // chrome, so it can't use `handle`). The shell verifies the sender owns a tab.
  ipcMain.on('page:swipe', (e, dir) => {
    if (dir === 'back' || dir === 'forward') s()?.swipeNavigate(e.sender.id, dir)
  })
  handle('shell:reload', (_e, id) => (validId(id) ? s()?.reload(id) : undefined))
  handle('shell:stop', (_e, id) => (validId(id) ? s()?.stop(id) : undefined))
  handle('shell:editCommand', (_e, id, cmd) =>
    validId(id) && (cmd === 'cut' || cmd === 'copy' || cmd === 'paste' || cmd === 'selectAll')
      ? s()?.editCommand(id, cmd)
      : undefined
  )
  handle('shell:zoomStep', (_e, id, dir) =>
    validId(id) && (dir === 1 || dir === -1) ? s()?.zoomStep(id, dir) : undefined
  )
  handle('share:sources', (_e, id, opts) => {
    if (!validId(id) || !opts || typeof opts !== 'object') return { error: 'Bad request' }
    const o = opts as Record<string, unknown>
    const year = Number(o.year)
    if (!Number.isInteger(year)) return { error: 'Invalid year' }
    const m = Number(o.month)
    const month = Number.isInteger(m) && m >= 1 && m <= 12 ? m : undefined
    const originalUrl =
      typeof o.originalUrl === 'string' && /^https?:\/\//i.test(o.originalUrl)
        ? o.originalUrl
        : undefined
    return s()?.shareSources(id, { source: 'wayback', year, month, originalUrl })
  })
  handle('share:save', (_e, dataUrl, name) =>
    typeof dataUrl === 'string' && dataUrl.startsWith('data:image/png;base64,')
      ? s()?.saveShareImage(dataUrl, typeof name === 'string' && name ? name : 'reframe-share.png')
      : { error: 'Bad image' }
  )
  handle('share:copy', (_e, dataUrl) =>
    typeof dataUrl === 'string' && dataUrl.startsWith('data:image/png;base64,')
      ? s()?.copyShareImage(dataUrl)
      : undefined
  )
  handle('shell:setNetworkSpeed', (_e, profile) => s()?.setNetworkSpeed(asString(profile)))
  handle('shell:setAdblock', (_e, enabled) => s()?.setAdblock(asBool(enabled)))
  const safeDepth = (d: string): string =>
    d === '16bit' || d === '216' || d === '8bit' || d === '1bit' ? d : 'off'
  const safeTypo = (t: string): string => (t === 'light' || t === 'full' ? t : 'off')
  handle('shell:setPageDisplay', (_e, depth, dither, typo) =>
    s()?.setPageDisplay(safeDepth(asString(depth)), asBool(dither), safeTypo(asString(typo)))
  )
  // Per-origin overrides: `{ "https://x.com": { depth?, typo? } }` (each value
  // "default"/absent means inherit the global default). Sanitised here.
  handle('shell:setDisplayBySite', (_e, bySite) => {
    const clean: Record<string, { depth?: string; typo?: string }> = {}
    if (bySite && typeof bySite === 'object') {
      for (const [k, v] of Object.entries(bySite as Record<string, unknown>)) {
        if (typeof k !== 'string' || !v || typeof v !== 'object') continue
        const m = v as { depth?: unknown; typo?: unknown }
        // 'off' is a valid per-site override (force true colour / no typography
        // even when the global default is reduced); absent = inherit global.
        const depth =
          typeof m.depth === 'string' && ['off', '16bit', '216', '8bit', '1bit'].includes(m.depth)
            ? m.depth
            : undefined
        const typo =
          typeof m.typo === 'string' && ['off', 'light', 'full'].includes(m.typo)
            ? m.typo
            : undefined
        if (depth || typo) clean[k] = { depth, typo }
      }
    }
    return s()?.setDisplayBySite(clean)
  })
  // Synchronous: the page preload asks for the mode for its origin at
  // document-start so the effect lands before the first paint.
  ipcMain.on('page:getDisplay', (e, origin) => {
    e.returnValue = s()?.getPageDisplay(asString(origin)) ?? { depth: 'off', dither: true, typo: 'off' }
  })
  handle('wayback:months', (_e, url, year) => s()?.waybackMonths(asString(url), Number(year)) ?? [])
  handle('shell:print', (_e, id) => (validId(id) ? s()?.print(id) : undefined))
  handle('shell:savePage', (_e, id) => (validId(id) ? s()?.savePage(id) : undefined))
  handle('shell:setImagesEnabled', (_e, id, enabled) =>
    validId(id) ? s()?.setImagesEnabled(id, asBool(enabled)) : undefined
  )
  handle('shell:setChromeOnTop', (_e, onTop) => s()?.setChromeOnTop(asBool(onTop)))
  handle('shell:setContentInsets', (_e, insets) => s()?.setInsets(sanitizeInsets(insets)))
  handle('shell:getTabs', () => s()?.getSnapshot() ?? { tabs: [], activeId: null })
  handle('shell:minimizeWindow', () => s()?.minimizeWindow())
  handle('shell:toggleMaximizeWindow', () => s()?.toggleMaximizeWindow())
  handle('shell:closeWindow', () => s()?.closeWindow())
  handle('shell:isWindowMaximized', () => s()?.isWindowMaximized() ?? false)
  handle('app:quit', () => app.quit())
  // Local files are opened only via this native dialog; the chosen file is
  // loaded into the active tab inside the shell (main process) — no file:// URL
  // ever crosses from the renderer.
  handle('app:openFile', () => s()?.openLocalFile())
}
