# Electron version — do not upgrade past 43 without testing audio

`package.json` pins `electron: ^43.7.7`. The caret is deliberate: it picks up
43.x patch releases (including Chromium security fixes) but will **not** jump to
44, which has a Web Audio regression.

## The regression

Electron 44 (Chromium ~145) distorts looping Web Audio playback of low-rate,
8-bit PCM material. Symptom: the sound plays correctly once, then degenerates
into a shrill continuous tone that never stops.

Reproduce with <https://originalhampster.ytmnd.com/> — it plays an 8-bit mono
11025 Hz PCM WAV through an `AudioBufferSourceNode` with `loop = true`.

Measured while chasing it, so nobody has to repeat the work:

- The tone comes from the page, not from Reframe's chrome: muting the tab
  (switch to a second tab, see `activateTab` in `src/main/browser-shell.ts`)
  silences it. Reframe's own synthesised sounds schedule an explicit `stop()`
  for every node at creation time and cannot hang.
- Not an output problem: `AudioContext.playbackStats.underrunEvents` stays 0.
- Not the download: the WAV arrives complete (107802 data bytes, nothing
  missing).
- Not the decode: `decodeAudioData` returns the right duration (9.778 s) and the
  tail decays smoothly to zero, so the loop point is seamless.
- Resampling 11025 → 48000 Hz **overshoots full scale**, peaks at ±1.19, and the
  buffer carries a ~+0.04 DC offset. Overshoot cannot come from the linear
  interpolation Blink historically used, so the resampler changed somewhere
  between Chromium 33 and 44 and rings on hard 8-bit transitions.
- Unrelated to Reframe's own machinery: the modem throttling (CDP
  `Network.emulateNetworkConditions`), the adblocker and the `window.chrome`
  shim were each ruled out by test.

Bisected by ear, newest clean version wins:

| Electron | Audio   |
| -------- | ------- |
| 33.4.11  | clean   |
| 39.8.10  | clean   |
| 42.11.10 | clean   |
| 43.7.7   | clean   |
| 44.5.1   | **broken** |

## Before raising the major

1. Play the YTMND page above and let it loop at least twice.
2. `clipboard.writeImage` is gone in 44. `copyShareImage` in
   `src/main/browser-shell.ts` already handles both APIs — keep reading
   `ClipboardItem` off the module namespace, never as a named ESM import: a
   named import of a missing export is a hard `SyntaxError` and the main process
   will not boot at all.

## Installing an Electron version here

Electron's own installer leaves a broken bundle on this machine: it exits 1
silently, writes no `path.txt`, and unpacks an `Electron.app` without
`Contents/Frameworks`. The download itself succeeds, so extract the cached zip
by hand:

```bash
cd /path/to/Reframe && npm i -D electron@<version>
(cd node_modules/electron && node install.js) || true   # downloads to the cache
rm -rf node_modules/electron/dist && mkdir node_modules/electron/dist
ditto -x -k ~/Library/Caches/electron/*/electron-v<version>-darwin-arm64.zip node_modules/electron/dist
printf 'Electron.app/Contents/MacOS/Electron' > node_modules/electron/path.txt
```
