import { useEffect, useRef, useState } from 'react'
import { requestChromeTop } from '../shell/chromeTop'

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
  /** IE5 "Links »" — open the Favorites panel anchored under the Links label. */
  onLinks?: () => void
  /** Netscape "What's Related" — open related sites for the current page. */
  onRelated?: () => void
  /** Opera: the middle status icon toggles page images instead of bookmarks. */
  onToggleImages?: () => void
  imagesOff?: boolean
  /** NCSA Mosaic: when set, a read-only "Document Title:" row is shown above the
   *  URL row (the theme lays them out as two lines). Undefined = single row. */
  documentTitle?: string
  /** Notifies when the recent-addresses dropdown opens/closes, so the shell can
   *  grey out the page beneath it (AOL). */
  onListVisibleChange?: (visible: boolean) => void
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
  onBookmarks,
  onLinks,
  onRelated,
  onToggleImages,
  imagesOff,
  documentTitle,
  onListVisibleChange
}: Props) {
  const [value, setValue] = useState(url)
  const [focused, setFocused] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const comboRef = useRef<HTMLDivElement>(null)
  const justSubmittedRef = useRef(false)

  // Sync from the engine only when the user isn't actively editing.
  useEffect(() => {
    // Right after a submit the input blurs, but the engine URL prop is still the
    // PREVIOUS page (navigation is async) — snapping to it here would briefly
    // flash the old address. Keep the typed value until `url` actually changes.
    if (justSubmittedRef.current) {
      justSubmittedRef.current = false
      return
    }
    if (!focused) setValue(url)
  }, [url, focused])

  // Float the chrome above the page only when the list will actually render
  // (open AND there is history) — otherwise the whole page would blank for
  // nothing the first time, before any address has been entered.
  const listVisible = listOpen && history.length > 0
  useEffect(() => {
    requestChromeTop('addrlist', listVisible)
    onListVisibleChange?.(listVisible)
    return () => {
      requestChromeTop('addrlist', false)
      onListVisibleChange?.(false)
    }
  }, [listVisible, onListVisibleChange])

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
    // Pass the (possibly empty) value through — an empty submit is meaningful
    // (it exits Old Web back to today), handled by the parent.
    justSubmittedRef.current = true
    onSubmit(value.trim())
    setListOpen(false)
    inputRef.current?.blur()
  }

  const choose = (h: string): void => {
    justSubmittedRef.current = true
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
      {/* Opera: the MIDDLE status icon toggles page images on/off. */}
      {onToggleImages ? (
        <button
          type="button"
          className={'ow-loc-proxy' + (imagesOff ? ' is-off' : '')}
          title={imagesOff ? 'Show images' : 'Hide images'}
          aria-label="Toggle images"
          onClick={onToggleImages}
        />
      ) : (
        <span className="ow-loc-proxy" aria-hidden />
      )}
      {/* NCSA Mosaic: read-only "Document Title:" line above the URL row. Only
          rendered when the theme opts in; other themes stay single-row. */}
      {documentTitle !== undefined && (
        <div className="ow-doc-titlerow">
          <span className="ow-address-label ow-address-label--doctitle">Document Title:</span>
          <div className="ow-doctitle" title={documentTitle}>
            {documentTitle}
          </div>
        </div>
      )}
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
      {/* AOL "Keyword" — submits the field as a keyword/search, same as Go.
          Hidden by default; the AOL theme shows and styles it. */}
      <button type="submit" className="ow-keyword" title="Keyword">
        Keyword
      </button>
      <button type="button" className="ow-loc-related" title="What's Related" onClick={onRelated}>
        <span className="ow-loc-related__icon" aria-hidden />
        What's Related
      </button>
      <span className="ow-loc-links" title="Links" onClick={onLinks ?? onBookmarks}>
        Links »
      </span>
    </form>
  )
}
