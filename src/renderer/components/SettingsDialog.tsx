import { useState } from 'react'
import { DEFAULT_ENGINE_ID, SEARCH_ENGINES } from '../shell/engines'
import { WAYBACK_MIN_YEAR, WAYBACK_MAX_YEAR } from '../shell/wayback'
import { DEFAULT_PERIOD_PROMPT } from '../../shared/period'

export type FontSize = 'normal' | 'medium' | 'large' | 'xlarge'

export interface Settings {
  home?: string
  defaultTheme?: string
  waybackYear?: number
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
  /** OpenAI API key for "Period Render" (kept locally; sent only to OpenAI). */
  openaiApiKey?: string
  /** Image quality for "Period Render". */
  periodQuality?: 'low' | 'medium' | 'high'
  /** Editable prompt template for "Period Render" ({year}/{title}/{text}). */
  periodPrompt?: string
}

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

// 0 = "off" (today); the rest is the shared Wayback range, so this dropdown and
// the floating control offer exactly the same years.
const YEARS = [
  0,
  ...Array.from({ length: WAYBACK_MAX_YEAR - WAYBACK_MIN_YEAR + 1 }, (_, i) => WAYBACK_MIN_YEAR + i)
]

export function SettingsDialog({ settings, themes, onSave, onClose, onOpenExternal }: Props) {
  const [home, setHome] = useState(settings.home || SITE)
  const [theme, setTheme] = useState(settings.defaultTheme || 'ie5')
  const [year, setYear] = useState(settings.waybackYear || 0)
  const [openaiKey, setOpenaiKey] = useState(settings.openaiApiKey || '')
  const [periodQuality, setPeriodQuality] = useState<'low' | 'medium' | 'high'>(
    settings.periodQuality || 'medium'
  )
  const [periodPrompt, setPeriodPrompt] = useState(settings.periodPrompt || DEFAULT_PERIOD_PROMPT)
  const [engine, setEngine] = useState(settings.searchEngine || DEFAULT_ENGINE_ID)
  const [splash, setSplash] = useState(settings.themeSplash !== false)
  const [menuStyle, setMenuStyle] = useState(settings.menuStyle || 'win98')
  const [menuFontSize, setMenuFontSize] = useState(settings.menuFontSize || 'normal')
  const [labelFontSize, setLabelFontSize] = useState(settings.labelFontSize || 'normal')
  const [closeAction, setCloseAction] = useState(settings.closeAction || 'quit')

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
            <label className="ow-field ow-field--wide">
              <span>Home page</span>
              <input value={home} spellCheck={false} onChange={(e) => setHome(e.target.value)} />
            </label>

            <label className="ow-field ow-field--wide">
              <span>OpenAI API key — Period Render</span>
              <input
                type="password"
                value={openaiKey}
                spellCheck={false}
                placeholder="sk-…  (stored locally; sent only to OpenAI, renders cost money)"
                onChange={(e) => setOpenaiKey(e.target.value)}
              />
            </label>

            <label className="ow-field">
              <span>Period Render quality</span>
              <select
                value={periodQuality}
                onChange={(e) => setPeriodQuality(e.target.value as 'low' | 'medium' | 'high')}
              >
                <option value="low">Low (fast, cheap)</option>
                <option value="medium">Medium</option>
                <option value="high">High (slow, best)</option>
              </select>
            </label>

            <label className="ow-field ow-field--wide">
              <span>Period Render prompt — placeholders {'{year}'} {'{title}'} {'{text}'}</span>
              <textarea
                rows={9}
                value={periodPrompt}
                spellCheck={false}
                onChange={(e) => setPeriodPrompt(e.target.value)}
              />
              <button
                type="button"
                className="ow-field__reset"
                onClick={() => setPeriodPrompt(DEFAULT_PERIOD_PROMPT)}
              >
                Reset to default prompt
              </button>
            </label>

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
            <span>Wayback year (always Sept 24)</span>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y === 0 ? 'Per theme (default)' : y}
                </option>
              ))}
            </select>
          </label>

          <label className="ow-field">
            <span>Default search engine</span>
            <select value={engine} onChange={(e) => setEngine(e.target.value)}>
              {SEARCH_ENGINES.map((en) => (
                <option key={en.id} value={en.id}>
                  {en.name}
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

          <label className="ow-field">
            <span>When closing the window</span>
            <select
              value={closeAction}
              onChange={(e) => setCloseAction(e.target.value as 'quit' | 'minimize')}
            >
              <option value="quit">Quit Reframe completely</option>
              <option value="minimize">Just minimize to the Dock</option>
            </select>
          </label>

            <label className="ow-field ow-field--check ow-field--wide">
              <input
                type="checkbox"
                checked={splash}
                onChange={(e) => setSplash(e.target.checked)}
              />
              <span>Show theme splash screens on switch</span>
            </label>
          </div>

          <p className="ow-dialog__legal">{LEGAL}</p>

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
              height={36}
              alt="Buy Me a Coffee at ko-fi.com"
            />
          </a>
        </div>
        <div className="ow-dialog__buttons">
          <button
            onClick={() => {
              onSave({
                home: home.trim() || undefined,
                defaultTheme: theme,
                waybackYear: year || undefined,
                searchEngine: engine,
                themeSplash: splash,
                menuStyle: menuStyle as 'win98' | 'luna',
                menuFontSize: menuFontSize as FontSize,
                labelFontSize: labelFontSize as FontSize,
                closeAction: closeAction as 'quit' | 'minimize',
                openaiApiKey: openaiKey.trim() || undefined,
                periodQuality,
                periodPrompt: periodPrompt.trim() || undefined
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
