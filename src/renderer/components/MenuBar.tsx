import { useEffect, useRef, useState, type ReactNode } from 'react'
import { requestChromeTop } from '../shell/chromeTop'

export type MenuItem =
  | { type: 'sep' }
  | { type: 'title'; label: string }
  | { type: 'item'; label: string; checked?: boolean; disabled?: boolean; onSelect?: () => void }

export interface Menu {
  name: string
  items: MenuItem[]
}

/**
 * The menu bar. Theme-neutral structure: themes style .ow-menubar / .ow-menu*.
 * Top items open a dropdown (period-correct menu) on mouse-down; an outside
 * click or selecting an item closes it. While one menu is open, hovering a
 * sibling switches to it — exactly like a real Win9x menu bar.
 */
export function MenuBar({ model, right }: { model: Menu[]; right?: ReactNode }) {
  const [open, setOpen] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Raise the chrome above the page whenever a menu is open, so its dropdown is
  // never clipped at the page boundary. Ref-counted so it coexists with other
  // open popups (panels, address list) instead of fighting them.
  useEffect(() => {
    requestChromeTop('menu', open !== null)
    return () => requestChromeTop('menu', false)
  }, [open])

  return (
    <div className="ow-menubar" ref={rootRef}>
      {model.map((menu) => (
        <div className={'ow-menu' + (open === menu.name ? ' is-open' : '')} key={menu.name}>
          <span
            className="ow-menu__label"
            onMouseDown={(e) => {
              e.preventDefault()
              setOpen((o) => (o === menu.name ? null : menu.name))
            }}
            onMouseEnter={() => setOpen((o) => (o !== null ? menu.name : o))}
          >
            {menu.name}
          </span>
          {open === menu.name && menu.items.length > 0 && (
            <div className="ow-menu__dropdown">
              {menu.items.map((it, i) => {
                if (it.type === 'sep') return <div key={i} className="ow-menu__sep" />
                if (it.type === 'title')
                  return (
                    <div key={i} className="ow-menu__heading">
                      {it.label}
                    </div>
                  )
                return (
                  <div
                    key={i}
                    className={
                      'ow-menu__item' +
                      (it.disabled ? ' is-disabled' : '') +
                      (it.checked ? ' is-checked' : '')
                    }
                    onMouseDown={(e) => {
                      e.preventDefault()
                      if (it.disabled) return
                      it.onSelect?.()
                      setOpen(null)
                    }}
                  >
                    <span className="ow-menu__check" aria-hidden>
                      {it.checked ? '✔' : ''}
                    </span>
                    <span className="ow-menu__text">{it.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
      {right && <div className="ow-menubar__right">{right}</div>}
    </div>
  )
}
