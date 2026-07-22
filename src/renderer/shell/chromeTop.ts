/*
 * Single source of truth for "float the chrome above the page".
 *
 * Several independent UI pieces (menus, the Favorites/History panel, the
 * address history list, the search box, dialogs) each need the chrome raised
 * above the page WebContentsView while they're open. They used to call
 * setChromeOnTop(true/false) directly and fought each other: closing a menu
 * would drop the chrome even though a panel was still open, so popups got
 * clipped at the page boundary. This ref-counts the reasons instead — the
 * chrome stays on top as long as ANY reason is active.
 */
const active = new Set<string>()

export function requestChromeTop(reason: string, on: boolean): void {
  if (on) active.add(reason)
  else active.delete(reason)
  const floating = active.size > 0
  window.oldweb.setChromeOnTop(floating)
  // Signal to theme CSS that the chrome is floating above the page, so a theme
  // that paints an opaque layer inside the content region (the AOL MDI "child
  // window") can go transparent and let the page show through while a menu/popup
  // is open — otherwise raising the chrome would blank the page behind it.
  document.querySelector('.ow-root')?.toggleAttribute('data-chrome-top', floating)
}
