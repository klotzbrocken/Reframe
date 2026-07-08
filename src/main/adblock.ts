// Opt-in ad / tracker blocking, uBlock-Origin-style. The real uBO extension does
// not run in Electron, so we use @ghostery/adblocker-electron with the same
// filter lists (EasyList + uBO's): it blocks network requests and injects the
// cosmetic (element-hiding) filters. The engine is built the first time blocking
// is switched on — the lists are fetched once, then cached on disk.
//
// @ghostery/adblocker-electron is imported *lazily* (dynamic import below): at
// module load it resolves the path of its companion preload package, which is
// only present in the packaged app when enabling is actually attempted. Keeping
// the import out of the startup path means a user who never turns blocking on
// pays nothing — and never risks a launch-time crash if the package is missing.
import { app, session as electronSession } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { ElectronBlocker } from '@ghostery/adblocker-electron'

let engine: Promise<ElectronBlocker> | null = null

function getEngine(): Promise<ElectronBlocker> {
  engine ??= (async () => {
    const { ElectronBlocker } = await import('@ghostery/adblocker-electron')
    return ElectronBlocker.fromPrebuiltAdsAndTracking((url: string) => fetch(url), {
      path: join(app.getPath('userData'), 'adblock-engine.bin'),
      read: readFile,
      write: writeFile
    })
  })()
  return engine
}

/**
 * Enable or disable blocking on a session (defaults to the one the page views
 * use). Building the engine — and fetching the lists — only happens on the first
 * enable, so a user who never turns it on pays nothing. Any failure to load the
 * engine degrades gracefully to "no blocking" rather than crashing the app.
 */
export async function applyAdblock(
  enabled: boolean,
  target = electronSession.defaultSession
): Promise<void> {
  try {
    if (!enabled) {
      if (engine) {
        const blocker = await engine
        if (blocker.isBlockingEnabled(target)) blocker.disableBlockingInSession(target)
      }
      return
    }
    const blocker = await getEngine()
    if (!blocker.isBlockingEnabled(target)) blocker.enableBlockingInSession(target)
  } catch (err) {
    console.warn('[adblock] blocking unavailable — continuing without it:', err)
    engine = null // allow a later retry after a transient failure
  }
}
