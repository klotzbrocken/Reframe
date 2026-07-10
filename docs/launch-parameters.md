# Launch parameters

Reframe reads command-line arguments at startup in the main process
(`src/main/index.ts` → `launchTheme()`). Only one app-specific flag exists today;
the rest are standard Electron/Chromium switches that pass straight through.

## `--theme=<id>` — start with a specific theme (this launch only)

Opens Reframe in the given theme for **this run only**. It overrides the saved
default theme but is **not persisted** — the next normal launch uses your saved
theme again. The id is validated by a regex in main and again by the renderer's
`safeThemeId`, so an unknown id is ignored (falls back to the saved/default theme).

Accepted forms: `--theme=<id>` **and** `--theme <id>` (space-separated).

### Dev

```bash
npm run dev -- -- --theme=<id>
```

The double `--` matters: the first `--` ends npm's own arg parsing, the second
tells electric-vite/electron to forward the rest to the Electron **main** process
(where `process.argv` is read). Example: `npm run dev -- -- --theme=camino`.

### Packaged app

- **macOS**
  ```bash
  open -a Reframe --args --theme=camino
  # or run the binary directly:
  /Applications/Reframe.app/Contents/MacOS/Reframe --theme=camino
  ```
- **Windows**
  ```powershell
  "C:\Program Files\Reframe\Reframe.exe" --theme=camino
  ```
- **Linux (AppImage)**
  ```bash
  ./Reframe-*.AppImage --theme=camino
  ```

### Valid theme ids

From `src/renderer/public/themes/index.json`:

| id | Theme |
|----|-------|
| `mosaic` | NCSA Mosaic (1993) |
| `ie1` | Internet Explorer 1.0 (1995) |
| `ie302` | Internet Explorer 3.02 (1997) |
| `ie5` | Internet Explorer 5 (1999) |
| `ie6` | Internet Explorer 6.0 (2001) |
| `ie4mac` | Internet Explorer 4.01 for Mac (1998) |
| `netscape3` | Netscape Navigator 3.04 Gold (1997) |
| `netscape` | Netscape Communicator 4.7 (1999) |
| `safari` | Safari 1.0 (2003) |
| `camino` | Camino 2.0 (2009) |
| `firefox` | Firefox 1.0 (2004) |
| `netscape6` | Netscape Communicator 6.0 (2000) |
| `opera` | Opera 3.60 (2000) |
| `kmeleon` | K-Meleon 0.2 (2001) |

## `--remote-debugging-port=<port>` — Chromium DevTools Protocol (CDP)

A standard Electron/Chromium switch (not Reframe-specific) that exposes the CDP
endpoint for automated inspection/testing of the renderer. Handy for driving the
UI from a script during development.

```bash
npm run dev -- -- --theme=camino --remote-debugging-port=9222
# then connect a CDP client to http://localhost:9222/json
```

Other Chromium switches (e.g. `--disable-gpu`, `--lang=…`) are accepted the same
way — they are consumed by Electron/Chromium, not by Reframe's own code.

## Notes / non-goals

- There is **no** persisted "start theme" CLI flag — use **Settings → Default
  theme at start** for a durable default; `--theme` is a per-launch override.
- Adding a new app flag = extend `launchTheme()` (or add a sibling parser) in
  `src/main/index.ts`, read from `process.argv`, and validate before use.
