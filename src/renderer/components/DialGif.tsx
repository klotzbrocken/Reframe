import { useEffect, useRef } from 'react'

/**
 * A GIF player that holds back its final frame until "connected".
 *
 * The dial-up "struggle" GIF ends on a triumphant last frame — we don't want to
 * spoil it while the modem is still negotiating. So we decode every frame up
 * front (WebCodecs `ImageDecoder`) and drive playback on a canvas ourselves:
 * while `connected` is false we loop every frame EXCEPT the last one; once
 * `connected` flips true we play through to the last frame and hold it there.
 *
 * Falls back to a plain looping <img> (via the parent) if ImageDecoder is
 * unavailable — here we simply render nothing in that case.
 */
export function DialGif({
  src,
  connected,
  width,
  height
}: {
  src: string
  connected: boolean
  width: number
  height: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const connectedRef = useRef(connected)
  connectedRef.current = connected

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const Decoder = (window as unknown as { ImageDecoder?: unknown }).ImageDecoder
    if (!ctx || !Decoder) return

    let cancelled = false
    let raf = 0
    const frames: Array<{ img: CanvasImageSource & { close?: () => void }; dur: number }> = []

    const run = async (): Promise<void> => {
      try {
        const buf = await (await fetch(src)).arrayBuffer()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dec = new (Decoder as any)({ data: buf, type: 'image/gif' })
        await dec.tracks.ready
        const count: number = dec.tracks.selectedTrack.frameCount
        for (let i = 0; i < count; i++) {
          const { image } = await dec.decode({ frameIndex: i })
          frames.push({ img: image, dur: (image.duration ?? 80000) / 1000 })
        }
        if (cancelled || frames.length === 0) {
          frames.forEach((f) => f.img.close?.())
          return
        }
        const lastIndex = frames.length - 1
        let i = 0
        let last = 0
        const draw = (): void => {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(frames[i].img, 0, 0, canvas.width, canvas.height)
        }
        draw()
        const tick = (now: number): void => {
          if (cancelled) return
          if (!last) last = now
          if (now - last >= frames[i].dur) {
            last = now
            if (connectedRef.current) {
              // Connected: advance toward the final frame and stop there.
              if (i < lastIndex) {
                i++
                draw()
              }
            } else {
              // Dialing: loop everything but the last frame (keep the suspense).
              i = i + 1 >= lastIndex ? 0 : i + 1
              draw()
            }
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch {
        /* decode failed — leave the canvas blank; parent shows a fallback */
      }
    }
    void run()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      frames.forEach((f) => f.img.close?.())
    }
  }, [src])

  return <canvas ref={canvasRef} width={width} height={height} className="ow-modem-gif" />
}
