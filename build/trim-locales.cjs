// electron-builder afterPack hook: strip unused Chromium locales from the
// Electron Framework on macOS. electron-builder's `electronLanguages` only
// prunes the app-level .lproj folders (empty markers); the actual ~40 MB of
// locale.pak data lives in Electron Framework.framework/Resources/<lang>.lproj,
// which this hook trims. Runs before signing, so the signature stays valid.
// Chromium falls back to English when the system language's pak is missing.
const { readdir, rm } = require('fs/promises')
const path = require('path')

// Keep English (both en-US and en-GB) plus German. macOS framework .lproj folders
// use underscores today (en.lproj / en_GB.lproj), but list the hyphenated forms too
// so a future Electron naming change can't silently drop them. NOTE: the Windows
// <lang>.pak files are pruned by electron-builder's `electronLanguages`, not here —
// this hook is darwin-only and never touches them.
const KEEP = new Set(['en', 'en_US', 'en-US', 'en_GB', 'en-GB', 'de'])

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
