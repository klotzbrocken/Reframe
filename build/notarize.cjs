// electron-builder afterSign hook: notarize + staple the signed .app using a
// stored notarytool *keychain profile* — so no Apple password is ever passed on
// the command line or in env. Set NOTARYTOOL_PROFILE to the profile name; if it
// is unset the step is skipped (a plain signed, un-notarized build).
//
// One-time credential setup (you run this; it prompts for an app-specific pw):
//   xcrun notarytool store-credentials "reframe-notary" \
//     --apple-id <your-apple-id> --team-id FTJLR8JRNS
// Then build with:  NOTARYTOOL_PROFILE=reframe-notary npm run package
const { notarize } = require('@electron/notarize')
const { execFileSync } = require('node:child_process')

exports.default = async function notarizing(context) {
  if (context.electronPlatformName !== 'darwin') return
  const profile = process.env.NOTARYTOOL_PROFILE
  if (!profile) {
    console.log('[notarize] NOTARYTOOL_PROFILE not set — skipping notarization')
    return
  }
  const appName = context.packager.appInfo.productFilename
  const appPath = `${context.appOutDir}/${appName}.app`

  console.log(`[notarize] submitting "${appPath}" via keychain profile "${profile}"…`)
  await notarize({ tool: 'notarytool', appPath, keychainProfile: profile })

  console.log('[notarize] stapling ticket to the app…')
  execFileSync('xcrun', ['stapler', 'staple', appPath], { stdio: 'inherit' })
  console.log('[notarize] done')
}
