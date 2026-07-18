// Bump WHATS_NEW_VERSION whenever the notes below change — App.tsx shows this
// dialog automatically once per version (tracked in localStorage), and it's also
// reachable any time from the Reframe ▸ What's New menu.
export const WHATS_NEW_VERSION = '1.9.0'

const KOFI = 'https://ko-fi.com/N4N11K1NC'

const NOTES: { title: string; body: string }[] = [
  {
    title: 'Retro Display Engine v2 — now per site',
    body: 'The colour-depth engine grew up. Set a global look, then override any individual site: a page can stay in glorious true colour while everything else drops to 256, 16-bit or 1-bit — the choice sticks per origin and is applied before the page paints, so there’s no colour flash. There’s a new web-safe “216” mode (the classic Netscape colour cube), and you can flip depth or dithering for the current page right from the Time Machine flyout.'
  },
  {
    title: 'Classic Web Typography',
    body: 'A new, optional typography layer dresses today’s web in period clothing — era-appropriate link colours, dotted focus outlines, beveled form controls, and a classic serif body at the “Full” setting. It’s pure CSS injected safely (CSP-friendly), with an “era” option that auto-picks the right look from whichever theme you’re wearing. Choose Off, Light or Full in Settings.'
  },
  {
    title: 'A slimmer Time Machine',
    body: 'The year flyout is cleaner: the slider’s far-right stop is now “Today” (live) — drag left to travel back, and the month controls appear only when you do. The separate Today / Time-Travel buttons are gone, quick Retro-Display controls moved in, and the dial-up speed labels are shorter (Off · ISDN 64K · 56K · 28.8K).'
  },
  {
    title: 'Hardening & fixes',
    body: 'Security hardening: remote pages are now default-denied camera, mic and other sensitive permissions. Copy & paste works in the address bar again (and the Edit menu’s Cut/Copy/Paste act on the right field). The ad-block toggle now reloads every tab, per-site reduced-colour pages stay Gmail-safe, and the Archive timeline no longer pulls in stale data after you navigate away.'
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
