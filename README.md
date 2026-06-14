# Reframe

**Today's web, yesterday's look.**

Reframe is a modern Chromium browser dressed in the chrome of the browsers we
grew up with. It renders the real, present-day web with the actual Chromium
engine — then wraps every page in a pixel-faithful, fully skinnable retro browser
shell. Flip a theme at runtime and the same live website sits inside Internet
Explorer 5, Netscape Communicator 4.8, or classic Aqua Safari.

It's a love letter to an era of the web, built as an open-source fun project.

🌐 [www.myretromac.app](https://www.myretromac.app)

## A homage, with thanks

The whole point of Reframe is to celebrate the browser interfaces that defined how
a generation first experienced the internet. We owe an enormous debt to the
designers and teams behind these iconic interfaces:

- **Microsoft** — Internet Explorer and the Windows 98 look.
- **Netscape / AOL** — Netscape Navigator & Communicator, the browser that opened
  the web for so many of us.
- **Apple** — Safari and the Aqua design language.

“Internet Explorer”, “Netscape”, “Safari”, the Windows logo, the Netscape **N**,
the Aqua look and all related marks are **trademarks and design property of their
respective owners** — Microsoft, Netscape/AOL and Apple. Reframe is **not
affiliated with, sponsored by, or endorsed by** any of them. Every retro look here
is a reconstruction made out of admiration; it exists purely as a tribute to their
iconic design. No original vendor assets are extracted or redistributed beyond what
is needed for this historical homage.

## What it does

- **Real Chromium rendering** — one `WebContentsView` per tab; modern pages render
  exactly as they do in Chrome.
- **Themeable chrome** — tabs, toolbar, address bar, animated throbber and status
  bar are all our own HTML/CSS, swappable live without a restart.
- **Theme engine** — themes are pure data (`manifest.json` + `theme.css` + assets),
  hot-swappable at runtime. No code to add a new skin.
- **Internet Explorer 5 theme** — pixel-faithful Windows 98: MS Sans Serif bitmap
  type, exact bevels, navy gradient title bar with working window controls on a
  frameless window, authentic scrollbars, sunken fields, status bar. Bevel /
  scrollbar / control recipes and the font are from
  [98.css](https://github.com/jdan/98.css) (MIT); the spinning globe throbber is
  original CSS. No extracted Microsoft assets.
- **Netscape Communicator 4.8 theme** — reconstructed to a period-accurate spec:
  the right colors, single-pixel Win9x bevels, Tahoma chrome type, the classic
  toolbar order and the rotating **N** throbber.
- **Aqua Safari theme** — early-2000s Mac OS X brushed-metal / Aqua chrome.
- **Wayback time travel** — point any theme at a year and pages load through the
  Internet Archive's Wayback Machine, so a 2024 site can show you its 2001 self.
- **Global settings** — pick your home page, the theme you start in, the Wayback
  year, read the legal homage notice, and buy the author a coffee.
- **CRT retro content mode** — optional per-tab scanline/vignette overlay (off by
  default).

## Architecture

```
Browser-UI-Layer  (React/TS — tabs, toolbar, themes)   ← skinnable
        │  BrowserShell API  (engine-neutral seam)
Electron main  (Chromium engine — WebContentsView/tab)  ← stays modern
```

The UI never calls Electron directly — only the `BrowserShell` contract in
[`src/shared/types.ts`](src/shared/types.ts). This is the **fork seam**: to gain
full Chrome extensions / sync later, re-implement the main side against a Chromium
fork (Vivaldi-model) and the entire UI + every theme keep working unchanged.

### Key files

| File | Role |
|------|------|
| [`src/main/browser-shell.ts`](src/main/browser-shell.ts) | The engine. Owns tabs/`WebContentsView`s, navigation, layout, page context menu, CRT injection. |
| [`src/main/index.ts`](src/main/index.ts) | App + window bootstrap; native app menu, dock icon, chrome + page view stacking. |
| [`src/preload/index.ts`](src/preload/index.ts) | `contextBridge` → `window.oldweb` (secure IPC). |
| [`src/renderer/App.tsx`](src/renderer/App.tsx) | Composes the chrome; bookmarks/history/settings; reports content insets to the engine. |
| [`src/renderer/components/SettingsDialog.tsx`](src/renderer/components/SettingsDialog.tsx) | Global settings & about dialog. |
| [`src/renderer/theme/loader.ts`](src/renderer/theme/loader.ts) | Theme engine: load manifest, swap stylesheet, apply CSS vars, sounds. |
| [`src/renderer/public/themes/`](src/renderer/public/themes) | The themes (data only). |

## Run

```bash
npm install
npm run dev      # launches the app with hot reload
npm run build    # production build into out/
npm run package  # build a macOS .app via electron-builder
```

## Add a theme

No code changes required — drop a folder in `src/renderer/public/themes/<id>/`:

```
<id>/
  manifest.json   # name, layout hints, labels, throbber kind, CSS vars
  theme.css       # all the visuals; targets the structural .ow-* classes
  assets/  sounds/  fonts/   # optional
```

Then add an entry to `src/renderer/public/themes/index.json`. The structural class
names a theme styles (`.ow-toolbar`, `.ow-tab`, `.ow-throbber`, `.ow-addressbar`,
`.ow-statusbar`, …) are defined neutrally in
[`src/renderer/styles/base.css`](src/renderer/styles/base.css).

## License

Reframe's own code is released under the [MIT License](LICENSE).

This does **not** grant any rights to third-party trademarks or designs referenced
above; those remain with Microsoft, Netscape/AOL and Apple. Verify the bundled
font's redistribution terms before shipping binaries. Reframe is not for the Mac
App Store (Chromium entitlements); distribute directly.

## Support

If Reframe made you smile, you can
[buy me a coffee ☕](https://ko-fi.com/N4N11K1NC).
