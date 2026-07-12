import { useState } from 'react'
import { DEFAULT_ENGINE_ID, SEARCH_ENGINES } from '../shell/engines'

// Injected at build time from package.json (see electron.vite.config.ts).
declare const __APP_VERSION__: string

export type FontSize = 'normal' | 'medium' | 'large' | 'xlarge'

export interface Settings {
  home?: string
  /** Mail toolbar button: open the local mail app (mailto:) instead of webmail. */
  mailUseLocal?: boolean
  /** Webmail URL the Mail button opens (when not using the local app). */
  mailUrl?: string
  defaultTheme?: string
  waybackYear?: number
  /** Wayback month 1–12 (paired with waybackYear by the flyout). */
  waybackMonth?: number
  searchEngine?: string
  /** Show the period boot splash when switching themes (default true). */
  themeSplash?: boolean
  /** Menu bar visual style across all themes. */
  menuStyle?: 'win98' | 'luna'
  /** Size scale for the top menus (File/Edit/…) and their dropdowns. */
  menuFontSize?: FontSize
  /** Size scale for toolbar buttons (icon + caption), bookmarks and tabs. */
  labelFontSize?: FontSize
  /** What the title-bar close button does. */
  closeAction?: 'quit' | 'minimize'
  /** "Time Warp Modem" simulated connection speed. */
  connectionSpeed?: 'full' | 'isdn' | '56k' | '28.8k'
  /** Block ads & trackers using uBlock-Origin-style filter lists (opt-in). */
  adblock?: boolean
  /** Retro colour-depth reduction applied to page content, for all themes.
   *  Default (unset/off) = full true colour. ('auto' is a legacy value.) */
  colorDepth?: 'auto' | 'off' | '16bit' | '8bit' | '1bit'
  /** Ordered dithering for the reduced-colour-depth modes (default on). */
  pageDither?: boolean
  /** Modem dial-up emulation: play a dial-up handshake before the first page
   *  of a session loads, and show the status-bar modem widget. */
  modemExtension?: boolean
  /** Dial-up volume, 0–100 (default 70). */
  modemVolume?: number
  /** Which dial-up sound to play (default the US recording). */
  modemSound?: 'us' | 'europe' | 'synth' | 'custom'
  /** Custom dial-up recording (mp3/ogg/m4a) URL, used when modemSound='custom'. */
  modemSampleUrl?: string
}

// Mirrors SPEED_OPTS in App.tsx (the connection-speed control is surfaced here
// alongside the modem toggle so speed + modem sit together).
const SPEED_OPTS: { id: NonNullable<Settings['connectionSpeed']>; label: string }[] = [
  { id: 'full', label: 'Off (full speed)' },
  { id: 'isdn', label: 'ISDN (64 kbit/s)' },
  { id: '56k', label: '56K Modem' },
  { id: '28.8k', label: '28.8 Modem' }
]

interface Props {
  settings: Settings
  themes: { id: string; name: string }[]
  onSave: (s: Settings) => void
  onClose: () => void
  onOpenExternal: (url: string) => void
}

const SITE = 'https://www.myretromac.app'
const KOFI = 'https://ko-fi.com/N4N11K1NC'
const LEGAL =
  'Reframe is a non-commercial, fan-made homage to the browsers of the late 1990s and early 2000s. ' +
  '“Netscape” and the Netscape logo, “Internet Explorer” and the Windows logo, and “Safari” and the ' +
  'Aqua look are trademarks of their respective owners — Netscape / AOL, Microsoft and Apple. ' +
  'All trademark and design rights remain with them. Reframe is not affiliated with, sponsored by, ' +
  'or endorsed by any of them; it exists purely as a tribute to their iconic design. ' +
  'The bundled “Charcoal” font (Apple’s classic Mac OS system typeface) and a pixel “MS Sans Serif” ' +
  'are used for period-accurate text; all font rights remain with their respective owners.'

