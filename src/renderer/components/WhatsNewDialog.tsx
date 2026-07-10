// Bump WHATS_NEW_VERSION whenever the notes below change — App.tsx shows this
// dialog automatically once per version (tracked in localStorage), and it's also
// reachable any time from the Reframe ▸ What's New menu.
export const WHATS_NEW_VERSION = '1.7.0'

const KOFI = 'https://ko-fi.com/N4N11K1NC'

const NOTES: { title: string; body: string }[] = [
  {
    title: 'New theme — Camino 2.0',
    body: 'The Mozilla community’s Mac-native browser (2009), rebuilt in full Aqua: glossy traffic-light window controls, the original toolbar icons, the “hide toolbar” pill, and — because Camino had no in-window menus — its File/View/History/Bookmarks menus live in the real macOS menu bar. Bookmark-bar folders and its own “About Camino” page are included too.'
  },
  {
    title: 'Modem dial-up emulation',
    body: 'Switch it on in Settings for the full 1990s ritual: the browser boots “not connected”, and the first page of each session waits behind an authentic dial-up handshake — pick the classic US recording, a European one, or a synthesized tone. A little modem widget with blinking PWR/CD/TX/RX LEDs sits in the status bar, and the page then crawls in at your chosen connection speed.'
  },
  {
    title: 'Bookmark-bar folders',
    body: 'Right-click the bookmarks bar to make a New Folder, then drag pages into it — folders open as a dropdown. Works in every theme that has a bookmarks bar.'
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
