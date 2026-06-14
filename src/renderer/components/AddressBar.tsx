import { useEffect, useRef, useState } from 'react'

interface Props {
  url: string
  label: string
  goLabel: string
  history?: string[]
  /** Real page favicon URL; when set, themes that show it use it over the dummy. */
  favicon?: string | null
  /** Real page URL to use as the drag payload when dragging the favicon. */
  dragUrl?: string
  dragTitle?: string
  onSubmit: (input: string) => void
  onBookmarks?: () => void
}

export function AddressBar({
  url,
  label,
  goLabel,
  history = [],
  favicon,
  dragUrl,
  dragTitle,
  onSubmit,
  onBookmarks
}: Props) {
  const [value, setValue] = useState(url)
  const [focused, setFocused] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const comboRef = useRef<HTMLDivElement>(null)

  // Sync from the engine only when the user isn't actively editing.
  useEffect(() => {
    if (!focused) setValue(url)
  }, [url, focused])

  // Float the chrome above the page only when the list will actually render
  // (open AND there is history) — otherwise the whole page would blank for
  // nothing the first time, before any address has been entered.
  const listVisible = listOpen && history.length > 0
  useEffect(() => {
    window.oldweb.setChromeOnTop(listVisible)
  }, [listVisible])

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!listOpen) return
    const onDown = (e: MouseEvent): void => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setListOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [listOpen])

  const submit = (): void => {
    if (value.trim()) onSubmit(value.trim())
    setListOpen(false)
    inputRef.current?.blur()
  }

  const choose = (h: string): void => {
    setValue(h)
    onSubmit(h)
    setListOpen(false)
  }

  return (
    <form
      className="ow-addressbar"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {/* Netscape-style location extras; hidden by default, shown per theme. */}
      <button type="button" className="ow-loc-bookmarks" title="Bookmarks" onClick={onBookmarks}>
        <span className="ow-loc-bookmarks__icon" aria-hidden />
        Bookmarks
      </button>
      <span className="ow-loc-proxy" aria-hidden />
      <span className="ow-address-label">{label}</span>

      {/* Combobox: the address field plus a recent-addresses dropdown. */}
      <div className="ow-address-combo" ref={comboRef}>
        {/* Page favicon; hidden by default, shown per theme. Doubles as the
            drag handle for adding the current page to the bookmark bar. */}
        <span
          className="ow-address-favicon"
          draggable={!!dragUrl}
          onDragStart={
            dragUrl
              ? (e) => {
                  e.dataTransfer.setData('text/uri-list', dragUrl)
                  e.dataTransfer.setData('text/plain', dragUrl)
                  e.dataTransfer.setData('application/x-reframe-title', dragTitle ?? dragUrl)
                  e.dataTransfer.effectAllowed = 'copy'
                }
              : undefined
          }
          aria-hidden
        />
        <input
          ref={inputRef}
          className="ow-address-input"
          style={favicon ? { backgroundImage: `url("${favicon}")` } : undefined}
          value={value}
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => {
            setFocused(true)
            e.target.select()
          }}
          onBlur={() => setFocused(false)}
        />
        <button
          type="button"
          className="ow-address-dropdown"
          title="Recent addresses"
          aria-label="Recent addresses"
          onMouseDown={(e) => {
            e.preventDefault()
            setListOpen((o) => !o)
          }}
        />
        {listOpen && history.length > 0 && (
          <ul className="ow-address-list">
            {history.map((h, i) => (
              <li
                key={`${h}-${i}`}
                className="ow-address-item"
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(h)
                }}
              >
                {h}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="submit" className="ow-go" title={goLabel}>
        <span className="ow-go__icon" aria-hidden />
        {goLabel}
      </button>
      <button type="button" className="ow-loc-related" title="What's Related">
        <span className="ow-loc-related__icon" aria-hidden />
        What's Related
      </button>
      <span className="ow-loc-links">Links »</span>
    </form>
  )
}
