interface Props {
  active: boolean
}

/**
 * The animated logo in the top-right corner. It is intentionally theme-driven:
 * each theme animates `.ow-throbber.is-active` however it likes (a spinning
 * mark, a globe, an 8-dot ring…) using only CSS. The eight `.ow-throbber__dot`
 * children let dot-ring themes (Firefox 1.0) position and stagger each dot;
 * themes that don't use them leave them unstyled (zero-size, invisible). No
 * bundled trademarked artwork.
 */
export function Throbber({ active }: Props) {
  return (
    <div className={'ow-throbber' + (active ? ' is-active' : '')} aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className="ow-throbber__dot" />
      ))}
    </div>
  )
}
