/** URL of a static page in the renderer (dev server, or the app:// scheme).
 *  Shared by the window/splash loading and the per-theme "About" pages. */
export function pageUrl(file: string): string {
  const base = process.env['ELECTRON_RENDERER_URL']
  return base ? `${base}/${file}` : `app://bundle/${file}`
}
