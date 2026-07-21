# Reframe — Releases & Updates (electron-updater)

**Kein Sparkle.** Reframe ist eine Electron-App und aktualisiert sich über
**`electron-updater`**, gespeist aus **GitHub Releases**. Es gibt hier **keinen
EdDSA-Signaturschlüssel** zu verwalten (anders als bei RetroMac/simplebanking) —
der Vertrauensanker ist die **Code-Signatur (Developer ID)** plus die
`latest-mac.yml`, die electron-updater aus dem Release liest.

Konfiguration (in `package.json` unter `build`):
- **appId:** `app.myretromac.reframe`, **productName:** `Reframe`
- **publish:** GitHub, `klotzbrocken/Reframe`
- **mac.target:** `dmg` **und** `zip` — das **`zip` ist Pflicht**, electron-updater
  aktualisiert macOS über das Zip (Squirrel.Mac), das DMG ist nur für die
  Erstinstallation.
- **afterSign:** `build/notarize.cjs` (Notarisierung via `NOTARYTOOL_PROFILE`)
- **mac.hardenedRuntime:** true

Update-Check läuft in `src/main/index.ts`: beim Start (`app.isPackaged`) automatisch,
plus Menü **„Check for Updates…"** (interaktiv). `autoDownload = true`; bei
`update-downloaded` bietet die App einen Neustart an (`quitAndInstall`). Im Dev-Modus
ist alles ein No-op.

---

## Release fahren

1. **Version hochziehen** in `package.json` (`"version"`), z. B. `1.8.1` → `1.9.0`.
   Optional taggen (electron-builder braucht den Tag nicht, GitHub-Release-Notes sind
   aber schöner mit).

2. **Env setzen** (siehe Voraussetzungen):
   ```bash
   export GH_TOKEN="…"                       # GitHub-Token, repo-Scope
   export NOTARYTOOL_PROFILE="…"             # notarytool-Keychain-Profil
   export CSC_NAME="Developer ID Application: Maik Klotz (…)"   # Signatur-Identität
   ```

3. **Bauen + veröffentlichen:**
   ```bash
   npm run release          # = electron-vite build && electron-builder --mac --publish always
   # Windows/Linux analog: npm run release:win / npm run release:linux
   ```
   Das baut das Renderer/Main-Bundle, signiert + notarisiert die App, packt
   `Reframe-<ver>.dmg`, `Reframe-<ver>-mac.zip`, die `.blockmap`s und **`latest-mac.yml`**,
   und lädt alles in ein GitHub-Release.

4. **Release veröffentlichen:** electron-builder legt das Release standardmäßig als
   **Draft** an. Auf GitHub das Release öffnen, Notes ergänzen, **Publish** klicken.
   Erst dann sieht `latest-mac.yml` für die Clients „live" aus.

5. **Prüfen:** eine ältere gepackte Version starten → sie sollte beim Start (oder via
   „Check for Updates…") das neue Release finden, im Hintergrund laden und den
   Neustart anbieten.

---

## Voraussetzungen / Env

- **`GH_TOKEN`** — GitHub Personal Access Token mit `repo`-Scope (für `--publish`).
- **`NOTARYTOOL_PROFILE`** — notarytool-Keychain-Profil
  (`xcrun notarytool store-credentials <name> --apple-id … --team-id … --password …`),
  wird von `build/notarize.cjs` gelesen.
- **Developer-ID-Signatur** — ⚠️ **wichtig:** in `package.json` steht `mac.identity: null`,
  das **deaktiviert die Signatur** in electron-builder. Für funktionierende
  macOS-Auto-Updates **muss** die App aber Developer-ID-signiert **und** notarisiert
  sein (Squirrel.Mac verifiziert die Signatur, sonst wird das Update verworfen).
  Also entweder `CSC_NAME`/`CSC_LINK` beim Release setzen **oder** `mac.identity` auf
  die Developer-ID-Identität stellen. Vor dem ersten „echten" Auto-Update-Release
  prüfen: `codesign -dv --verbose=4 <Reframe.app>` → muss „Developer ID Application"
  zeigen, und `spctl -a -vvv -t exec <app>` → „accepted / Notarized Developer ID".
- **Node 26 electron-install-Gotcha:** falls `electron --version` mit
  „failed to install correctly"/ENOENT scheitert — das Zip manuell aus
  `~/Library/Caches/electron/…electron-v*.zip` nach `node_modules/electron/dist`
  entpacken und `printf 'Electron.app/Contents/MacOS/Electron' > node_modules/electron/path.txt`
  (ohne Zeilenumbruch).

---

## Wie das Update beim Nutzer ankommt

1. `npm run release` legt im GitHub-Release u. a. `latest-mac.yml` + `*-mac.zip` ab.
2. Der `autoUpdater` in der laufenden App fragt beim Start (und per Menü) das neueste
   Release ab, vergleicht die Version aus `latest-mac.yml` mit der eigenen.
3. Ist eine neuere da: Download im Hintergrund (`autoDownload`), dann Dialog
   „jetzt neu starten?" → `quitAndInstall`.

Kein manueller Migrations-Schritt nötig (anders als bei der Sparkle-Key-Rotation von
RetroMac/simplebanking) — solange die Signatur-Kette stimmt, ist der Übergang für
Bestands-Nutzer nahtlos.

## Fallstricke

- **`zip`-Target nicht entfernen** — ohne `*-mac.zip` + `latest-mac.yml` kann
  electron-updater unter macOS nicht aktualisieren (das DMG allein reicht nicht).
- **Version muss echt steigen** — electron-updater vergleicht semver aus
  `package.json`/`latest-mac.yml`.
- **Draft nicht vergessen zu publishen** — ein Draft-Release ist für die Clients
  unsichtbar.
- **Unsigniert = kein Auto-Update auf macOS** — siehe Identity-Hinweis oben.
