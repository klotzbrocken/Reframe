// Bump WHATS_NEW_VERSION whenever the notes below change — App.tsx shows this
// dialog automatically once per version (tracked in localStorage), and it's also
// reachable any time from the Reframe ▸ What's New menu.
export const WHATS_NEW_VERSION = '1.12.0'

const KOFI = 'https://ko-fi.com/N4N11K1NC'

const NOTES: { title: string; body: string }[] = [
  {
    title: 'Browse like it’s 1994 — Netscape Navigator 1.1',
    body: 'Reframe’s earliest era yet: the grey Motif chrome, the text-labelled Back / Forward / Home / Reload / Images / Open / Print / Find / Stop toolbar, the “Location:” bar and the Directory buttons. In place of the trademarked “N” logo it gets an original throbber — a dark starfield that streaks with shooting-star meteors while a page loads.'
  },
  {
    title: 'Switch on the CRT',
    body: 'A new “CRT screen effect” in Settings lays scanlines, a faint RGB channel mask, a vignette and a subtle flicker over the whole window — chrome and web page alike — for that phosphor glow. Off by default; flip it on whenever you want the tube back.'
  },
  {
    title: 'Period scrollbars, per theme',
    body: 'The web view’s scrollbars now match each theme’s era instead of the modern overlay: System 7 and Mac OS 8 Platinum, Mac OS X Aqua’s blue gel, the Windows 95 raised-silver bar, Windows XP Luna, and a 1-bit black-and-white version — the chunky, always-visible bars old browsers really had.'
  },
  {
    title: 'Internet Explorer 1.0, done right',
    body: 'The IE 1.0 theme gets its original toolbar icons and the waving-flag throbber that fills its well, square raised buttons grouped by spacing (no separator lines), and the classic groove between the menu bar and the toolbar.'
  },
  {
    title: 'More ways to feel the era',
    body: 'Period wait cursors while pages load, synthesised UI sounds (clicks, chimes, error beeps) with per-theme overrides, progressive loading feedback, and two new always-on connection tiers — DSL and cable — alongside the dial-up speeds.'
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
