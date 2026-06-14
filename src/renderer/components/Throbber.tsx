interface Props {
  active: boolean
}

/**
 * The animated logo in the top-right corner. It is intentionally an empty,
 * theme-driven element: each theme animates `.ow-throbber.is-active` however it
 * likes (a spinning mark, marching stars, a globe…) using only CSS. No bundled
 * trademarked artwork.
 */
export function Throbber({ active }: Props) {
  return <div className={'ow-throbber' + (active ? ' is-active' : '')} aria-hidden />
}
