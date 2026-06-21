import { useEffect, useRef, useState } from 'react'
import { engineById, SEARCH_ENGINES } from '../shell/engines'
import { requestChromeTop } from '../shell/chromeTop'

/**
 * The toolbar search box (Firefox 1.0 / early-2000s style): a clickable engine
 * monogram that opens a real engine picker, and a query field. Submitting (Enter)
 * runs the search on the selected engine. The engine choice is the app's default
 * search engine, persisted by the parent. No magnifier button — period-accurate.
 */
export function SearchBox({
  engineId,
  onEngineChange,
  onSearch
}: {
  engineId: string
  onEngineChange: (id: string) => void
  onSearch: (url: string) => void
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLFormElement>(null)
  const engine = engineById(engineId)

  // Float the chrome above the page while the picker is open, so it isn't
  // clipped by the page view; close on an outside click.
  useEffect(() => {
    requestChromeTop('search', open)
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const submit = (): void => {
    if (q.trim()) onSearch(engine.search(q.trim()))
  }

  return (
    <form
      className="ow-searchbox"
      ref={rootRef}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <button
        type="button"
        className="ow-searchbox__engine"
        title={`Search engine: ${engine.name}`}
        onMouseDown={(e) => {
          e.preventDefault()
          setOpen((o) => !o)
        }}
      >
        <span
          className="ow-searchbox__monogram"
          style={{ background: engine.color }}
          aria-hidden
        >
          {engine.letter}
        </span>
        <span className="ow-searchbox__caret" aria-hidden />
      </button>

      <input
        className="ow-searchbox__input"
        value={q}
        spellCheck={false}
        placeholder={`Search ${engine.name}`}
        onChange={(e) => setQ(e.target.value)}
      />

      {open && (
        <ul className="ow-searchbox__menu">
          {SEARCH_ENGINES.map((en) => (
            <li
              key={en.id}
              className={'ow-searchbox__option' + (en.id === engine.id ? ' is-active' : '')}
              onMouseDown={(e) => {
                e.preventDefault()
                onEngineChange(en.id)
                setOpen(false)
              }}
            >
              <span className="ow-searchbox__monogram" style={{ background: en.color }} aria-hidden>
                {en.letter}
              </span>
              <span>{en.name}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
