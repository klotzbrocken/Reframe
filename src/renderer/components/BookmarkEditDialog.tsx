import { useState } from 'react'

export interface BookmarkDraft {
  id: string
  label: string
  url: string
}

/** Rename / change-URL dialog for a user bookmark on the bookmark bar. */
export function BookmarkEditDialog({
  draft,
  onSave,
  onRemove,
  onClose
}: {
  draft: BookmarkDraft
  onSave: (b: BookmarkDraft) => void
  onRemove: (id: string) => void
  onClose: () => void
}) {
  const [label, setLabel] = useState(draft.label)
  const [url, setUrl] = useState(draft.url)

  return (
    <div className="ow-dialog-backdrop" onMouseDown={onClose}>
      <div className="ow-dialog" onMouseDown={(e) => e.stopPropagation()} style={{ width: 380 }}>
        <div className="ow-dialog__title">Edit bookmark</div>
        <div className="ow-dialog__body">
          <label className="ow-field">
            <span>Name</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
          </label>
          <label className="ow-field">
            <span>Address</span>
            <input value={url} spellCheck={false} onChange={(e) => setUrl(e.target.value)} />
          </label>
        </div>
        <div className="ow-dialog__buttons">
          <button
            style={{ marginRight: 'auto' }}
            onClick={() => {
              onRemove(draft.id)
              onClose()
            }}
          >
            Remove
          </button>
          <button
            onClick={() => {
              const u = url.trim()
              if (u) onSave({ id: draft.id, label: label.trim() || u, url: u })
              onClose()
            }}
          >
            Save
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
