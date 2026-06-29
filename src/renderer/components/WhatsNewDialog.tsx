// Bump WHATS_NEW_VERSION whenever the notes below change — App.tsx shows this
// dialog automatically once per version (tracked in localStorage), and it's also
// reachable any time from the Reframe ▸ What's New menu.
export const WHATS_NEW_VERSION = '1.3.0'

const KOFI = 'https://ko-fi.com/N4N11K1NC'

const NOTES: { title: string; body: string }[] = [
  {
    title: 'New theme — Internet Explorer 4.01 (Mac)',
    body: 'A pixel-faithful Mac OS 9 “Platinum” chrome: pinstriped title bar with the classic close / zoom / collapse boxes, a colour-icon toolbar, the spinning blue “e”, an “Internet zone” status bar — and the bundled Charcoal system font.'
  },
  {
    title: 'Redesigned controls',
    body: 'The floating hub is now a clean panel led by the Time Machine: a big year display, a slider, and a Today / Time-Travel switch, plus a compact theme dropdown and the page-load speed.'
  },
  {
    title: 'Share — “Today vs {year}”',
    body: 'Export a stacked image comparing today’s live page with the archived year, complete with the Reframe brand — one click from the controls.'
  },
  {
    title: 'Two-finger swipe',
    body: 'Swipe left/right with two fingers on the trackpad to go forward / back through history, just like a native browser.'
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
