/*
 * "Period Render": ask OpenAI's image model to re-render a page screenshot in
 * the visual style of a given year, while keeping the page's actual text and
 * information faithful. Runs in the main process so the user's API key never
 * reaches page content. Uses the Image *edits* endpoint (input image + prompt).
 *
 * Honesty note: image models can still garble fine text, so the result is a
 * stylized approximation — we feed the exact visible text and instruct the model
 * to preserve it verbatim to minimize drift, but it is not a source of truth.
 */

import { DEFAULT_PERIOD_PROMPT } from '../shared/period'

const ENDPOINT = 'https://api.openai.com/v1/images/edits'
const MODEL = 'gpt-image-2'

export type PeriodQuality = 'low' | 'medium' | 'high'

/**
 * gpt-image-2 accepts arbitrary sizes (both edges a multiple of 16, long:short
 * ratio ≤ 3:1, ~0.66–8.3 MP). Match the window's aspect with a ~1536px long edge
 * so the render fills the window without letterboxing.
 */
export function pickSize(width: number, height: number): string {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const landscape = w >= h
  const ratio = Math.min(3, Math.max(w, h) / Math.min(w, h))
  const round16 = (n: number): number => Math.max(16, Math.round(n / 16) * 16)
  const longEdge = 1536
  const shortEdge = round16(longEdge / ratio)
  return landscape ? `${longEdge}x${shortEdge}` : `${shortEdge}x${longEdge}`
}

/** Fill the (user-editable) template, substituting {year}/{title}/{text}. */
function buildPrompt(year: number, title: string, text: string, template?: string): string {
  const clipped = text.replace(/\s+/g, ' ').trim().slice(0, 3000)
  const tpl = template && template.trim() ? template : DEFAULT_PERIOD_PROMPT
  return tpl
    .split('{year}')
    .join(String(year))
    .split('{title}')
    .join(title)
    .split('{text}')
    .join(clipped)
}

export interface PeriodRenderInput {
  key: string
  year: number
  quality: PeriodQuality
  png: Buffer
  text: string
  title: string
  size: string
  /** Optional user-edited prompt template ({year}/{title}/{text} placeholders). */
  prompt?: string
}

/** Calls the OpenAI image-edits endpoint; resolves with the rendered PNG bytes
 *  or rejects with a human-readable error. */
export async function renderPeriodImage(input: PeriodRenderInput): Promise<Buffer> {
  const { key, year, quality, png, text, title, size, prompt } = input

  const form = new FormData()
  form.append('model', MODEL)
  form.append('prompt', buildPrompt(year, title, text, prompt))
  form.append('size', size)
  form.append('quality', quality)
  form.append('image', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'page.png')

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form
  })

  if (!res.ok) {
    let detail = ''
    try {
      const j = (await res.json()) as { error?: { message?: string } }
      detail = j.error?.message ?? ''
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail || `OpenAI request failed (HTTP ${res.status})`)
  }

  const data = (await res.json()) as { data?: { b64_json?: string }[] }
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI returned no image')
  return Buffer.from(b64, 'base64')
}
