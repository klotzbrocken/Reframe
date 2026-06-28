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
  'paste'
] as const

/** Toolbar entries. Known actions render as buttons; '|' is a separator. */
export type ToolbarItem = (typeof TOOLBAR_ITEMS)[number] | '|'

export interface ThemeManifest {
  id: string
  name: string
  era?: string
  /** The exact toolbar button row for this theme, in order. */
  toolbar?: ToolbarItem[]
  /** The exact menu-bar labels for this theme, in order. */
  menus?: string[]
  /** Home / Search target for this theme (era-appropriate; archived if needed). */
  homeUrl?: string
  /** Optional personal / bookmark toolbar (Netscape-style quick links). */
  personalBar?: { label: string; icon?: string; url?: string }[]
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
    /** Where the address bar sits: 'top' (default) or 'bottom' (Opera 3.x, the
     *  URL lives in the status bar at the foot of the window). */
    addressPosition?: 'top' | 'bottom'
    /** Dock a left side panel beside the page (Opera 3.x HotList). */
    sidePanel?: 'hotlist'
    /** Show a live clock at the right of the toolbar (Opera 3.x). */
    showClock?: boolean
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
  paste: 'Paste'
}

export const DEFAULT_TOOLBAR: ToolbarItem[] = ['back', 'forward', 'refresh', 'home']

export const DEFAULT_MENUS: string[] = ['File', 'Edit', 'View', 'Favorites', 'Tools', 'Help']
