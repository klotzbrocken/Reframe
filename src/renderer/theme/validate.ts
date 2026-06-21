/*
 * Theme manifest validation + CSS-variable sanitizing. Bundled themes are
 * trusted today, but this is defense-in-depth and the gate for when themes
 * become importable: a manifest is data fetched as JSON and its `vars` are
 * written straight into a <style>, so an unsanitized value like
 *   --x: red} body{display:none
 * would break out of the :root{} block. We drop anything suspicious.
 */
import type { ThemeManifest } from './types'
import { isAllowedExternal } from '../../shared/url'

const VAR_KEY_RE = /^--[a-z0-9-]+$/i
// Characters/sequences that could break out of `:root{ … }` or smuggle CSS.
const VAR_BAD_RE = /[{}<>;]|url\(|expression\(|javascript:|@import/i

/** Keep only well-formed CSS custom properties with safe values. */
export function sanitizeVars(vars: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!vars || typeof vars !== 'object') return out
  for (const [k, v] of Object.entries(vars as Record<string, unknown>)) {
    if (typeof v !== 'string') continue
    if (!VAR_KEY_RE.test(k)) continue
    if (VAR_BAD_RE.test(v)) continue
    out[k] = v.trim()
  }
  return out
}

function safeUrl(u: unknown): string | undefined {
  return typeof u === 'string' && isAllowedExternal(u) ? u : undefined
}

/**
 * Coerce a fetched manifest into a safe shape: required strings enforced,
 * navigable URLs restricted to http/https, vars sanitized. Unknown extra
 * fields are passed through (they only feed the structural UI).
 */
export function sanitizeManifest(raw: unknown, fallbackId: string): ThemeManifest {
  const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const id = typeof m.id === 'string' && m.id ? m.id : fallbackId
  const name = typeof m.name === 'string' && m.name ? m.name : id

  const personalBar = Array.isArray(m.personalBar)
    ? (m.personalBar as unknown[])
        .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object')
        .map((it) => ({
          label: typeof it.label === 'string' ? it.label : '',
          icon: typeof it.icon === 'string' ? it.icon : undefined,
          url: safeUrl(it.url)
        }))
    : undefined

  return {
    ...(m as object),
    id,
    name,
    homeUrl: safeUrl(m.homeUrl),
    personalBar,
    vars: sanitizeVars(m.vars)
  } as ThemeManifest
}
