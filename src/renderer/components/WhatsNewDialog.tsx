// Bump WHATS_NEW_VERSION whenever the notes below change — App.tsx shows this
// dialog automatically once per version (tracked in localStorage), and it's also
// reachable any time from the Reframe ▸ What's New menu.
export const WHATS_NEW_VERSION = '1.15.0'

const KOFI = 'https://ko-fi.com/N4N11K1NC'

const NOTES: { title: string; body: string }[] = [
  {
    title: 'Intel Macs',
    body: 'Reframe now ships a second build for Intel Macs alongside the Apple Silicon one. The updater picks the right one for your machine on its own — nothing to choose, and your download stays the same size as before.'
  },
  {
    title: 'Colour depth no longer blanks a page',
    body: 'Switching to 256 or thousands of colours used to leave big pages — ebay.com, yahoo.com — visible for a moment and then empty. The effect now sits in a layer of its own above the page instead of being applied to the page itself, so it tints what is there without taking the page down with it.'
  },
  {
    title: 'Leaving the past',
    body: 'Delete the year from the front of the address and press Return: you are back on the live web. Until now the address bar was a one‑way door — once you were time‑travelling, typing an address kept landing you in the archive again.'
  },
  {
    title: 'About the new themes',
    body: 'Internet Explorer 5.1 and NetPositive have About pages now, like every other theme — what was rebuilt, what was measured off the original, and what is deliberately missing.'
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
