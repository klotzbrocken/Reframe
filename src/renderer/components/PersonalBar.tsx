export interface PersonalBarItem {
  label: string
  icon?: string
  url?: string
}

/**
 * The personal / bookmark toolbar — a theme-defined row of quick-link buttons
 * (Netscape's Personal Toolbar, Safari's Bookmarks Bar). Items with a `url`
 * navigate on click; the theme paints the grip, button chrome and icons.
 */
export function PersonalBar({
  items,
  onItem
}: {
  items: PersonalBarItem[]
  onItem?: (url: string) => void
}) {
  return (
    <div className="ow-personalbar">
      {items.map((it, i) => (
        <button
          key={`${it.label}-${i}`}
          className="ow-pbar-btn"
          data-icon={it.icon}
          title={it.label}
          onClick={it.url ? () => onItem?.(it.url as string) : undefined}
        >
          <span className="ow-pbar-btn__icon" aria-hidden />
          {it.label}
        </button>
      ))}
    </div>
  )
}
