import { WAYBACK_MIN_YEAR, WAYBACK_MAX_YEAR } from '../shell/wayback'

interface Props {
  /** Actual snapshot/render year shown in the title. */
  year: string
  /** Requested year (the stepper value). */
  reqYear: number
  onYear: (y: number) => void
  busy: boolean
  error: string | null
  /** Composed PNG data URL, once ready. */
  image: string | null
  /** Closest available year when the requested one has no snapshot (confirm flow). */
  suggestYear: number | null
  onUseSuggest: () => void
  onReload: () => void
  onSave: () => void
  onCopy: () => void
  onClose: () => void
}

/**
 * "Today vs {year}" share dialog. The orchestration (capture + compose) lives in
 * App; this just shows the source toggle, the composed preview and the actions.
 */
export function ShareDialog({
  year,
  reqYear,
  onYear,
  busy,
  error,
  image,
  suggestYear,
  onUseSuggest,
  onReload,
  onSave,
  onCopy,
  onClose
}: Props) {
  return (
    <div className="ow-dialog-backdrop" onMouseDown={onClose}>
      <div className="ow-dialog ow-share" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ow-dialog__title">Share · Today vs {year}</div>
        <div className="ow-dialog__body">
          <div className="ow-share__sources">
            <span className="ow-share__year">
              <button
                type="button"
                onClick={() => onYear(Math.max(WAYBACK_MIN_YEAR, reqYear - 1))}
                disabled={busy || reqYear <= WAYBACK_MIN_YEAR}
                aria-label="Earlier year"
              >
                −
              </button>
              <strong>{reqYear}</strong>
              <button
                type="button"
                onClick={() => onYear(Math.min(WAYBACK_MAX_YEAR, reqYear + 1))}
                disabled={busy || reqYear >= WAYBACK_MAX_YEAR}
                aria-label="Later year"
              >
                +
              </button>
            </span>
            <span className="ow-share__hint">Archive snapshot vs the live page</span>
          </div>
          <div className="ow-share__preview">
            {busy ? (
              <div className="ow-share__msg">Building your “Today vs {reqYear}”…</div>
            ) : suggestYear ? (
              <div className="ow-share__msg">
                No archive snapshot for {reqYear}.<br />
                Closest available is <strong>{suggestYear}</strong>.
                <div className="ow-share__confirm">
                  <button type="button" className="ow-fab__chip is-active" onClick={onUseSuggest}>
                    OK — use {suggestYear}
                  </button>
                </div>
              </div>
            ) : error ? (
              <div className="ow-share__msg ow-share__msg--err">{error}</div>
            ) : image ? (
              <img className="ow-share__img" src={image} alt={'Today vs ' + year} />
            ) : null}
          </div>
        </div>
        <div className="ow-dialog__buttons">
          <button onClick={onReload} disabled={busy}>
            Reload
          </button>
          <button onClick={onSave} disabled={!image || busy}>
            Save…
          </button>
          <button onClick={onCopy} disabled={!image || busy}>
            Copy
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
