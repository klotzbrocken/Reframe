import { useEffect, useRef, useState } from 'react'
import { requestChromeTop } from '../shell/chromeTop'

/**
 * The Internet Explorer 7 command bar (Home · Feeds · Print · Page · Tools ·
 * Help), rendered at the right of the tab row. Home/Feeds/Print/Help fire a
 * single action; Page and Tools open a real dropdown menu (IE7's menu buttons).
 * While a menu is open the chrome is floated above the page view so the dropdown
 * — which extends down into the content area — isn't clipped by it.
 */
export interface Ie7CommandBarProps {
  onHome: () => void
  onFeeds: () => void
  onPrint: () => void
  onNewWindow: () => void
  onSaveAs: () => void
  onZoom: (dir: 1 | -1) => void
  onReload: () => void
  onOptions: () => void
  onHelp: () => void
}

export function Ie7CommandBar(props: Ie7CommandBarProps) {
  const [menu, setMenu] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    requestChromeTop('ie7cmd', menu !== null)
    if (!menu) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menu])

  const run = (fn: () => void): void => {
    setMenu(null)
    fn()
  }

  const dropdowns: Record<string, { label: string; on: () => void }[]> = {
    page: [
      { label: 'New Window', on: props.onNewWindow },
      { label: 'Save As…', on: props.onSaveAs },
      { label: 'Zoom In', on: () => props.onZoom(1) },
      { label: 'Zoom Out', on: () => props.onZoom(-1) }
    ],
    tools: [
      { label: 'Reload', on: props.onReload },
      { label: 'Internet Options…', on: props.onOptions }
    ]
  }

  return (
    <div className="ow-cmdbar" ref={ref}>
      <button
        type="button"
        className="ow-cmdbtn"
        data-action="home"
        title="Home"
        onClick={() => run(props.onHome)}
      >
        <span className="ow-cmdbtn__icon" aria-hidden />
        <span className="ow-cmdbtn__label">Home</span>
      </button>
      <button
        type="button"
        className="ow-cmdbtn"
        data-action="feeds"
        title="Feeds"
        onClick={() => run(props.onFeeds)}
      >
        <span className="ow-cmdbtn__icon" aria-hidden />
      </button>
      <button
        type="button"
        className="ow-cmdbtn"
        data-action="print"
        title="Print"
        onClick={() => run(props.onPrint)}
      >
        <span className="ow-cmdbtn__icon" aria-hidden />
        <span className="ow-cmdbtn__label">Print</span>
      </button>
      {(['page', 'tools'] as const).map((key) => (
        <span className="ow-cmd-wrap" key={key}>
          <button
            type="button"
            className={'ow-cmdbtn' + (menu === key ? ' is-open' : '')}
            data-action={key}
            title={key === 'page' ? 'Page' : 'Tools'}
            onClick={() => setMenu((m) => (m === key ? null : key))}
          >
            <span className="ow-cmdbtn__icon" aria-hidden />
            <span className="ow-cmdbtn__label">{key === 'page' ? 'Page' : 'Tools'}</span>
          </button>
          {menu === key && (
            <ul className="ow-cmd-menu">
              {dropdowns[key].map((it) => (
                <li
                  key={it.label}
                  className="ow-cmd-item"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    run(it.on)
                  }}
                >
                  {it.label}
                </li>
              ))}
            </ul>
          )}
        </span>
      ))}
      <button
        type="button"
        className="ow-cmdbtn"
        data-action="help"
        title="Help"
        onClick={() => run(props.onHelp)}
      >
        <span className="ow-cmdbtn__icon" aria-hidden />
      </button>
    </div>
  )
}
