export interface ThemeSummary {
  id: string
  name: string
  era: string
}

/**
 * Known toolbar actions — the single runtime source of truth, used both to
 * derive the `ToolbarItem` type and to validate a fetched manifest's toolbar
 * (see theme/validate.ts). '|' is a separator and is handled separately.
 */
export const TOOLBAR_ITEMS = [
  'back',
  'forward',
  'stop',
  'refresh',
  'home',
  'search',
  'favorites',
  'history',
  'mail',
  'print',
  'edit',
  'netscape',
  'security',
  'shop',
  // Opera 3.x toolbar set
  'new',
  'open',
  'save',
  'copy',
  'url',
  'hotlist',
  'tile',
  'cascade',
  // Internet Explorer 1.0 toolbar set
  'favadd',
  'fontup',
  'fontdown',
  'cut',
  'paste',
  // Internet Explorer 4.01 (Mac) toolbar set
  'preferences',
  // Internet Explorer 6.0 (Windows XP) toolbar set
  'messenger',
  // NCSA Mosaic toolbar set
  'help',
  'loaddisk',
  // Netscape Navigator 3.04 toolbar set
  'nsedit',
  'find',
  'images',
  // AOL Desktop 4.0 toolbar set (the colourful icon band). Several are inert /
  // greyed in Reframe because they'd need the real AOL service (mail, chat…).
  'read',
  'write',
  'mailcenter',
  'myfiles',
  'myaol',
  'internet',
  'channels',
  'people',
  'quotes',
  'perks',
  'weather'
] as const

/** Toolbar entries. Known actions render as buttons; '|' is a separator. */
export type ToolbarItem = (typeof TOOLBAR_ITEMS)[number] | '|'

export interface ThemeManifest {
  id: string
  name: string
  era?: string
  /** Period scrollbar look injected into page content (the web view's own
   *  scrollbars, styled via ::-webkit-scrollbar in the page preload). Omitted =
   *  the browser default. One of the shared OS looks in page.ts. */
  scrollbar?: 'sys7' | 'sys7mono' | 'aqua10' | 'xp'
  /** The exact toolbar button row for this theme, in order. */
  toolbar?: ToolbarItem[]
  /** The exact menu-bar labels for this theme, in order. */
  menus?: string[]
  /** Home / Search target for this theme (era-appropriate; archived if needed). */
  homeUrl?: string
  /** Whether this theme shows a personal / bookmark toolbar. NOTE: the bookmark
   *  bar now renders the app-wide GLOBAL default links (see DEFAULT_LINKS in
   *  App.tsx) for every theme; the entries listed here are NO LONGER rendered —
   *  a non-empty `personalBar` only acts as the on/off gate for whether the bar
   *  appears at all. (Kept as objects for backwards-compatible manifests.) An
   *  entry with `children` would render as a folder if per-theme items return. */
  personalBar?: {
    label: string
    icon?: string
    url?: string
    children?: { label: string; url?: string; icon?: string }[]
  }[]
  /** Wayback Machine timestamp for the "Old Web" toggle — YYYY, YYYYMM or
   *  YYYYMMDD (theme era). Falls back to oldWebYear, then 2002. */
  oldWebDate?: string
  /** @deprecated use oldWebDate */
  oldWebYear?: number
  /** Layout hints the structural UI reads (visuals stay in theme.css). */
  layout?: {
    tabsPosition?: 'top' | 'bottom'
    showStatusBar?: boolean
    showMenuBar?: boolean
    showTabs?: boolean
    /** Put the address field (and a search box) on the nav-button row itself,
     *  instead of on its own line below — the Firefox 1.0 / early-2000s layout. */
    unifiedToolbar?: boolean
    /** Show the live page favicon in the address field (over the dummy icon). */
    showFavicon?: boolean
    /** NCSA Mosaic: show a read-only "Document Title:" row above the URL row. */
    documentTitle?: boolean
    /** Where the address bar sits: 'top' (default) or 'bottom' (Opera 3.x, the
     *  URL lives in the status bar at the foot of the window). */
    addressPosition?: 'top' | 'bottom'
    /** Dock a left side panel beside the page (Opera 3.x HotList). */
    sidePanel?: 'hotlist'
    /** Show a live clock at the right of the toolbar (Opera 3.x). */
    showClock?: boolean
    /** Render this theme's menus in the real macOS menu bar instead of an
     *  in-window menu bar (Camino had no in-window menus). macOS only; other
     *  platforms fall back to the in-window menu bar. */
    nativeMenus?: boolean
  }
  throbber?: {
    /** 'css' = animated purely in theme.css; 'image' = animated background. */
    kind?: 'css' | 'image'
    label?: string
  }
  labels?: {
    address?: string
    go?: string
    back?: string
    forward?: string
    stop?: string
    reload?: string
    home?: string
    newTab?: string
    search?: string
    favorites?: string
    history?: string
    mail?: string
    print?: string
    edit?: string
    netscape?: string
    security?: string
    shop?: string
    new?: string
    open?: string
    save?: string
    copy?: string
    url?: string
    hotlist?: string
    tile?: string
    cascade?: string
    favadd?: string
    fontup?: string
    fontdown?: string
    cut?: string
    paste?: string
    preferences?: string
    messenger?: string
    help?: string
    loaddisk?: string
    nsedit?: string
    find?: string
    images?: string
    read?: string
    write?: string
    mailcenter?: string
    myfiles?: string
    myaol?: string
    internet?: string
    channels?: string
    people?: string
    quotes?: string
    perks?: string
    weather?: string
  }
  /** Event name -> sound file (relative to the theme's sounds/ dir). */
  sounds?: Record<string, string>
  /** CSS custom properties applied to :root. */
  vars?: Record<string, string>
}

export const DEFAULT_LABELS: Required<NonNullable<ThemeManifest['labels']>> = {
  address: 'Address',
  go: 'Go',
  back: 'Back',
  forward: 'Forward',
  stop: 'Stop',
  reload: 'Refresh',
  home: 'Home',
  newTab: 'New Tab',
  search: 'Search',
  favorites: 'Favorites',
  history: 'History',
  mail: 'Mail',
  print: 'Print',
  edit: 'Edit',
  netscape: 'My Netscape',
  security: 'Security',
  shop: 'Shop',
  new: 'New',
  open: 'Open',
  save: 'Save',
  copy: 'Copy',
  url: 'URL',
  hotlist: 'Hot List',
  tile: 'Tile',
  cascade: 'Cascade',
  favadd: 'Add To Favorites',
  fontup: 'Use Larger Font',
  fontdown: 'Use Smaller Font',
  cut: 'Cut',
  paste: 'Paste',
  preferences: 'Preferences',
  messenger: 'Messenger',
  help: 'Help',
  loaddisk: 'Load to Disk',
  nsedit: 'Edit',
  find: 'Find',
  images: 'Images',
  read: 'Read',
  write: 'Write',
  mailcenter: 'Mail Center',
  myfiles: 'My Files',
  myaol: 'My AOL',
  internet: 'Internet',
  channels: 'Channels',
  people: 'People',
  quotes: 'Quotes',
  perks: 'Perks',
  weather: 'Weather'
}

export const DEFAULT_TOOLBAR: ToolbarItem[] = ['back', 'forward', 'refresh', 'home']

export const DEFAULT_MENUS: string[] = ['File', 'Edit', 'View', 'Favorites', 'Tools', 'Help']
