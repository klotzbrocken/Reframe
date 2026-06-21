import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface PanelEntry {
  title: string
  url: string
  last?: string
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
  const [pos, setPos] = useState({ left: x, top: y })

  // Keep the panel fully on-screen: if anchoring at x would overflow the right
  // (or bottom) edge, shift it back in. Measured after layout so width is known.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const left = Math.max(4, Math.min(x, window.innerWidth - w - 6))
    const top = Math.max(4, Math.min(y, window.innerHeight - h - 6))
    setPos({ left, top })
  }, [x, y, entries.length])

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  return (
    <div className="ow-panel" style={{ left: pos.left, top: pos.top }} ref={ref}>
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
