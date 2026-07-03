// electron-builder afterPack hook: strip unused Chromium locales from the
// Electron Framework on macOS. electron-builder's `electronLanguages` only
// prunes the app-level .lproj folders (empty markers); the actual ~40 MB of
// locale.pak data lives in Electron Framework.framework/Resources/<lang>.lproj,
// which this hook trims. Runs before signing, so the signature stays valid.
// Chromium falls back to English when the system language's pak is missing.
const { readdir, rm } = require('fs/promises')
const path = require('path')

const KEEP = new Set(['en', 'en_US', 'en_GB', 'de'])

exports.default = async function trimLocales(context) {
  if (context.electronPlatformName !== 'darwin') return
  const res = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
    'Contents/Frameworks/Electron Framework.framework/Versions/A/Resources'
  )
  let removed = 0
  for (const f of await readdir(res)) {
    if (!f.endsWith('.lproj')) continue
    if (!KEEP.has(f.slice(0, -'.lproj'.length))) {
      await rm(path.join(res, f), { recursive: true, force: true })
      removed++
    }
  }
  console.log(`[trim-locales] removed ${removed} framework locales (kept: ${[...KEEP].join(', ')})`)
}
