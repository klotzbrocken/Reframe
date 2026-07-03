// Bump WHATS_NEW_VERSION whenever the notes below change — App.tsx shows this
// dialog automatically once per version (tracked in localStorage), and it's also
// reachable any time from the Reframe ▸ What's New menu.
export const WHATS_NEW_VERSION = '1.4.0'

const KOFI = 'https://ko-fi.com/N4N11K1NC'

const NOTES: { title: string; body: string }[] = [
  {
    title: 'New theme — Internet Explorer 3.02',
    body: 'The iconic 1997 browser on Windows 95: swirl-textured toolbar with hot-tracking icons (they light up in colour under the mouse), the original 46-frame spinning “e”, grippers, “Links »” and a three-pane status bar.'
  },
  {
    title: 'Every browser tells its story',
    body: 'Help → “About {browser}” opens a designed history page for the active theme — with the lesser-known and curious bits (the Netscape lawn prank, who really wrote IE 1.0, why a firefox isn’t a fox…).'
  },
  {
    title: 'Time Machine: months + instant travel',
    body: 'A second slider picks the month, moving either slider loads the archived page immediately, and the year range now reaches 2020. Clearing the address while time-travelling returns to today.'
  },
  {
    title: 'Netscape extras',
    body: 'The Security button opens a period-style “Security Info” dialog, and Back/Forward finally glow in colour when available.'
  },
  {
    title: 'Smaller & smarter',
    body: 'The app is ~20% smaller, the Mail button is configurable (webmail or your local mail app), Reframe can launch with a chosen theme (--theme=…), and sites behind bot protection (Cloudflare) load again.'
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
