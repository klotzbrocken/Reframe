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
- Uploads `dmg`, `zip`, `latest-mac.yml` (+ blockmaps) to the `vX.Y.Z` release.

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
