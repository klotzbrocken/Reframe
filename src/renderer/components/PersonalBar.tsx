import { useEffect, useState, type DragEvent } from 'react'

export interface PersonalBarItem {
  label: string
  icon?: string
  url?: string
  /** Live favicon URL (user bookmarks captured from the page). */
  favicon?: string
  /** Stable id for user-added bookmarks (absent for theme defaults). */
  id?: string
  /** True for user-added bookmarks: right-click offers rename / remove. */
  user?: boolean
}

/**
 * The personal / bookmark toolbar — theme-defined quick links plus the user's
 * own bookmarks. A URL dropped onto the bar (e.g. the address-bar favicon) is
 * added; right-clicking a user bookmark offers rename / change-URL / remove.
 */
export function PersonalBar({
  items,
  onItem,
  onDropUrl,
  onEdit,
  onRemove,
  onMenuToggle
}: {
  items: PersonalBarItem[]
  onItem?: (url: string) => void
  onDropUrl?: (url: string, title: string) => void
  onEdit?: (id: string) => void
  onRemove?: (id: string) => void
  /** Notifies the host when the right-click menu opens/closes (to float chrome). */
  onMenuToggle?: (open: boolean) => void
}) {
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Let the host float the chrome above the page while the menu is open, so the
  // menu (which drops into the content area) isn't hidden behind the page view.
  useEffect(() => onMenuToggle?.(menu !== null), [menu, onMenuToggle])

  useEffect(() => {
    if (!menu) return
    const close = (): void => setMenu(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  const handleDrop = (e: DragEvent): void => {
    e.preventDefault()
    setDragOver(false)
    const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    const title = e.dataTransfer.getData('application/x-reframe-title') || uri
    const url = uri
      .split('\n')
      .find((l) => l && !l.startsWith('#'))
      ?.trim()
    if (url && onDropUrl) onDropUrl(url, title)
  }

  return (
    <div
      className={'ow-personalbar' + (dragOver ? ' is-dragover' : '')}
      onDragOver={(e) => {
        if (!onDropUrl) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setDragOver(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false)
      }}
      onDrop={onDropUrl ? handleDrop : undefined}
    >
      {items.map((it, i) => (
        <button
          key={it.id ?? `${it.label}-${i}`}
          className="ow-pbar-btn"
          data-icon={it.icon}
          title={it.label}
          onClick={it.url ? () => onItem?.(it.url as string) : undefined}
          onContextMenu={
            it.user && it.id
              ? (e) => {
                  e.preventDefault()
                  setMenu({
                    id: it.id as string,
                    x: Math.min(e.clientX, window.innerWidth - 150),
                    y: e.clientY
                  })
                }
              : undefined
          }
        >
          <span
            className="ow-pbar-btn__icon"
            style={it.favicon ? { backgroundImage: `url("${it.favicon}")` } : undefined}
            aria-hidden
          />
          {it.label}
        </button>
      ))}

      {menu && (
        <div className="ow-ctxmenu" style={{ left: menu.x, top: menu.y }}>
          <div
            className="ow-ctxmenu__item"
            onMouseDown={(e) => {
              e.preventDefault()
              onEdit?.(menu.id)
              setMenu(null)
            }}
          >
            Edit…
          </div>
          <div
            className="ow-ctxmenu__item"
            onMouseDown={(e) => {
              e.preventDefault()
              onRemove?.(menu.id)
              setMenu(null)
            }}
          >
            Remove
          </div>
        </div>
      )}
    </div>
  )
}
