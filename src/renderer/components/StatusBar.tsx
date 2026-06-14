interface Props {
  text: string
  loading: boolean
}

export function StatusBar({ text, loading }: Props) {
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
    </div>
  )
}
