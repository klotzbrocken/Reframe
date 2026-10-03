// Bump WHATS_NEW_VERSION whenever the notes below change — App.tsx shows this
// dialog automatically once per version (tracked in localStorage), and it's also
// reachable any time from the Reframe ▸ What's New menu.
export const WHATS_NEW_VERSION = '1.14.0'

const KOFI = 'https://ko-fi.com/N4N11K1NC'

const NOTES: { title: string; body: string }[] = [
  {
    title: 'Internet Explorer 5.1 — the first Aqua browser',
    body: 'Mac OS X in 2000, when Aqua was brand new: a pinstriped window under the 10.0 title bar, a row of big labelled toolbar buttons, the teal “Address :” band with its ›go button, the @‑bulleted Favorites bar, and the blue “e” spinning away while a page loads.'
  },
  {
    title: 'NetPositive — BeOS R5',
    body: 'The browser from the operating system that almost was. BeOS had no title bar at all: a yellow tab sits on the window’s top edge, only as wide as the page title needs, with the close box at one end and the zoom widget at the other. Under it, one flat row holds the globe, the address field and six icons.'
  },
  {
    title: 'Aqua, rebuilt from the pixels',
    body: 'The Mac OS X 10.0 traffic lights are measured row by row off the original — black at the top of the rim, a white gloss across the top third, the colour deep beneath it and glowing back up from the foot. Safari 1.0, Netscape 7.02 and the new Internet Explorer 5.1 now share them, and the Aqua scrollbars got the same treatment: the right gel, the concave track, and an arrow at each end.'
  },
  {
    title: 'Then and now',
    body: 'While you are time‑travelling, a small button beside the modem opens a comparison: the archived page and today’s, in one frame, with a handle you drag across to wipe between them. The archived side is always labelled with the year it actually comes from.'
  },
  {
    title: 'A shorter theme list',
    body: 'The theme picker splits into Windows and Mac & misc, so the list stays half as long as the catalogue grows — with a small icon on each tab to tell them apart at a glance.'
  },
  {
    title: 'Fixes & polish',
    body: 'Closing the window on macOS and clicking the dock icon brings it back, instead of leaving the app running invisibly. The first‑run tour no longer hides behind the flyout, and Escape ends it. The flyout button is no longer clipped by themes with a short status bar. Looping sound on retro pages stays clean. And F12 opens the developer tools on the page.'
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
