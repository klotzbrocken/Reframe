# Plan — uBlock-Origin-Style Ad/Tracker Blocking (opt-in, default OFF)

## Ansatz
Die echte uBO-Extension läuft nicht in Electron (fehlende Extension-APIs). Stattdessen
nativer Blocker **`@ghostery/adblocker-electron`** mit denselben Filterlisten
(EasyList + uBO). Hakt an `session.webRequest`, blockt Requests und injiziert kosmetische
Filter. Standardmäßig **deaktiviert**, per Settings einschaltbar.

## 1 — Dependency
- `npm i @ghostery/adblocker-electron` (Runtime-Dep). Filterlisten werden zur Laufzeit
  geladen und in `userData` gecached — nicht ins Bundle gepackt (~1–2 MB Dep).

## 2 — Blocker-Modul (main): `src/main/adblock.ts`
- Singleton `ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {path,read,write})` mit
  Disk-Cache (`userData/adblock-engine.bin`), damit Listen nicht bei jedem Start neu geladen.
- `setAdblock(session, enabled)`: `enableBlockingInSession` / `disableBlockingInSession`.
  (übernimmt Netzwerk-Blocking **und** Kosmetik-Injektion via Session-Preload.)

## 3 — Engine-Anbindung (`browser-shell.ts` / `index.ts`)
- Page-`WebContentsView`s nutzen `session.defaultSession` (kein Partition). Blocking dort
  aktivieren/deaktivieren. app:// -Chrome teilt die Session, ist aber lokal → kein Effekt.
- `BrowserShell.setAdblock(enabled)`: Modul aufrufen + aktiven Tab neu laden.
- Beim Start persistierten Wert anwenden.

## 4 — IPC + preload + types
- `ipc.ts`: `handle('shell:setAdblock', (_e,on)=>s()?.setAdblock(asBool(on)))`
- `preload/index.ts` + `shared/types.ts`: `setAdblock(enabled: boolean): Promise<void>`

## 5 — Settings-UI + Persistenz
- `SettingsDialog.tsx`: `adblock?: boolean` in `Settings`; Checkbox „Block ads & trackers
  (uBlock Origin filter lists)", **Default AUS**; Hinweis: lädt EasyList/uBO-Listen einmalig.
- `App.tsx`: Effect (wie `connectionSpeed`) ruft `window.oldweb.setAdblock(settings.adblock ?? false)`
  beim Mount + bei Änderung. Persistenz über bestehendes Settings-Save (localStorage).

## 6 — Detail: Kosmetik-Filter/Preload
- `enableBlockingInSession` registriert einen Preload auf der Session. Sicherstellen, dass
  Reframes bestehender Page-Preload dabei erhalten bleibt (nicht überschrieben wird).

## Verifikation
1. `tsc` + Tests + `build` grün.
2. `npm run dev`: Settings → aktivieren → werbelastige Seite laden → Ad/Tracker-Requests
   geblockt (DevTools-Network), Ad-Slots via Kosmetik ausgeblendet; aus + reload → Werbung zurück.
3. Page-Preload funktioniert weiter (Favicon/Titel-Events, Retro-Overlay).
4. Kein ungewolltes Blocken der Share-/Wayback-Capture-Views (Scope: Tab-Session).

## Bewusst nicht dabei (v2)
- Echte uBO-Extension (in Electron nicht lauffähig).
- Per-Site-Allowlist-UI, eigene Filterlisten, uBO-Popup-UI.

## Offenes Risiko
- Wirksamkeit lässt sich hier (Sandbox) nicht an echten Seiten prüfen → Verifikation in
  `npm run dev`. Erste Aktivierung braucht Netz (Listen laden, dann Cache).
