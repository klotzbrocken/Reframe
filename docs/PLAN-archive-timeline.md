# Plan — Archive Timeline im Flyout (Wayback-Snapshot-Dichte)

## Ziel
Sichtbar machen, welche Wayback-Snapshots für die aktuelle Seite wirklich existieren —
als Dichte-Histogramme direkt über den bestehenden Jahr- und Monats-Slidern (Option 1 +
Monats-Histogramm). Die Slider bleiben zur Feinwahl; die Balken zeigen/klicken echte Snapshots.

## Datenquelle (ein Fetch für beide Histogramme)
Wayback **CDX-API** im **Main-Prozess** (wie `findSnapshot`, kein CORS):
```
https://web.archive.org/cdx/search/cdx?url=<unwrapped>&output=json
  &fl=timestamp&collapse=timestamp:6&from=19960101&to=20201231&limit=6000
```
- `collapse=timestamp:6` → eine Zeile pro **YYYYMM** (Monats-Buckets). Daraus:
  - `yearMonths[year]` = Anzahl erfasster Monate (0–12) → Balkenhöhe Jahr-Histogramm.
  - `monthPresence[year][1..12]` = existiert Snapshot? → Monats-Histogramm.
- Timeout (~4 s) + Fehler → leeres Ergebnis. Cache per URL (Main-Map, TTL) gegen Mehrfach-Fetch.

## 1 — Main / IPC / preload / types
- `browser-shell.ts`: `waybackTimeline(url)` → CDX fetchen, parsen, aggregieren zu
  `{ years: Record<number,number>, months: Record<string,true> }` (kompakt). URL vorher
  `unwrapWayback` + nur http/https.
- `ipc.ts`: `handle('wayback:timeline', (_e,url)=>s()?.waybackTimeline(asString(url)))`.
- `preload/index.ts` + `shared/types.ts`: `waybackTimeline(url): Promise<Timeline>`.

## 2 — App-Anbindung
- Beim **Öffnen des Flyouts** bzw. Wechsel der aktiven Tab-URL: `waybackTimeline(unwrap(activeTab.url))`
  laden (debounced, gecached), Ergebnis als Prop `timeline` an `FloatingMenu`.
- Zustände: `loading` / `empty` (Seite nicht archiviert) mitgeben.

## 3 — Flyout-UI (`FloatingMenu.tsx`)
- **Jahr-Histogramm** über dem Jahr-Slider: 25 Balken (1996–2020), Höhe ∝ `yearMonths[year]`,
  leere Jahre ausgegraut, aktuelle Auswahl markiert. Klick → Jahr setzen, Monat auf den ersten
  erfassten Monat snappen, `onWayback`.
- **Monats-Histogramm** über dem Monats-Slider: 12 Balken für das **gewählte Jahr**
  (`monthPresence[year]`), leere Monate ausgegraut. Klick → Monat setzen, `onWayback`.
  Aktualisiert sich, wenn das Jahr wechselt.
- **Snap-to-nearest:** Zielt der Nutzer auf einen leeren Bereich, auf den nächsten existierenden
  Snapshot springen (nie mehr „blind"). Slider-Thumb liegt deckungsgleich über den Balken.
- **Loading**: dünnes Shimmer über den Balken. **Empty**: Hinweiszeile „No archived snapshots
  for this page" (Slider bleiben nutzbar → fällt auf die bisherige `available`-Suche zurück).
- CSS in `base.css` (`.ow-fab__hist`, `.ow-fab__bar`, states) — kompakt, themenneutral.

## 4 — Verhalten / Reuse
- Auswahl läuft weiter über `applyWayback(year,month)` → `setOldWebDate` → Reload (bestehender Pfad).
- Die bestehende Main-`findSnapshot`-Auflösung bleibt als Fallback (z. B. wenn ein Balken einen
  Monat zeigt, der Availability-API-Timestamp leicht abweicht).

## Edge cases
- Seite nicht archiviert / non-http / `about:blank` → Empty-State, keine Balken.
- Sehr viele Captures → `collapse` + `limit` deckeln (Monats-Granularität reicht optisch).
- Bereits gewayback'te URL → `unwrapWayback` vor dem Fetch.
- CDX langsam/Rate-Limit → Timeout, Empty-State, kein Blockieren des Flyouts.

## Verifikation
1. `tsc` + Build grün.
2. `npm run dev`: Flyout öffnen auf archivierter Seite (z. B. amazon.com) → Jahr-Histogramm
   zeigt Dichte, Klick springt; Jahr wählen → Monats-Histogramm zeigt echte Monate, Klick lädt
   den Snapshot. Nicht-archivierte Seite → Empty-State, Slider funktionieren weiter.
3. CDP-Check: `waybackTimeline` liefert plausible Buckets für eine bekannte URL.

## Bewusst nicht dabei (v2)
- Tages-/Stunden-Granularität, Hover-Tooltip mit exaktem Snapshot-Datum/-Anzahl, Thumbnails,
  Domain-weite statt seiten-genaue Timeline (matchType=prefix).
