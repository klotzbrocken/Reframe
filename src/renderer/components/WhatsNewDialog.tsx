// Bump WHATS_NEW_VERSION whenever the notes below change — App.tsx shows this
// dialog automatically once per version (tracked in localStorage), and it's also
// reachable any time from the Reframe ▸ What's New menu.
export const WHATS_NEW_VERSION = '1.5.0'

const KOFI = 'https://ko-fi.com/N4N11K1NC'

const NOTES: { title: string; body: string }[] = [
  {
    title: 'New theme — NCSA Mosaic',
    body: 'The 1993 browser that showed the world the Web: the black title bar with green caption text, silver Windows 3.1 bevel toolbar, the read-only “Document Title / Document URL” header with the spinning NCSA globe, and period-accurate menus. Its own “About NCSA Mosaic” history page included.'
  },
  {
    title: 'New theme — Internet Explorer 6.0',
    body: 'The 2001 classic in full Windows XP “Luna” dress: glossy full-colour toolbar buttons, the green Back orb, the original rippling Windows-flag throbber while pages load, and the grey Windows 3D window frame. Its own “About Internet Explorer 6.0” history page included.'
  },
  {
    title: 'Old Web understands searches again',
    body: 'Typing words (not a web address) while time-travelling now runs a real search instead of trying to archive the literal text — and switching theme/era while Old Web is on reloads the page in the new year instantly.'
  },
  {
    title: 'Leaner “Today vs {year}” sharing',
    body: 'Sharing now builds the {year} side straight from a real Wayback snapshot — no OpenAI key or AI step involved. Simpler, free, and private.'
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
