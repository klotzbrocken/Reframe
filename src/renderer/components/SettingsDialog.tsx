import { useState } from 'react'

export interface Settings {
  home?: string
  defaultTheme?: string
  waybackYear?: number
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
  'or endorsed by any of them; it exists purely as a tribute to their iconic design.'

const YEARS = [0, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2007, 2010]

export function SettingsDialog({ settings, themes, onSave, onClose, onOpenExternal }: Props) {
  const [home, setHome] = useState(settings.home || SITE)
  const [theme, setTheme] = useState(settings.defaultTheme || 'ie5')
  const [year, setYear] = useState(settings.waybackYear || 0)

  return (
    <div className="ow-dialog-backdrop" onMouseDown={onClose}>
      <div className="ow-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ow-dialog__title">Reframe — Settings</div>
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

          <label className="ow-field">
            <span>Home page</span>
            <input value={home} spellCheck={false} onChange={(e) => setHome(e.target.value)} />
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
                waybackYear: year || undefined
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
