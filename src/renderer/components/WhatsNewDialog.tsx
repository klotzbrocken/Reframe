// Bump WHATS_NEW_VERSION whenever the notes below change — App.tsx shows this
// dialog automatically once per version (tracked in localStorage), and it's also
// reachable any time from the Reframe ▸ What's New menu.
export const WHATS_NEW_VERSION = '1.8.0'

const KOFI = 'https://ko-fi.com/N4N11K1NC'

const NOTES: { title: string; body: string }[] = [
  {
    title: 'Go monochrome — the 1-bit web',
    body: 'The star of this release. A brand-new “Internet Explorer 4.5 (Mac, monochrome)” theme renders the whole browser — and every web page inside it — in authentic 1-bit black & white with ordered Bayer dithering, exactly like a classic compact Mac. And it’s not just that theme: a new “Colour depth” setting (True colour · 16-bit · 8-bit · 1-bit, with optional dithering) can crush today’s web down to thousands, 256, or two colours in ANY theme. Text stays crisp and readable thanks to a contrast-boosted 1-bit renderer, and it even works on locked-down sites like Gmail — applied before the page paints, so there’s no colour flash.'
  },
  {
    title: 'Two new Mac browsers',
    body: 'Internet Explorer 4.5 for Macintosh in full Mac OS 8.5 “Platinum” (colour and monochrome), plus Netscape 7.02 for Mac in its “Modern” skin — the Aqua traffic-light title bar, one unified toolbar with the Location field and Search sitting right next to the round metal buttons, the spinning Netscape throbber, and real tabbed browsing.'
  },
  {
    title: 'Settings & bookmarks polish',
    body: 'New Colour-depth and dithering controls; the dial-up modem widget is now on by default; connection speed, dial-up sound and volume share one tidy row. Every theme’s bookmark bar now carries the same handpicked set — including OldaVista and 68k.news, both perfect period-accurate places to browse.'
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
