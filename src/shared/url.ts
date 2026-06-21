/*
 * Pure URL helpers shared by the main process (navigation, external links) and
 * the renderer (theme validation). No Electron / DOM imports, so it is unit
 * testable and reusable everywhere. This is the single gatekeeper for what
 * schemes the browser will navigate to or hand off to the OS.
 */

/** Schemes the address bar / bookmarks may navigate to directly. */
const WEB_SCHEMES = new Set(['http', 'https'])
/** Schemes we will hand to the OS default handler (openExternal). */
const EXTERNAL_SCHEMES = new Set(['http', 'https', 'mailto'])

/** Schemes that must NEVER be navigated to from input (with or without "//"). */
const DANGEROUS_SCHEME_RE = /^(javascript|data|vbscript|blob|file|about|chrome|chrome-extension):/i
/** A "scheme://" prefix (port-less "host:port" does not match — needs the //). */
const SCHEME_SLASH_RE = /^([a-z][a-z0-9+.-]*):\/\//i

/**
 * Turn whatever the user typed into a loadable URL (or a web search).
 *
 * Hardened: an explicit scheme is only honoured for http/https. Anything else
 * (file:, javascript:, data:, about:*, chrome:, vbscript:, …) is NEVER
 * navigated to — it falls through to a web search so the input stays responsive
 * without ever triggering a dangerous scheme. Local files are opened only via
 * the native Open-File dialog, never through typed input or bookmarks.
 */
export function normalizeInput(input: string): string | null {
  const raw = (input ?? '').trim()
  if (!raw || raw === 'about:blank') return null

  // Dangerous schemes are never navigated to — fall back to a web search so the
  // input stays responsive without ever triggering file:/javascript:/data:/…
  if (DANGEROUS_SCHEME_RE.test(raw)) return search(raw)

  // An explicit "scheme://" is honoured only for http/https; anything else
  // (ftp://, smb://, …) becomes a search.
  const m = raw.match(SCHEME_SLASH_RE)
  if (m) return WEB_SCHEMES.has(m[1].toLowerCase()) ? raw : search(raw)

  // localhost (optionally with :port / path) → http
  if (raw === 'localhost' || /^localhost(:\d+)?(\/.*)?$/.test(raw)) return 'http://' + raw
  // looks like a domain (has a dot, no spaces) → assume https
  if (/^[^\s]+\.[^\s]{2,}(\/.*)?$/.test(raw)) return 'https://' + raw

  return search(raw)
}

function search(q: string): string {
  return 'https://duckduckgo.com/?q=' + encodeURIComponent(q)
}

/**
 * True only for URLs safe to hand to the OS default handler. Parsed with the
 * URL constructor (no regex bypass): http, https and mailto only.
 */
export function isAllowedExternal(url: string): boolean {
  if (typeof url !== 'string' || !url.trim()) return false
  try {
    const u = new URL(url)
    return EXTERNAL_SCHEMES.has(u.protocol.replace(/:$/, '').toLowerCase())
  } catch {
    return false
  }
}
