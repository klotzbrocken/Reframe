import type { TabState } from '../../shared/types'

interface Props {
  tabs: TabState[]
  activeId: number | null
  newTabLabel: string
  onActivate: (id: number) => void
  onClose: (id: number) => void
  onNew: () => void
}

export function TabStrip({ tabs, activeId, newTabLabel, onActivate, onClose, onNew }: Props) {
  return (
    <div className="ow-tabstrip">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={'ow-tab' + (t.id === activeId ? ' is-active' : '')}
          onClick={() => onActivate(t.id)}
          title={t.title}
        >
          <span className={'ow-tab__spinner' + (t.isLoading ? ' is-active' : '')} aria-hidden />
          <span className="ow-tab__title">{t.title || 'Loading…'}</span>
          <button
            className="ow-tab__close"
            title="Close"
            onClick={(e) => {
              e.stopPropagation()
              onClose(t.id)
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button className="ow-tab-new" onClick={onNew} title={newTabLabel}>
        +
      </button>
    </div>
  )
}
