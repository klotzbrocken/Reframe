// Shared contract between the Electron main process (engine side) and the
// renderer UI (chrome side). This is the "fork seam": the UI only ever speaks
// in terms of these types, never in terms of Electron APIs. Swapping the engine
// for a Chromium fork later means re-implementing the main side only.

export interface TabState {
  id: number
  url: string
  title: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  favicon: string | null
}

/** Insets the chrome UI reserves around the page content (toolbar, statusbar…). */
export interface ContentInsets {
  top: number
  right: number
  bottom: number
  left: number
}

/** Events pushed from the engine to the chrome UI. */
export type ShellEvent =
  | { type: 'tab-created'; tab: TabState }
  | { type: 'tab-updated'; tab: TabState }
  | { type: 'tab-closed'; id: number }
  | { type: 'tab-activated'; id: number }
  | { type: 'load-start'; id: number }
  | { type: 'load-stop'; id: number }
  | { type: 'status-text'; id: number; text: string }
  | { type: 'window-maximize'; maximized: boolean }

/** Commands sent from the native app menu / page context menu to the chrome. */
export type MenuCommand =
  | { cmd: 'about' }
  | { cmd: 'settings' }
  | { cmd: 'whats-new' }
  | { cmd: 'add-bookmark'; title: string; url: string }
  | { cmd: 'reload-wayback'; id: number; url: string }
  | { cmd: 'theme-menu'; menu: number; item: number }

/** A serializable menu the renderer hands to the main process to render in the
 *  real macOS menu bar (themes like Camino that had no in-window menu bar).
 *  Clicks route back by (menu, item) index via a `theme-menu` MenuCommand. */
export interface NativeMenuItem {
  type: 'item' | 'sep' | 'title'
  label?: string
  disabled?: boolean
  checked?: boolean
}
export interface NativeMenuModel {
  menus: { label: string; items: NativeMenuItem[] }[]
}

/** The API exposed to the renderer via contextBridge as `window.oldweb`. */
/** Density of real Wayback captures for a page, used by the Archive Timeline. */
export interface WaybackTimeline {
  /** Number of captured months per year (0–12). */
  years: Record<number, number>
  /** Capture COUNT per month, keyed "YYYYMM" (absent / 0 = no snapshot). */
  months: Record<string, number>
  /** Total captured months found across fetched years (0 = none yet). */
  total: number
}

export interface OldwebAPI {
  createTab(url?: string): Promise<number>
  closeTab(id: number): Promise<void>
  activateTab(id: number): Promise<void>
  navigate(id: number, input: string): Promise<void>
  goBack(id: number): Promise<void>
  goForward(id: number): Promise<void>
  /** Load the active theme's bundled "About <browser>" history page in a tab. */
  openAbout(id: number, themeId: string): Promise<void>
  reload(id: number): Promise<void>
  stop(id: number): Promise<void>
  /** Clipboard/selection command run against the active page (Edit menu, buttons). */
  editCommand(id: number, cmd: 'cut' | 'copy' | 'paste' | 'selectAll'): Promise<void>
  /** Step the active page's zoom up (+1) or down (-1) — the Font +/- buttons. */
  zoomStep(id: number, dir: 1 | -1): Promise<void>
  /** "Today vs {year}" share: returns Today + {year} as base64 PNG data URLs.
   *  The {year} side is a real Wayback Machine capture (no AI). */
  shareSources(
    id: number,
    opts: {
      source: 'wayback'
      year: number
      /** Wayback month 1–12 (snapshot targeted mid-month); defaults to September. */
      month?: number
      originalUrl?: string
    }
  ): Promise<{
    today?: string
    year?: string
    snapYear?: string
    suggestYear?: string
    error?: string
  }>
  /** Save a composed PNG (data URL) via a native dialog; returns the path. */
  shareSave(dataUrl: string, name: string): Promise<{ path?: string; error?: string }>
  /** Copy a composed PNG (data URL) to the system clipboard. */
  shareCopy(dataUrl: string): Promise<void>
  /** Tell the engine how much room the chrome occupies, so it can place pages. */
  setContentInsets(insets: ContentInsets): Promise<void>
  /** "Time Warp Modem": throttle the network to a period speed (full/isdn/56k/28.8k). */
  setNetworkSpeed(profile: string): Promise<void>
  /** Toggle uBlock-Origin-style ad/tracker blocking (opt-in, default off). */
  setAdblock(enabled: boolean): Promise<void>
  /** Retro display effect for page content: reduce colour depth
   *  (off | 16bit | 216 | 8bit | 1bit) with optional ordered dithering, plus a
   *  classic-typography level (off | light | full). */
  setPageDisplay(depth: string, dither: boolean, typo: string): Promise<void>
  /** Per-origin display overrides: `{ origin: { depth?, typo? } }`; absent
   *  fields inherit the global default. */
  setDisplayBySite(bySite: Record<string, { depth?: string; typo?: string }>): Promise<void>
  /** Archive Timeline: capture COUNT for each of the 12 months of `year` for `url`
   *  (index 0 = Jan). Fetched per year from the Wayback calendar API. */
  waybackMonths(url: string, year: number): Promise<number[]>
  /** Open the print dialog for a tab's page. */
  print(id: number): Promise<void>
  /** Save a tab's page to a local HTML file (Opera "Save to file"). */
  savePage(id: number): Promise<void>
  /** Toggle image loading/display for a tab (Opera image button). */
  setImagesEnabled(id: number, enabled: boolean): Promise<void>
  /** Raise the chrome UI above the page (so DOM menus/popups are visible). */
  setChromeOnTop(onTop: boolean): Promise<void>
  /** Swap the macOS dock / app icon to match the active theme. */
  setAppIcon(themeId: string): Promise<void>
  /** Open a URL in the user's default system browser. */
  openExternal(url: string): Promise<void>
  /** Show a native file-open dialog; resolves to the chosen path or null. */
  openLocalFile(): Promise<void>
  /** Quit the whole application. */
  quitApp(): Promise<void>
  /** From the startup splash window: dismiss it and reveal the main window. */
  splashDone(): void
  /** Ask the main process to show a theme's boot splash window on switch. */
  showThemeSplash(themeId: string): void
  /** Subscribe to commands from the native app menu / page context menu. */
  onMenuCommand(handler: (cmd: MenuCommand) => void): () => void
  /** Render the given menus in the real macOS menu bar (or clear with null,
   *  restoring the default app menu). Used by themes with no in-window menu. */
  setNativeMenu(model: NativeMenuModel | null): Promise<void>
  /** Get the current full state (used on UI startup). */
  getTabs(): Promise<{ tabs: TabState[]; activeId: number | null }>
  // Window controls (the chrome is frameless; the title bar owns these).
  minimizeWindow(): Promise<void>
  toggleMaximizeWindow(): Promise<void>
  closeWindow(): Promise<void>
  isWindowMaximized(): Promise<boolean>
  /** Subscribe to engine events. Returns an unsubscribe function. */
  onEvent(handler: (event: ShellEvent) => void): () => void
}
