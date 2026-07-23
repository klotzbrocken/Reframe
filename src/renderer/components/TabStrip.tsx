import type { ReactNode } from 'react'
import type { TabState } from '../../shared/types'

interface Props {
  tabs: TabState[]
  activeId: number | null
  newTabLabel: string
  onActivate: (id: number) => void
  onClose: (id: number) => void
  onNew: () => void
  /** Optional slot rendered before the tabs (IE7: the Favorites star cluster). */
  left?: ReactNode
  /** Optional slot rendered after the new-tab button, pushed to the far right
   *  (IE7: the Home / Feeds / Print / Page / Tools / Help command bar). */
  right?: ReactNode
}

export function TabStrip({
  tabs,
  activeId,
  newTabLabel,
  onActivate,
  onClose,
  onNew,
  left,
  right
}: Props) {
  return (
    <div className="ow-tabstrip">
      {left && <div className="ow-tabstrip__left">{left}</div>}
      {tabs.map((t) => (
        <div
          key={t.id}
          className={'ow-tab' + (t.id === activeId ? ' is-active' : '')}
          onClick={() => onActivate(t.id)}
          title={t.title}
        >
          <span className={'ow-tab__spinner' + (t.isLoading ? ' is-active' : '')} aria-hidden />
          {t.favicon && (
            <img className="ow-tab__favicon" src={t.favicon} alt="" aria-hidden draggable={false} />
          )}
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
      {right && <div className="ow-tabstrip__right">{right}</div>}
    </div>
  )
}
