import type { ThemeManifest, ThemeSummary } from './types'

const CSS_LINK_ID = 'oldweb-theme-css'
const VARS_STYLE_ID = 'oldweb-theme-vars'

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
      return (await res.json()) as ThemeSummary[]
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
    const base = `/themes/${id}`
    const manifest = (await (await fetch(`${base}/manifest.json`)).json()) as ThemeManifest

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
    link.href = `${base}/theme.css`

    // 3. tag the document so theme.css can scope rules and pick a cursor/font
    document.body.dataset.theme = id

    this.currentId = id
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
