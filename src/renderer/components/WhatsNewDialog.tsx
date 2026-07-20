// Bump WHATS_NEW_VERSION whenever the notes below change — App.tsx shows this
// dialog automatically once per version (tracked in localStorage), and it's also
// reachable any time from the Reframe ▸ What's New menu.
export const WHATS_NEW_VERSION = '1.10.0'

const KOFI = 'https://ko-fi.com/N4N11K1NC'

const NOTES: { title: string; body: string }[] = [
  {
    title: 'You’ve Got Mail — the AOL Desktop 4.0 theme',
    body: 'The star of this release: a pixel-faithful recreation of the 1998 AOL client wrapped around today’s web. The colourful two-row toolbar, the Keyword bar, the running-man throbber and the dial-in animation are all here — and every page floats inside a real MDI “child window” you can move, resize, minimise and maximise, just like the original. Icons that needed the real AOL service (Mail, People, Quotes…) are shown greyed out, as they’d be before you signed on.'
  },
  {
    title: 'Two flavours — Windows & Mac OS 9',
    body: 'Pick “AOL Desktop 4.0” for the classic Windows look, or “AOL Desktop 4.0 (Mac OS 9)” for the Macintosh version — same AOL shell, but with the classic Platinum title bars (close box on the left) and the menus up in the real Mac menu bar.'
  },
  {
    title: 'Channels that go somewhere',
    body: 'Click the Channels icon for the iconic channel directory, or its little ▼ for a quick drop-down — News, Sports, Travel, Shopping and more, each linking to a fitting modern site. Don’t like a destination? Right-click any channel to edit its link; your choices are remembered.'
  },
  {
    title: 'More windows, less clutter',
    body: 'With a window minimised, typing a new address opens a fresh window — several can be open at once, each as its own title-bar. The navigation arrows light up only when they’re usable, and the address bar doubles as the Keyword box. Themes are now sorted by year, and every AOL screen has its own “About” page.'
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
