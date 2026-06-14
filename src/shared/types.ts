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

/** The API exposed to the renderer via contextBridge as `window.oldweb`. */
export interface OldwebAPI {
  createTab(url?: string): Promise<number>
  closeTab(id: number): Promise<void>
  activateTab(id: number): Promise<void>
  navigate(id: number, input: string): Promise<void>
  goBack(id: number): Promise<void>
  goForward(id: number): Promise<void>
  reload(id: number): Promise<void>
  stop(id: number): Promise<void>
  /** Tell the engine how much room the chrome occupies, so it can place pages. */
  setContentInsets(insets: ContentInsets): Promise<void>
  /** Toggle the optional CRT "retro content" overlay for a tab. */
  setRetroContent(id: number, enabled: boolean): Promise<void>
  /** Open the print dialog for a tab's page. */
  print(id: number): Promise<void>
  /** Raise the chrome UI above the page (so DOM menus/popups are visible). */
  setChromeOnTop(onTop: boolean): Promise<void>
  /** Swap the macOS dock / app icon to match the active theme. */
  setAppIcon(themeId: string): Promise<void>
  /** Open a URL in the user's default system browser. */
  openExternal(url: string): Promise<void>
  /** From the startup splash window: dismiss it and reveal the main window. */
  splashDone(): void
  /** Ask the main process to show a theme's boot splash window on switch. */
  showThemeSplash(themeId: string): void
  /** Subscribe to commands from the native app menu / page context menu. */
  onMenuCommand(handler: (cmd: MenuCommand) => void): () => void
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
