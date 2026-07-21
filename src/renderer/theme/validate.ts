/*
 * Theme manifest validation + CSS-variable sanitizing. Bundled themes are
 * trusted today, but this is defense-in-depth and the gate for when themes
 * become importable: a manifest is data fetched as JSON and its `vars` are
 * written straight into a <style>, so an unsanitized value like
 *   --x: red} body{display:none
 * would break out of the :root{} block. We drop anything suspicious.
 */
import { TOOLBAR_ITEMS, type ThemeManifest } from './types'
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

const TOOLBAR_SET: ReadonlySet<string> = new Set<string>([...TOOLBAR_ITEMS, '|'])

/** Keep only known toolbar actions (+ '|'); drop the field entirely if nothing
 *  valid remains, so the UI falls back to DEFAULT_TOOLBAR instead of rendering
 *  an unknown action and crashing on navAction[item]. */
function sanitizeToolbar(v: unknown): ThemeManifest['toolbar'] | undefined {
  if (!Array.isArray(v)) return undefined
  const items = v.filter((x): x is string => typeof x === 'string' && TOOLBAR_SET.has(x))
  return items.length ? (items as ThemeManifest['toolbar']) : undefined
}

/** A non-empty array of non-empty strings, else undefined (→ defaults). */
function sanitizeStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const items = v.filter((x): x is string => typeof x === 'string' && x.length > 0)
  return items.length ? items : undefined
}

/** A flat string→string map (theme labels), else undefined. */
function sanitizeLabels(v: unknown): ThemeManifest['labels'] | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'string') out[k] = val
  }
  return Object.keys(out).length ? (out as ThemeManifest['labels']) : undefined
}

/** A plain object (layout hints), else undefined. Values feed only the
 *  structural UI, which already treats each field optionally. */
function sanitizeLayout(v: unknown): ThemeManifest['layout'] | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as ThemeManifest['layout']) : undefined
}

/**
 * Coerce a fetched manifest into a safe shape: required strings enforced,
 * navigable URLs restricted to http/https, vars sanitized, and the structural
 * fields (toolbar/menus/labels/layout) validated so a malformed manifest falls
 * back to defaults instead of crashing the UI. Other recognized extras
 * (oldWebDate, throbber, sounds, era) still pass through untouched.
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
          url: safeUrl(it.url),
          // A folder entry: keep its child links (each validated the same way).
          children: Array.isArray(it.children)
            ? (it.children as unknown[])
                .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
                .map((c) => ({
                  label: typeof c.label === 'string' ? c.label : '',
                  icon: typeof c.icon === 'string' ? c.icon : undefined,
                  url: safeUrl(c.url)
                }))
            : undefined
        }))
    : undefined

  const scrollbar =
    typeof m.scrollbar === 'string' &&
    ['sys7', 'sys7mono', 'aqua10', 'xp', 'w95'].includes(m.scrollbar)
      ? (m.scrollbar as ThemeManifest['scrollbar'])
      : undefined

  return {
    ...(m as object),
    id,
    name,
    scrollbar,
    homeUrl: safeUrl(m.homeUrl),
    toolbar: sanitizeToolbar(m.toolbar),
    menus: sanitizeStringArray(m.menus),
    labels: sanitizeLabels(m.labels),
    layout: sanitizeLayout(m.layout),
    personalBar,
    vars: sanitizeVars(m.vars)
  } as ThemeManifest
}
