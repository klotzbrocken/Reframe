// Bump WHATS_NEW_VERSION whenever the notes below change — App.tsx shows this
// dialog automatically once per version (tracked in localStorage), and it's also
// reachable any time from the Reframe ▸ What's New menu.
export const WHATS_NEW_VERSION = '1.13.0'

const KOFI = 'https://ko-fi.com/N4N11K1NC'

const NOTES: { title: string; body: string }[] = [
  {
    title: 'Internet Explorer 7 — the 2006 comeback',
    body: 'The browser that finally brought tabs to Explorer. Round glass Back / Forward “pearls”, a full-width address bar with the live site favicon, a dedicated Live-Search box, and the command bar on the tab row — Home, Feeds, Print, and working Page and Tools menus. Original toolbar icons throughout, plus a faithful “About Internet Explorer 7” box.'
  },
  {
    title: 'Windows Vista Aero glass',
    body: 'A new title-bar style in Settings ▸ Title bar: a translucent, blurred glass caption with the Aero bevel, glossy caption buttons and the red close. Switch it on for any Windows theme to frame the window in 2007-era glass.'
  },
  {
    title: 'A Vista scrollbar to match',
    body: 'The web view’s period scrollbars gain a Windows Vista / 7 “Aero” look — a pale, glossy blue-white gel thumb with slim chevron arrows — lighter and rounder than the XP Luna bar.'
  },
  {
    title: 'Fixes & polish',
    body: 'Tighter Vista glass (a touch less transparent, a stronger frame bevel), a solid backing so new tabs never flash through to the desktop, and a range of theme touch-ups.'
  }
]

interface Props {
  onClose: () => void
  onOpenExternal: (url: string) => void
}

export function WhatsNewDialog({ onClose, onOpenExternal }: Props) {
  return (
    <div className="ow-dialog-backdrop" onMouseDown={onClose}>
      <div className="ow-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ow-dialog__title">What’s New in Reframe {WHATS_NEW_VERSION}</div>
        <div className="ow-dialog__body">
          <ul className="ow-whatsnew">
            {NOTES.map((n) => (
              <li key={n.title}>
                <b>{n.title}</b>
                <span>{n.body}</span>
              </li>
            ))}
          </ul>

          <p className="ow-dialog__legal" style={{ marginTop: 0 }}>
            Thanks for using Reframe — a fan-made homage to the browsers we grew up with.
            If it made you smile, you can support the project:
          </p>

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
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
