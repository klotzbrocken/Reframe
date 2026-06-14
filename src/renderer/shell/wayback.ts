// Helpers for the "Old Web" (Wayback Machine) mode. A wayback URL looks like
//   https://web.archive.org/web/20030603203611if_/http://www.amazon.com/…
// where the digits are the snapshot timestamp and the `if_` (or im_/id_/js_…)
// modifier strips the archive's own navigation banner.

const WB_RE = /^https?:\/\/web\.archive\.org\/web\/(\d+)(?:[a-z]{2}_)?\/(.*)$/i

/** True if the URL is a Wayback Machine snapshot URL. */
export function isWayback(url: string): boolean {
  return WB_RE.test(url)
}

/** Strip the wayback wrapper, returning the original target URL (idempotent). */
export function unwrapWayback(url: string): string {
  const m = url.match(WB_RE)
  return m ? m[2] : url
}

/** Wrap any URL as a banner-free wayback snapshot at the given timestamp. */
export function wrapWayback(url: string, date: string): string {
  return `https://web.archive.org/web/${date}if_/${unwrapWayback(url)}`
}

/**
 * Friendly address-bar form of a wayback URL: `<year>://<original>` instead of
 * the long archive path. `year` is the era the user picked (the first four
 * digits of the configured wayback date), not the snapshot's own timestamp.
 * Non-wayback URLs are returned unchanged.
 */
export function waybackDisplay(url: string, year: string): string {
  const m = url.match(WB_RE)
  return m ? `${year}://${m[2]}` : url
}

/** Reverse of waybackDisplay: turn `<year>://<original>` back into `<original>`. */
export function stripWaybackDisplay(input: string): string {
  const m = input.match(/^\d{4}:\/\/(.*)$/)
  return m ? m[1] : input
}
