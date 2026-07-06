// Opt-in ad / tracker blocking, uBlock-Origin-style. The real uBO extension does
// not run in Electron, so we use @ghostery/adblocker-electron with the same
// filter lists (EasyList + uBO's): it blocks network requests and injects the
// cosmetic (element-hiding) filters. The engine is built the first time blocking
// is switched on — the lists are fetched once, then cached on disk.
import { app, session as electronSession } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { ElectronBlocker } from '@ghostery/adblocker-electron'

let engine: Promise<ElectronBlocker> | null = null

function getEngine(): Promise<ElectronBlocker> {
  engine ??= ElectronBlocker.fromPrebuiltAdsAndTracking((url: string) => fetch(url), {
    path: join(app.getPath('userData'), 'adblock-engine.bin'),
    read: readFile,
    write: writeFile
  })
  return engine
}

/**
 * Enable or disable blocking on a session (defaults to the one the page views
 * use). Building the engine — and fetching the lists — only happens on the first
 * enable, so a user who never turns it on pays nothing.
 */
export async function applyAdblock(
  enabled: boolean,
  target = electronSession.defaultSession
): Promise<void> {
  if (!enabled) {
    if (engine) (await engine).disableBlockingInSession(target)
    return
  }
  const blocker = await getEngine()
  if (!blocker.isBlockingEnabled(target)) blocker.enableBlockingInSession(target)
}
