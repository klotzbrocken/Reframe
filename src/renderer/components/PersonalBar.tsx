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
  /** Present → this entry is a folder; its children open in a dropdown. */
  children?: PersonalBarItem[]
}

function readDropUrl(e: DragEvent): { url: string; title: string } | null {
  const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
  const title = e.dataTransfer.getData('application/x-reframe-title') || uri
  const url = uri
    .split('\n')
    .find((l) => l && !l.startsWith('#'))
    ?.trim()
  return url ? { url, title } : null
}

/**
 * The personal / bookmark toolbar — theme-defined quick links plus the user's
 * own bookmarks and folders. A URL dropped onto the bar is added; dropping onto
 * a folder files it inside. Right-click the empty bar to make a New Folder;
 * right-click a user bookmark/folder to rename or remove it.
 */
export function PersonalBar({
  items,
  onItem,
  onDropUrl,
  onDropIntoFolder,
  onNewFolder,
  onEdit,
  onRemove,
  onMenuToggle
}: {
  items: PersonalBarItem[]
  onItem?: (url: string) => void
  onDropUrl?: (url: string, title: string) => void
  onDropIntoFolder?: (folderId: string, url: string, title: string) => void
  onNewFolder?: () => void
  onEdit?: (id: string) => void
  onRemove?: (id: string) => void
  /** Notifies the host when a right-click menu / folder is open (to float chrome). */
  onMenuToggle?: (open: boolean) => void
}) {
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [barMenu, setBarMenu] = useState<{ x: number; y: number } | null>(null)
  const [openFolder, setOpenFolder] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [dropFolder, setDropFolder] = useState<string | null>(null)

  const anyOpen = menu !== null || barMenu !== null || openFolder !== null
  useEffect(() => onMenuToggle?.(anyOpen), [anyOpen, onMenuToggle])

  useEffect(() => {
    if (!menu && !barMenu && openFolder === null) return
    const close = (): void => {
      setMenu(null)
      setBarMenu(null)
      setOpenFolder(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu, barMenu, openFolder])

  const handleBarDrop = (e: DragEvent): void => {
    e.preventDefault()
    setDragOver(false)
    const d = readDropUrl(e)
    if (d && onDropUrl) onDropUrl(d.url, d.title)
  }

  const openCtx = (
    id: string,
    e: { clientX: number; clientY: number; preventDefault: () => void }
  ): void => {
    e.preventDefault()
    setMenu({ id, x: Math.min(e.clientX, window.innerWidth - 150), y: e.clientY })
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
      onDrop={onDropUrl ? handleBarDrop : undefined}
      onContextMenu={
        onNewFolder
          ? (e) => {
              if (e.target !== e.currentTarget) return // only the empty bar area
              e.preventDefault()
              setBarMenu({ x: Math.min(e.clientX, window.innerWidth - 150), y: e.clientY })
            }
          : undefined
      }
    >
      {items.map((it, i) => {
        const fid = it.id ?? `m${i}`
        if (it.children) {
          const isOpen = openFolder === fid
          return (
            <div className="ow-pbar-folder" key={fid}>
              <button
                className={'ow-pbar-btn ow-pbar-btn--folder' + (dropFolder === fid ? ' is-dropover' : '')}
                data-icon={it.icon}
                title={it.label}
                onMouseDown={(e) => {
                  e.stopPropagation() // don't let the document-close fire first
                  setOpenFolder((o) => (o === fid ? null : fid))
                }}
                onContextMenu={it.user && it.id ? (e) => openCtx(it.id as string, e) : undefined}
                onDragOver={
                  it.id && onDropIntoFolder
                    ? (e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'copy'
                        setDropFolder(fid)
                      }
                    : undefined
                }
                onDragLeave={() => setDropFolder((f) => (f === fid ? null : f))}
                onDrop={
                  it.id && onDropIntoFolder
                    ? (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDropFolder(null)
                        const d = readDropUrl(e)
                        if (d) onDropIntoFolder(it.id as string, d.url, d.title)
                      }
                    : undefined
                }
              >
                <span className="ow-pbar-btn__icon" aria-hidden />
                {it.label}
                <span className="ow-pbar-caret" aria-hidden />
              </button>
              {isOpen && (
                <div className="ow-pbar-dropdown" onMouseDown={(e) => e.stopPropagation()}>
                  {it.children.length === 0 && <div className="ow-pbar-empty">(empty)</div>}
                  {it.children.map((c, ci) => (
                    <button
                      key={c.id ?? `${c.label}-${ci}`}
                      className="ow-pbar-ditem"
                      title={c.label}
                      onClick={
                        c.url
                          ? () => {
                              onItem?.(c.url as string)
                              setOpenFolder(null)
                            }
                          : undefined
                      }
                      onContextMenu={c.user && c.id ? (e) => openCtx(c.id as string, e) : undefined}
                    >
                      <span
                        className="ow-pbar-ditem__icon"
                        style={c.favicon ? { backgroundImage: `url("${c.favicon}")` } : undefined}
                        aria-hidden
                      />
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        }
        return (
          <button
            key={fid}
            className="ow-pbar-btn"
            data-icon={it.icon}
            title={it.label}
            onClick={it.url ? () => onItem?.(it.url as string) : undefined}
            onContextMenu={it.user && it.id ? (e) => openCtx(it.id as string, e) : undefined}
          >
            <span
              className="ow-pbar-btn__icon"
              style={it.favicon ? { backgroundImage: `url("${it.favicon}")` } : undefined}
              aria-hidden
            />
            {it.label}
          </button>
        )
      })}

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

      {barMenu && (
        <div className="ow-ctxmenu" style={{ left: barMenu.x, top: barMenu.y }}>
          <div
            className="ow-ctxmenu__item"
            onMouseDown={(e) => {
              e.preventDefault()
              onNewFolder?.()
              setBarMenu(null)
            }}
          >
            New Folder
          </div>
        </div>
      )}
    </div>
  )
}
