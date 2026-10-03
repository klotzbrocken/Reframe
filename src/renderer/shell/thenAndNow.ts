/*
 * "Then and now": the live page and a real archived snapshot of the SAME page,
 * both as PNG data URLs.
 *
 * Two consumers want exactly this pair — the "Today vs {year}" share image and
 * the comparison slider — including the same awkward middle case, where the
 * archive has nothing near the year the user asked for. Rather than carry that
 * logic twice, the engine call lives here and both read the normalized result.
 *
 * The engine side (BrowserShell.shareSources) already does the hard parts: it
 * resolves a REAL snapshot through the Wayback availability API instead of
 * following the silent redirect to whatever capture exists, and it loads the
 * live original off-screen when the tab itself is currently showing the archive
 * — so "today" is always today.
 */
import type { OldwebAPI } from '../../shared/types'

/** What the engine hands back, before it is made sense of. */
type RawSources = Awaited<ReturnType<OldwebAPI['shareSources']>>

export type ThenAndNow =
  /** Both shots are in hand. `year` is the snapshot's OWN year, which is not
   *  necessarily the one that was asked for — show this one, never the wish. */
  | { kind: 'ok'; today: string; then: string; year: string }
  /** Nothing within ±1 year of the request; the archive's closest is `year`.
   *  Deliberately NOT applied on its own — the caller asks the user first. */
  | { kind: 'suggest'; year: number }
  | { kind: 'error'; message: string }

/** Pure: turn an engine reply into the three cases a caller has to handle. */
export function normalizeThenAndNow(res: RawSources, askedYear: number): ThenAndNow {
  if (res.suggestYear) {
    const year = Number(res.suggestYear)
    return Number.isFinite(year)
      ? { kind: 'suggest', year }
      : { kind: 'error', message: 'No archive snapshot found for this page.' }
  }
  if (res.error) return { kind: 'error', message: res.error }
  if (!res.today || !res.year) return { kind: 'error', message: 'Could not capture both pages.' }
  return { kind: 'ok', today: res.today, then: res.year, year: res.snapYear || String(askedYear) }
}

/** Ask the engine for both shots of `originalUrl` around `year`. */
export async function fetchThenAndNow(
  tabId: number,
  year: number,
  month: number | undefined,
  originalUrl: string
): Promise<ThenAndNow> {
  try {
    const res = await window.oldweb.shareSources(tabId, {
      source: 'wayback',
      year,
      month,
      originalUrl
    })
    return normalizeThenAndNow(res, year)
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : 'Capture failed' }
  }
}