export function SettingsDialog({ settings, themes, onSave, onClose, onOpenExternal }: Props) {
  const [home, setHome] = useState(settings.home || SITE)
  const [mailUseLocal, setMailUseLocal] = useState(settings.mailUseLocal ?? false)
  const [mailUrl, setMailUrl] = useState(settings.mailUrl || 'https://mail.google.com')
  const [theme, setTheme] = useState(settings.defaultTheme || 'ie5')
  const [engine, setEngine] = useState(settings.searchEngine || DEFAULT_ENGINE_ID)
  const [splash, setSplash] = useState(settings.themeSplash !== false)
  const [menuStyle, setMenuStyle] = useState(settings.menuStyle || 'win98')
  const [menuFontSize, setMenuFontSize] = useState(settings.menuFontSize || 'normal')
  const [labelFontSize, setLabelFontSize] = useState(settings.labelFontSize || 'normal')
  const [closeAction, setCloseAction] = useState(settings.closeAction || 'quit')
  const [adblock, setAdblock] = useState(settings.adblock ?? false)
  const [colorDepth, setColorDepth] = useState(
    settings.colorDepth && settings.colorDepth !== 'auto' ? settings.colorDepth : 'off'
  )
  const [pageDither, setPageDither] = useState(settings.pageDither ?? true)
  const [modemExtension, setModemExtension] = useState(settings.modemExtension !== false)
  const [connectionSpeed, setConnectionSpeed] = useState(settings.connectionSpeed || 'full')
  const [modemVolume, setModemVolume] = useState(settings.modemVolume ?? 70)
  const [modemSound, setModemSound] = useState<'us' | 'europe' | 'synth' | 'custom'>(
    settings.modemSound || (settings.modemSampleUrl ? 'custom' : 'us')
  )
  const [modemSampleUrl, setModemSampleUrl] = useState(settings.modemSampleUrl || '')

  return (
    <div className="ow-dialog-backdrop" onMouseDown={onClose}>
      <div className="ow-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ow-dialog__title">
          <span>Reframe — Settings</span>
          <button
            className="ow-dialog__close"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>
        <div className="ow-dialog__body">
          <p className="ow-dialog__about">
            <b>Reframe</b> — today’s web, yesterday’s look.{' '}
            <a
              href={SITE}
              onClick={(e) => {
                e.preventDefault()
                onOpenExternal(SITE)
              }}
            >
              www.myretromac.app
            </a>
          </p>

          <div className="ow-dialog__grid">
            <div className="ow-field-row">
              <label className="ow-field" style={{ flex: 3 }}>
                <span>Home page</span>
                <input value={home} spellCheck={false} onChange={(e) => setHome(e.target.value)} />
              </label>
              <label className="ow-field" style={{ flex: 2 }}>
                <span>Default search engine</span>
                <select value={engine} onChange={(e) => setEngine(e.target.value)}>
                  {SEARCH_ENGINES.map((en) => (
                    <option key={en.id} value={en.id}>
                      {en.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="ow-field-row">
              <label className="ow-field" style={{ flex: 2 }}>
                <span>Mail button opens</span>
                <select
                  value={mailUseLocal ? 'local' : 'web'}
                  onChange={(e) => setMailUseLocal(e.target.value === 'local')}
                >
                  <option value="web">A website (webmail)</option>
                  <option value="local">Local mail app (mailto:)</option>
                </select>
              </label>
              {!mailUseLocal ? (
                <label className="ow-field" style={{ flex: 3 }}>
                  <span>Webmail URL</span>
                  <input
                    value={mailUrl}
                    spellCheck={false}
                    placeholder="https://mail.google.com"
                    onChange={(e) => setMailUrl(e.target.value)}
                  />
                </label>
              ) : (
                <div style={{ flex: 3 }} aria-hidden />
              )}
            </div>

          <label className="ow-field">
            <span>Default theme at start</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="ow-field">
            <span>Title bar style (window controls)</span>
            <select value={menuStyle} onChange={(e) => setMenuStyle(e.target.value as 'win98' | 'luna')}>
              <option value="win98">Windows 95 / 98 (navy, square buttons)</option>
              <option value="luna">Windows XP Luna (blue, rounded buttons)</option>
            </select>
          </label>

          <label className="ow-field">
            <span>Menu text size</span>
            <select value={menuFontSize} onChange={(e) => setMenuFontSize(e.target.value as FontSize)}>
              <option value="normal">Normal</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="xlarge">Extra large</option>
            </select>
          </label>

          <label className="ow-field">
            <span>Toolbar / icon label size</span>
            <select value={labelFontSize} onChange={(e) => setLabelFontSize(e.target.value as FontSize)}>
              <option value="normal">Normal</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="xlarge">Extra large</option>
            </select>
          </label>

            <label className="ow-field ow-field--check">
              <input type="checkbox" checked={splash} onChange={(e) => setSplash(e.target.checked)} />
              <span>Show theme splash on switch</span>
            </label>

            <label className="ow-field ow-field--check">
              <input type="checkbox" checked={adblock} onChange={(e) => setAdblock(e.target.checked)} />
              <span>Block ads &amp; trackers</span>
            </label>

            <label className="ow-field">
              <span>Colour depth (web pages)</span>
              <select
                value={colorDepth}
                onChange={(e) =>
                  setColorDepth(e.target.value as 'off' | '16bit' | '8bit' | '1bit')
                }
              >
                <option value="off">Off — true colour (default)</option>
                <option value="16bit">16-bit — thousands</option>
                <option value="8bit">8-bit — 256 colours</option>
                <option value="1bit">1-bit — black &amp; white</option>
              </select>
            </label>

            <label className="ow-field ow-field--check">
              <input
                type="checkbox"
                checked={pageDither}
                onChange={(e) => setPageDither(e.target.checked)}
              />
              <span>Dither reduced colour depth (ordered/Bayer)</span>
            </label>

            <label className="ow-field ow-field--check">
              <input
                type="checkbox"
                checked={closeAction === 'minimize'}
                onChange={(e) => setCloseAction(e.target.checked ? 'minimize' : 'quit')}
              />
              <span>Minimize to Dock on close (don’t quit)</span>
            </label>

            <div className="ow-field--sep ow-field--wide">Modem-Emulation</div>

            <label className="ow-field ow-field--check ow-field--wide">
              <input
                type="checkbox"
                checked={modemExtension}
                onChange={(e) => setModemExtension(e.target.checked)}
              />
              <span>Modem dial-up emulation (sound + status-bar modem widget)</span>
            </label>

            <div className="ow-field-row">
              <label className="ow-field" style={{ flex: 1 }}>
                <span>Connection speed</span>
                <select
                  value={connectionSpeed}
                  onChange={(e) =>
                    setConnectionSpeed(e.target.value as NonNullable<Settings['connectionSpeed']>)
                  }
                >
                  {SPEED_OPTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="ow-field" style={{ flex: 1 }}>
                <span>Dial-up sound</span>
                <select
                  value={modemSound}
                  onChange={(e) =>
                    setModemSound(e.target.value as 'us' | 'europe' | 'synth' | 'custom')
                  }
                >
                  <option value="us">US — real</option>
                  <option value="europe">Europe — real</option>
                  <option value="synth">Synthesized</option>
                  <option value="custom">Custom (URL)</option>
                </select>
              </label>

              <label className="ow-field" style={{ flex: 1 }}>
                <span>Volume ({modemVolume}%)</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={modemVolume}
                  onChange={(e) => setModemVolume(Number(e.target.value))}
                />
              </label>
            </div>
            {modemSound === 'custom' && (
              <label className="ow-field ow-field--wide">
                <span>Custom dial-up recording URL (mp3/ogg/m4a)</span>
                <input
                  value={modemSampleUrl}
                  spellCheck={false}
                  placeholder="https://…/dialup.mp3"
                  onChange={(e) => setModemSampleUrl(e.target.value)}
                />
              </label>
            )}
          </div>

          <details className="ow-dialog__legal-details">
            <summary>About &amp; legal</summary>
            <p className="ow-dialog__legal">Reframe {__APP_VERSION__}</p>
            <p className="ow-dialog__legal">{LEGAL}</p>
          </details>
        </div>
        <div className="ow-dialog__buttons">
          <a
            className="ow-kofi"
            href={KOFI}
            onClick={(e) => {
              e.preventDefault()
              onOpenExternal(KOFI)
            }}
          >
            <img
              src="https://storage.ko-fi.com/cdn/kofi2.png?v=6"
              height={30}
              alt="Buy Me a Coffee at ko-fi.com"
            />
          </a>
          <button
            onClick={() => {
              onSave({
                // Spread first: settings owned by OTHER surfaces (waybackMonth,
                // connectionSpeed from the floating Time Machine, …) must
                // survive a Settings save.
                ...settings,
                home: home.trim() || undefined,
                mailUseLocal: mailUseLocal || undefined,
                mailUrl: mailUrl.trim() || undefined,
                defaultTheme: theme,
                searchEngine: engine,
                themeSplash: splash,
                menuStyle: menuStyle as 'win98' | 'luna',
                menuFontSize: menuFontSize as FontSize,
                labelFontSize: labelFontSize as FontSize,
                closeAction: closeAction as 'quit' | 'minimize',
                adblock: adblock || undefined,
                // Off is the default — persist only an explicit reduced depth.
                colorDepth: colorDepth === 'off' ? undefined : colorDepth,
                // Default-on: persist `false` only when the page dither is off.
                pageDither: pageDither ? undefined : false,
                // Default-on: persist `false` only when explicitly turned off.
                modemExtension: modemExtension ? undefined : false,
                // Save the speed exactly as chosen. (Do NOT auto-promote "full"
                // to 56k just because the modem widget is on — that silently armed
                // the dial-up gate whenever the user saved anything. The gate only
                // arms when the user explicitly picks a period speed.)
                connectionSpeed,
                modemVolume: modemVolume === 70 ? undefined : modemVolume,
                modemSound,
                modemSampleUrl:
                  modemSound === 'custom' && modemSampleUrl.trim()
                    ? modemSampleUrl.trim()
                    : undefined
              })
              onClose()
            }}
          >
            Save
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
