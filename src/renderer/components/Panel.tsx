import { useEffect, useRef } from 'react'

export interface PanelEntry {
  title: string
  url: string
}

interface Props {
  kind: 'bookmarks' | 'history'
  x: number
  y: number
  entries: PanelEntry[]
  onPick: (url: string) => void
  onAdd?: () => void
  onClose: () => void
}

/**
 * A dropdown panel for Favorites/Bookmarks or History. Floats at a button's
 * position; the chrome is raised (transparent) above the page while open, so
 * the page stays visible behind it. Closes on outside click.
 */
export function Panel({ kind, x, y, entries, onPick, onAdd, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  return (
    <div className="ow-panel" style={{ left: x, top: y }} ref={ref}>
      {kind === 'bookmarks' && onAdd && (
        <div
          className="ow-panel__add"
          onMouseDown={(e) => {
            e.preventDefault()
            onAdd()
          }}
        >
          ★ Add this page
        </div>
      )}
      {entries.length === 0 ? (
        <div className="ow-panel__empty">
          {kind === 'bookmarks' ? 'No favorites yet' : 'No history yet'}
        </div>
      ) : (
        entries.map((it, i) => (
          <div
            key={`${it.url}-${i}`}
            className="ow-panel__item"
            title={it.url}
            onMouseDown={(e) => {
              e.preventDefault()
              onPick(it.url)
            }}
          >
            {it.title || it.url}
          </div>
        ))
      )}
    </div>
  )
}
