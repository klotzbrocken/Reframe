import { useEffect, useRef, useState } from 'react'

/**
 * Opera 3.x "Direct URL input" — a small modal where the user types an address
 * and presses Open (or Enter). Styled by the active theme via the shared
 * .ow-dialog* classes, so it matches whatever skin is active.
 */
export function UrlDialog({
  onOpen,
  onClose
}: {
  onOpen: (url: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = (): void => {
    const v = value.trim()
    if (v) onOpen(v)
    onClose()
  }

  return (
    <div className="ow-dialog-backdrop" onMouseDown={onClose}>
      <div
        className="ow-dialog ow-dialog--url"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: 420 }}
      >
        <div className="ow-dialog__title">Open URL</div>
        <form
          className="ow-dialog__body"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <label className="ow-field">
            <span>Type the address of a web page and click Open:</span>
            <input
              ref={inputRef}
              value={value}
              spellCheck={false}
              placeholder="http://"
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') onClose()
              }}
            />
          </label>
        </form>
        <div className="ow-dialog__buttons">
          <button onClick={submit}>Open</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
