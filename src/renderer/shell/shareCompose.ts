/*
 * Compose a "Today vs {year}" share image: the two captures STACKED vertically,
 * each scaled to FIT a 4:3 frame (no cropping) so the whole page is visible, with
 * a Reframe headline + logo on top and the URL in the footer. Runs in the renderer
 * with an offscreen canvas (no native dependency). Returns a PNG data URL.
 */

const W = 900
const SCREEN_H = Math.round((W * 3) / 4) // 4:3 per screen
const HEADER = 74
const FOOTER = 46
const GAP = 26
const HEADLINE = 'Build with Reframe, the Wayback-Browser'
const URL = 'https://myretromac.app/reframe'
const LOGO_SRC = '/splash/reframe.png'

export async function composeShare(
  todayUrl: string,
  yearUrl: string,
  year: string
): Promise<string> {
  const [today, snap, logo] = await Promise.all([
    loadImage(todayUrl),
    loadImage(yearUrl),
    loadImage(LOGO_SRC).catch(() => null)
  ])

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = HEADER + SCREEN_H + GAP + SCREEN_H + FOOTER
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  ctx.fillStyle = '#0f1216'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // ---- header: logo + headline ----
  ctx.fillStyle = '#11151b'
  ctx.fillRect(0, 0, W, HEADER)
  let textX = 18
  if (logo) {
    const lh = 46
    const lw = Math.round((logo.width / logo.height) * lh)
    ctx.drawImage(logo, 16, Math.round((HEADER - lh) / 2), lw, lh)
    textX = 16 + lw + 14
  }
  ctx.fillStyle = '#eef3fb'
  ctx.textBaseline = 'middle'
  ctx.font = '700 22px -apple-system, "Segoe UI", Tahoma, sans-serif'
  ctx.fillText(HEADLINE, textX, HEADER / 2)

  // ---- the two 4:3 screens, stacked ----
  const y1 = HEADER
  const y2 = HEADER + SCREEN_H + GAP
  drawScreen(ctx, today, 0, y1, W, SCREEN_H)
  drawScreen(ctx, snap, 0, y2, W, SCREEN_H)
  // stronger divider between the two screens
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.fillRect(0, y1 + SCREEN_H + Math.floor(GAP / 2) - 1, W, 2)
  drawTag(ctx, 'TODAY', 12, y1 + 12)
  drawTag(ctx, year, 12, y2 + 12)

  // ---- footer: URL ----
  const fy = HEADER + SCREEN_H + GAP + SCREEN_H
  ctx.fillStyle = '#11151b'
  ctx.fillRect(0, fy, W, FOOTER)
  ctx.fillStyle = '#9aa6bd'
  ctx.textAlign = 'center'
  ctx.font = '600 15px -apple-system, "Segoe UI", Tahoma, sans-serif'
  ctx.fillText(URL, W / 2, fy + FOOTER / 2)
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

/** Draw `img` scaled to FIT inside the dest box (object-fit: contain), centred,
 *  with the box filled so the un-covered area is a clean letterbox. */
function drawScreen(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dW: number,
  dH: number
): void {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(dx, dy, dW, dH)
  const r = Math.min(dW / img.width, dH / img.height)
  const w = Math.round(img.width * r)
  const h = Math.round(img.height * r)
  ctx.drawImage(img, dx + Math.round((dW - w) / 2), dy + Math.round((dH - h) / 2), w, h)
}

function drawTag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.save()
  ctx.font = '700 13px -apple-system, "Segoe UI", Tahoma, sans-serif'
  const w = ctx.measureText(text).width + 16
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(x, y, w, 24)
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + 8, y + 12)
  ctx.restore()
}
