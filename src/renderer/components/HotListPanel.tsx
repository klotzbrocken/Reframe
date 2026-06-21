import { useState, type ReactNode } from 'react'

export interface HotListEntry {
  title: string
  url?: string
  folder?: boolean
  /** "Last visited" date shown in the list view's Last column. */
  last?: string
  /** Child entries — a folder with children gets a [+]/[−] expander. */
  children?: HotListEntry[]
}

const Expander = ({ open, onClick }: { open: boolean; onClick: () => void }) => (
  <span
    className="ow-hl-exp"
    onClick={(e) => {
      e.stopPropagation()
      onClick()
    }}
  >
    {open ? '−' : '+'}
  </span>
)

/**
 * Opera 3.x "HotList" side panel: a docked window with a bookmark tree (with
 * [+]/[−] expanders), a mini toolbar, and a Title/Last list view below. Entries
 * with a url navigate on click; the theme paints folder icons and tree lines.
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
  const [selKey, setSelKey] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const pick = (key: string, url?: string): void => {
    setSelKey(key)
    if (url) onNavigate?.(url)
  }

  // Render the tree recursively; folders with children toggle on the expander.
  const renderTree = (items: HotListEntry[], depth: number, prefix: string): ReactNode =>
    items.map((e, i) => {
      const key = `${prefix}/${i}`
      const kids = e.children ?? []
      const isOpen = open[key]
      return (
        <div key={key}>
          <div
            className={'ow-hl-row' + (selKey === key ? ' is-sel' : '')}
            style={{ paddingLeft: 4 + depth * 14 }}
            onClick={() => pick(key, e.url)}
          >
            <span className="ow-hl-exp-slot">
              {kids.length > 0 && (
                <Expander open={!!isOpen} onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))} />
              )}
            </span>
            <span
              className="ow-hl-icon"
              data-i={depth === 0 ? 'open' : e.folder || kids.length ? 'folder' : 'doc'}
              aria-hidden
            />
            {e.title}
          </div>
          {kids.length > 0 && isOpen && renderTree(kids, depth + 1, key)}
        </div>
      )
    })

  // The list view shows the top-level entries flat (Title / Last columns).
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

      <div className="ow-hotlist__tree">{renderTree(entries, 0, 'r')}</div>

      <div className="ow-hotlist__bar">
        <button className="ow-hl-tb" title="Up">↑</button>
        <button className="ow-hl-tb" title="Add">+</button>
        <button className="ow-hl-tb ow-hl-tb--txt">File</button>
        <button className="ow-hl-tb ow-hl-tb--txt">Edit</button>
        <button className="ow-hl-tb ow-hl-tb--txt">New</button>
      </div>

      <div className="ow-hotlist__list">
        <div className="ow-hl-head">
          <span className="ow-hl-col ow-hl-col--title">Title</span>
          <span className="ow-hl-col ow-hl-col--last">Last</span>
        </div>
        <div className="ow-hotlist__rows">
          {entries.map((e, i) => (
            <div
              key={`l-${i}`}
              className={'ow-hl-lrow' + (selKey === `list/${i}` ? ' is-sel' : '')}
              onClick={() => pick(`list/${i}`, e.url)}
            >
              <span className="ow-hl-icon" data-i={e.folder ? 'folder' : 'doc'} aria-hidden />
              <span className="ow-hl-ltitle">{e.title}</span>
              <span className="ow-hl-llast">{e.last ?? ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
