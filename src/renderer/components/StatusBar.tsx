import type { ReactNode } from 'react'

interface Props {
  text: string
  loading: boolean
  /** Optional extra cell at the far right of the status bar (e.g. the Modem widget). */
  right?: ReactNode
}

export function StatusBar({ text, loading, right }: Props) {
  return (
    <div className="ow-statusbar">
      <span className="ow-status-text">
        {text || (loading ? 'Opening page…' : 'Done')}
      </span>
      <span className={'ow-progress' + (loading ? ' is-active' : '')} aria-hidden>
        <span className="ow-progress__bar" />
      </span>
      <span className="ow-zone" title="Security zone">
        <span className="ow-zone__lock" aria-hidden />
        Internet
      </span>
      {right}
    </div>
  )
}
