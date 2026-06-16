import { useState } from 'react'

export interface HotListEntry {
  title: string
  url?: string
  folder?: boolean
}

/**
 * Opera 3.x "HotList" side panel: a docked window with a bookmark tree, a mini
 * toolbar, and a Title/Last list view below. Period-faithful chrome; entries
 * with a url navigate on click. Theme paints folder icons, tree lines, bevels.
 */
export function HotListPanel({
  entries,
  onNavigate,
  onClose
}: {
  entries: HotListEntry[]
  onNavigate?: (url: string) => void
  onClose?: () => void
}) {
  const [sel, setSel] = useState<number>(-1)
  const pick = (i: number, url?: string): void => {
    setSel(i)
    if (url) onNavigate?.(url)
  }

  return (
    <div className="ow-hotlist">
      <div className="ow-hotlist__title">
        <span className="ow-hotlist__name">HotList</span>
        <span className="ow-hotlist__btns">
          <button className="ow-hotlist__btn" data-c="min" title="Minimize" aria-label="Minimize" />
          <button
            className="ow-hotlist__btn"
            data-c="close"
            title="Close"
            aria-label="Close"
            onClick={onClose}
          />
        </span>
      </div>

      {/* bookmark tree */}
      <div className="ow-hotlist__tree">
        <div className="ow-hl-row ow-hl-root">
          <span className="ow-hl-icon" data-i="open" aria-hidden />
          Hot List
        </div>
        {entries.map((e, i) => (
          <div
            key={`${e.title}-${i}`}
            className={'ow-hl-row ow-hl-child' + (sel === i ? ' is-sel' : '')}
            onClick={() => pick(i, e.url)}
          >
            <span className="ow-hl-icon" data-i={e.folder ? 'folder' : 'doc'} aria-hidden />
            {e.title}
          </div>
        ))}
      </div>

      {/* mini toolbar */}
      <div className="ow-hotlist__bar">
        <button className="ow-hl-tb" title="Up">↑</button>
        <button className="ow-hl-tb" title="Add">+</button>
        <button className="ow-hl-tb ow-hl-tb--txt">File</button>
        <button className="ow-hl-tb ow-hl-tb--txt">Edit</button>
        <button className="ow-hl-tb ow-hl-tb--txt">New</button>
      </div>

      {/* list view */}
      <div className="ow-hotlist__list">
        <div className="ow-hl-head">
          <span className="ow-hl-col ow-hl-col--title">Title</span>
          <span className="ow-hl-col ow-hl-col--last">Last</span>
        </div>
        <div className="ow-hotlist__rows">
          {entries.map((e, i) => (
            <div
              key={`l-${e.title}-${i}`}
              className={'ow-hl-lrow' + (sel === i ? ' is-sel' : '')}
              onClick={() => pick(i, e.url)}
            >
              <span className="ow-hl-icon" data-i={e.folder ? 'folder' : 'doc'} aria-hidden />
              {e.title}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
