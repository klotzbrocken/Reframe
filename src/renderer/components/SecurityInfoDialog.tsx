interface Props {
  /** The current page's real (unwrapped) URL. */
  url: string
  onClose: () => void
}

/**
 * Period-accurate recreation of Netscape Communicator 4.x's "Security Info"
 * dialog (the padlock/Security toolbar button). Netscape invented SSL, and this
 * panel was its front-end: it told you whether the page was encrypted, at what
 * strength, and who certified the site. We infer the state from http vs https.
 */
export function SecurityInfoDialog({ url, onClose }: Props) {
  let domain = ''
  let secure = false
  try {
    const u = new URL(url)
    domain = u.hostname
    secure = u.protocol === 'https:'
  } catch {
    /* not a normal web URL (about:blank, file:, …) — treat as unsecured */
  }

  return (
    <div className="ow-dialog-backdrop" onMouseDown={onClose}>
      <div className="ow-dialog ow-secinfo" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ow-dialog__title">Netscape — Security Info</div>
        <div className="ow-dialog__body">
          <div className="ow-secinfo__head">
            <span className={'ow-secinfo__lock' + (secure ? ' is-locked' : '')} aria-hidden>
              {secure ? '🔒' : '🔓'}
            </span>
            <div>
              <div className="ow-secinfo__status">
                {secure ? 'This page was encrypted.' : 'This page was not encrypted.'}
              </div>
              <div className="ow-secinfo__sub">
                {secure
                  ? 'This means it was difficult for other people to view this page while it was being downloaded.'
                  : 'This means it was possible for other people to view this page while it was being downloaded.'}
              </div>
            </div>
          </div>

          <table className="ow-secinfo__grid">
            <tbody>
              <tr>
                <th>Encryption</th>
                <td>{secure ? 'High-grade (TLS)' : 'None'}</td>
              </tr>
              <tr>
                <th>Web site</th>
                <td>{domain || '—'}</td>
              </tr>
              <tr>
                <th>Certificate</th>
                <td>
                  {secure
                    ? `Verified for ${domain} by the browser`
                    : 'No certificate (unsecured site)'}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="ow-secinfo__note">
            A period-style recreation of Netscape&rsquo;s SSL front-end: the padlock
            showed whether a page was encrypted — a closed lock meant secure, an open
            lock meant it was not. Today the actual connection uses modern TLS,
            verified by the underlying Chromium engine.
          </p>
        </div>
        <div className="ow-dialog__buttons">
          <button onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  )
}
