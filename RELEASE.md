# Releasing Reframe

Reframe ships signed + notarized macOS builds and (CI-built) Windows builds to
**GitHub Releases**. electron-updater reads `latest-mac.yml` / `latest.yml` from
the release, so installed copies auto-update.

## Versioning

1. Bump `version` in `package.json` (e.g. `1.1.2`), and run `npm install
   --package-lock-only` so the lockfile's root version follows. `npm ci` on CI
   fails on a lockfile that does not match `package.json`.
2. Commit.
3. **Create the draft release, before the tag is pushed:**

   ```bash
   GH_TOKEN=$(gh auth token) npm run release:prepare
   ```

   This is the step that keeps the three platform builds from each creating
   their own release object — see the duplicate-draft trap below for why. It is
   idempotent, and it does not return until the new draft is visible in the
   release listing, so pushing the tag straight afterwards is safe.
4. Tag `vX.Y.Z` and push the tag. The Windows and Linux builds start here, and
   each one checks the draft is there before it builds — `npm run release`,
   `release:win` and `release:linux` all run `build/ensure-release.cjs` first and
   refuse to go on if the draft is missing, duplicated, or already published.

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
have uploaded, first make sure there is exactly **one** release object for the
tag (see the duplicate-draft trap below), then publish that one by its id:

```bash
ID=$(gh api repos/klotzbrocken/Reframe/releases --jq '.[] | select(.tag_name=="vX.Y.Z" and .draft) | .id')
gh api --method PATCH repos/klotzbrocken/Reframe/releases/$ID \
  -F draft=false -F make_latest=true -f name="X.Y.Z" \
  --field body=@dist/RELEASE_NOTES_X.Y.Z.md
```

`gh release edit vX.Y.Z --draft=false --latest` is shorter and does the same
thing — but only while the tag maps to a single release object. If it maps to
two, `gh` silently picks one of them, which is how half a release gets shipped.

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

- **electron-builder can create TWO drafts for one tag.** Guarded since 1.15.0
  by `build/ensure-release.cjs` (step 3 under Versioning) — this is what that
  step is for, and the rest of this entry is how to recognise it if it ever gets
  through anyway. The dmg and the zip publisher run concurrently. Each looks for a release for `vX.Y.Z`, neither
  finds one, and both create a draft — GitHub allows the duplicate, because a
  draft carries no real tag yet. The assets then split across the two objects,
  and every later job (the Windows and Linux CI runs) uploads into whichever one
  its own publisher resolves to, which is not necessarily the one
  `gh release view` shows you. The symptom is contradictory: a job logs
  `uploading file=… provider=github`, even `overwrite published file … reason=already
  exists on GitHub`, while that asset is nowhere on the release. Count the
  objects before publishing:

  ```bash
  gh api repos/klotzbrocken/Reframe/releases \
    --jq '.[] | select(.tag_name=="vX.Y.Z") | "id=\(.id) draft=\(.draft) assets=\(.assets|length)"'
  ```

  More than one line: pick the object you intend to ship, move the missing
  assets into it (download by asset id, re-upload to the keeper's id), check the
  sha512 in each `latest-*.yml` against the file you moved, and only then delete
  the extra draft. This bit v1.15.0: the Linux AppImage and `latest-linux.yml`
  sat on an invisible second draft while the release looked complete.

  Creating the draft is deliberately its own step and not part of the build
  scripts. GitHub's release listing is not read-after-write consistent — a draft
  created a second earlier can still be missing from `GET /releases`, measured
  while building 1.15.0 — so three build scripts each allowed to create would
  race the same way the two publishers do. `npm run release:prepare` creates it
  once and waits for it to show up; the builds only ever check.
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
