# Releasing Reframe

Reframe ships signed + notarized macOS builds and (CI-built) Windows builds to
**GitHub Releases**. electron-updater reads `latest-mac.yml` / `latest.yml` from
the release, so installed copies auto-update.

## Versioning

1. Bump `version` in `package.json` (e.g. `1.1.2`).
2. Commit, then tag `vX.Y.Z` and push the tag.

## macOS (built locally — needs the Developer ID keychain)

```bash
NOTARYTOOL_PROFILE=Retromac GH_TOKEN=$(gh auth token) npm run release
```

- Signs with **Developer ID Application: Maik Klotz (FTJLR8JRNS)** (hardened
  runtime + `build/entitlements.mac.plist`).
- `build.mac.notarize` is **`false` on purpose**: notarization is done by the
  `afterSign` hook `build/notarize.cjs`, which submits via the stored notarytool
  **keychain profile** named in `NOTARYTOOL_PROFILE` (here `Retromac`) and staples
  the ticket — so no Apple password is ever passed on the command line. If
  `NOTARYTOOL_PROFILE` is unset the hook skips notarization (plain signed build).
- One-time credential setup:
  `xcrun notarytool store-credentials "Retromac" --apple-id <id> --team-id FTJLR8JRNS`
- Builds **both** `arm64` and `x64` (the arches are in `build.mac.target`), so
  Apple Silicon and Intel each get their own dmg + zip. Notarization therefore
  runs twice, once per arch.
- Uploads `dmg`, `zip`, `latest-mac.yml` (+ blockmaps) to the `vX.Y.Z` release.

> **Build the two arches in ONE invocation.** `latest-mac.yml` is rewritten from
> scratch by every electron-builder run, listing only what that run produced —
> so building arm64 and x64 separately leaves a manifest naming just the second
> one, and every user on the other arch is handed the wrong build by the
> auto-updater. `npm run release` does the right thing; a manual
> `electron-builder --mac --x64` on its own does not.

## Windows (built on CI)

Pushing a `v*` tag triggers `.github/workflows/release-win.yml` on a
`windows-latest` runner, which runs `npm run release:win` and publishes the NSIS
installer, the portable `.exe` and `latest.yml`. The build is currently
**unsigned** (SmartScreen warns once; auto-update still works). To sign, add an
Authenticode certificate as a CI secret and the matching electron-builder env
(`CSC_LINK` / `CSC_KEY_PASSWORD`).

## Publish the release

electron-builder creates the GitHub release as a **draft**. After both platforms
have uploaded, publish it:

```bash
gh release edit vX.Y.Z -R klotzbrocken/Reframe --draft=false --latest
gh release edit vX.Y.Z -R klotzbrocken/Reframe --notes-file dist/RELEASE_NOTES_X.Y.Z.md
```

## Verify

- `spctl -a -vvv /path/to/Reframe.app` (macOS Gatekeeper) → "accepted".
- Install the previous version, launch, and confirm it offers the new one
  (menu **Reframe → Check for Updates…** on macOS).

## How the update reaches users

electron-updater, fed from GitHub Releases — **no Sparkle**, and no EdDSA key to
manage (unlike RetroMac). The trust anchor is the Developer ID signature plus the
`latest-mac.yml` / `latest.yml` that electron-builder writes into the release.
The check runs in `src/main/index.ts`: on launch when packaged, plus the
**Check for Updates…** menu item. In dev it is a no-op.

## Traps

- **Don't drop the `zip` target.** macOS updates go through Squirrel.Mac, which
  needs `*-mac.zip`; the dmg is only for first install.
- **The version has to really increase.** electron-updater compares semver from
  `package.json`; a rebuilt same version is never offered.
- **Publish the draft.** electron-builder leaves the release as a draft, and
  clients do not see drafts.
- **Unsigned means no auto-update on macOS.** Squirrel.Mac verifies the
  signature and discards the update if it fails. Check before the first real
  update release: `codesign -dv --verbose=4 <Reframe.app>` must say
  "Developer ID Application", and `spctl -a -vvv -t exec <app>` must say
  "accepted / Notarized Developer ID".
- **A broken electron install.** If `electron --version` fails with
  "failed to install correctly" / ENOENT, the installer downloaded but did not
  unpack: extract the cached zip yourself and write the path file (no trailing
  newline).

  ```bash
  ditto -x -k ~/Library/Caches/electron/*/electron-v<version>-darwin-arm64.zip node_modules/electron/dist
  printf 'Electron.app/Contents/MacOS/Electron' > node_modules/electron/path.txt
  ```
