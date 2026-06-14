import { useEffect, useState } from 'react'

const GITHUB = 'https://github.com/klotzbrocken/Reframe'
const KOFI = 'https://ko-fi.com/N4N11K1NC'

/** A theme's classic boot splash, shown centered for a moment on theme switch. */
export function ThemeSplash({ image }: { image: string }) {
  return (
    <div className="ow-splash-backdrop">
      <div className="ow-splash ow-splash--theme">
        <img className="ow-splash__img" src={image} alt="" />
      </div>
    </div>
  )
}

/**
 * The app's startup splash: the Reframe artwork, a legal/homage notice, links to
 * the project and Ko-fi, and a countdown that auto-continues (or the user clicks
 * through). Centered, not fullscreen.
 */
export function StartupSplash({
  seconds,
  onClose,
  onOpenExternal
}: {
  seconds: number
  onClose: () => void
  onOpenExternal: (url: string) => void
}) {
  const [left, setLeft] = useState(seconds)

  useEffect(() => {
    if (left <= 0) {
      onClose()
      return
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [left, onClose])

  return (
    <div className="ow-splash-backdrop">
      <div className="ow-splash ow-splash--startup">
        <img className="ow-splash__img" src="/splash/reframe.png" alt="Reframe" />
        <div className="ow-splash__body">
          <p className="ow-splash__notice">
            <b>Not for real use.</b> Copyright for all logos &amp; designs belongs to Microsoft,
            Apple, Netscape and other respective owners. A non-commercial fan homage.
          </p>
          <div className="ow-splash__links">
            <a
              href={GITHUB}
              onClick={(e) => {
                e.preventDefault()
                onOpenExternal(GITHUB)
              }}
            >
              GitHub ↗
            </a>
            <a
              className="ow-splash__kofi"
              href={KOFI}
              onClick={(e) => {
                e.preventDefault()
                onOpenExternal(KOFI)
              }}
            >
              <img src="https://storage.ko-fi.com/cdn/kofi2.png?v=6" height={30} alt="Buy me a coffee" />
            </a>
          </div>
          <div className="ow-splash__footer">
            <span className="ow-splash__count">Starting in {left}s…</span>
            <button onClick={onClose}>Enter now →</button>
          </div>
        </div>
      </div>
    </div>
  )
}
