import type { ThemeManifest, ThemeSummary } from './types'
import { sanitizeManifest } from './validate'

const CSS_LINK_ID = 'oldweb-theme-css'
const VARS_STYLE_ID = 'oldweb-theme-vars'

/** The default theme any unknown / malformed id falls back to. */
export const DEFAULT_THEME_ID = 'ie5'
/** A theme id is a single path segment used in /themes/<id>/… URLs. */
const THEME_ID_RE = /^[a-z0-9-]+$/i

/**
 * Coerce an id (which may come from localStorage or a stale manifest) into a
 * safe path segment. Anything that isn't a plain `[a-z0-9-]+` slug — including
 * "..", slashes or empty — falls back to the default theme, so it can never
 * escape the /themes/ directory.
 */
export function safeThemeId(id: string | null | undefined): string {
  return id && THEME_ID_RE.test(id) ? id : DEFAULT_THEME_ID
}

/**
 * Loads and hot-swaps themes at runtime. A theme is pure data living under
 * /themes/<id>/ : a manifest.json, a theme.css, and optional assets/sounds.
 * Nothing here knows about IE5 specifically — adding a theme means dropping a
 * new folder in, no code changes.
 */
export class ThemeEngine {
  private currentId: string | null = null
  private manifest: ThemeManifest | null = null

  async list(): Promise<ThemeSummary[]> {
    try {
      const res = await fetch('/themes/index.json')
      if (!res.ok) return []
      const data: unknown = await res.json()
      if (!Array.isArray(data)) return []
      return data
        .map((t) => (t && typeof t === 'object' ? (t as Record<string, unknown>) : null))
        .filter((t): t is Record<string, unknown> => !!t && typeof t.id === 'string')
        .map((t) => ({
          id: t.id as string,
          name: typeof t.name === 'string' ? t.name : (t.id as string),
          era: typeof t.era === 'string' ? (t.era as string) : ''
        }))
    } catch {
      return []
    }
  }

  getManifest(): ThemeManifest | null {
    return this.manifest
  }

  getId(): string | null {
    return this.currentId
  }

  async apply(id: string): Promise<ThemeManifest> {
    // Validate the id as a path segment before it ever reaches a URL.
    const safeId = safeThemeId(id)
    const base = `/themes/${safeId}`
    // Cache-buster: re-pointing a <link> to the same href serves the cached
    // stylesheet, so an edited theme.css (or re-applying the same theme) would
    // show nothing new. A per-apply token forces a fresh fetch every time.
    const bust = `?v=${Date.now()}`
    const rawManifest = await (await fetch(`${base}/manifest.json${bust}`, { cache: 'no-store' })).json()
    // Validate + sanitize: enforce required strings, restrict navigable URLs to
    // http/https, and drop any CSS-var value that could break out of :root{}.
    const manifest = sanitizeManifest(rawManifest, safeId)

    // 1. apply CSS variables from the manifest FIRST, so the swapped stylesheet
    //    (which references them) has them available immediately.
    let varsEl = document.getElementById(VARS_STYLE_ID) as HTMLStyleElement | null
    if (!varsEl) {
      varsEl = document.createElement('style')
      varsEl.id = VARS_STYLE_ID
      document.head.appendChild(varsEl)
    }
    const vars = manifest.vars ?? {}
    varsEl.textContent = `:root{${Object.entries(vars)
      .map(([k, v]) => `${k}:${v}`)
      .join(';')}}`

    // 2. swap the stylesheet. We set href and move on — the browser applies the
    //    new sheet on its own. We do NOT await onload (it does not fire reliably
    //    when re-pointing an existing <link>, which would hang the swap).
    let link = document.getElementById(CSS_LINK_ID) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = CSS_LINK_ID
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    link.href = `${base}/theme.css${bust}`

    // 3. tag the document so theme.css can scope rules and pick a cursor/font
    document.body.dataset.theme = safeId

    this.currentId = safeId
    this.manifest = manifest
    return manifest
  }

  /** Play a themed UI sound, if the current theme defines one for `event`. */
  playSound(event: string): void {
    const file = this.manifest?.sounds?.[event]
    if (!file || !this.currentId) return
    try {
      const audio = new Audio(`/themes/${this.currentId}/sounds/${file}`)
      audio.volume = 0.4
      void audio.play().catch(() => {})
    } catch {
      /* sound is best-effort */
    }
  }
}

export const themeEngine = new ThemeEngine()
