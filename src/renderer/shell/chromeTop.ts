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
  window.oldweb.setChromeOnTop(active.size > 0)
}
