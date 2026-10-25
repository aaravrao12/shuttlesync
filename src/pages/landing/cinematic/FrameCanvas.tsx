import { useEffect, useRef, type CSSProperties } from 'react'
import type { MotionValue } from 'framer-motion'

/**
 * Scroll-scrubbed film: a short cinematic clip is exported to numbered frames, preloaded, and the frame painted to a <canvas>
 * is chosen by scroll progress (scroll forward/back = play forward/back). The "3D" is the rendered clip itself.
 * Rules: paint frame 0 immediately, load the rest in the background, always draw the nearest frame that has loaded,
 * redraw only when the frame (or canvas size) changes, cap DPR at 2, pause when off-screen.
 */
export function FrameCanvas({ count, path, progress, className = '', style, onFirstFrame, onLoaded }: {
  count: number
  path: (i: number) => string
  progress: MotionValue<number>
  className?: string
  style?: CSSProperties
  onFirstFrame?: () => void
  onLoaded?: (n: number) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })!
    const imgs: (HTMLImageElement | undefined)[] = new Array(count)
    let loaded = 0, alive = true, visible = true, lastDrawn = -1, lastSize = ''

    const load = (i: number) => new Promise<void>(res => {
      const im = new Image()
      im.decoding = 'async'
      im.onload = () => { imgs[i] = im; loaded++; if (i === 0) onFirstFrame?.(); res() }
      im.onerror = () => res()
      im.src = path(i)
    })
    // frame 0 first (instant first paint), then the rest in order with a small concurrency window
    ;(async () => {
      await load(0)
      let next = 1
      const worker = async () => { while (alive && next < count) await load(next++) }
      await Promise.all([worker(), worker(), worker(), worker()])
      if (alive) onLoaded?.(loaded)
    })()

    const nearest = (idx: number) => {
      for (let d = 0; d < count; d++) {
        const a = imgs[idx - d] ?? (idx + d < count ? imgs[idx + d] : undefined)
        if (a) return { img: a, at: imgs[idx - d] ? idx - d : idx + d }
      }
      return null
    }

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0 })
    io.observe(canvas)

    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!visible) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr)
      const size = `${w}x${h}`
      if (size !== lastSize) { canvas.width = w; canvas.height = h; lastSize = size; lastDrawn = -1 }
      const idx = Math.min(count - 1, Math.max(0, Math.round(progress.get() * (count - 1))))
      const hit = nearest(idx)
      if (!hit || hit.at === lastDrawn) return
      lastDrawn = hit.at
      // cover-fit
      const s = Math.max(w / hit.img.naturalWidth, h / hit.img.naturalHeight)
      const dw = hit.img.naturalWidth * s, dh = hit.img.naturalHeight * s
      ctx.drawImage(hit.img, (w - dw) / 2, (h - dh) / 2, dw, dh)
    }
    tick()
    return () => { alive = false; cancelAnimationFrame(raf); io.disconnect() }
  }, [count, path, progress])

  return <canvas ref={ref} className={className} style={style} aria-hidden="true" />
}
