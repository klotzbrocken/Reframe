// Bump WHATS_NEW_VERSION whenever the notes below change — App.tsx shows this
// dialog automatically once per version (tracked in localStorage), and it's also
// reachable any time from the Reframe ▸ What's New menu.
export const WHATS_NEW_VERSION = '1.2.0'

const KOFI = 'https://ko-fi.com/N4N11K1NC'

const NOTES: { title: string; body: string }[] = [
  {
    title: 'New — Period Render (AI)',
    body: 'Add your OpenAI key in Settings, then re-imagine any modern page as a single image in the style of a chosen year — the real content is kept, only the design and pictures are aged. In the floating controls.'
  },
  {
    title: 'New theme — Netscape Communicator 6.0',
    body: 'The 2000 Mozilla-era “Modern” chrome joins the line-up, with its silver toolbar, period status bar and animated “N” throbber.'
  },
  {
    title: 'Floating quick controls',
    body: 'A subtle button centred at the bottom opens a flyout to switch theme, set the Wayback year (and time-travel there), compare today vs an archived year, and change the Time-Warp connection speed.'
  },
  {
    title: 'Editing that works + page zoom',
    body: 'Cut, Copy, Paste and Select All now act on the live page from the menus and buttons, and the Font +/− buttons zoom it.'
  },
  {
    title: 'Under the hood',
    body: 'Security hardening (URL/IPC validation, theme-id checks) and signed, notarized builds.'
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
