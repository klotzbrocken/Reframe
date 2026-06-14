import { useState } from 'react'

/**
 * The toolbar search box (Firefox 1.0 / early-2000s style): a generic engine
 * monogram, a query field, and a magnifier. The monogram is a plain styled
 * letter — no third-party logo. Submitting runs a web search via `onSearch`.
 */
export function SearchBox({ onSearch }: { onSearch: (query: string) => void }) {
  const [q, setQ] = useState('')
  const submit = (): void => {
    if (q.trim()) onSearch(q.trim())
  }
  return (
    <form
      className="ow-searchbox"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <span className="ow-searchbox__engine" aria-hidden>
        <span className="ow-searchbox__monogram">G</span>
        <span className="ow-searchbox__caret" />
      </span>
      <input
        className="ow-searchbox__input"
        value={q}
        spellCheck={false}
        placeholder="Search Google"
        onChange={(e) => setQ(e.target.value)}
      />
      <button type="submit" className="ow-searchbox__go" title="Search" aria-label="Search">
        <span className="ow-searchbox__glass" aria-hidden />
      </button>
    </form>
  )
}
