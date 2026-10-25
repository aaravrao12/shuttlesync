import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { useT } from '@/i18n'

/** Camera QR scanner. Falls back gracefully (parent shows manual entry) if the camera is denied or missing. */
export function Scanner({ onDecode, onError, paused }: { onDecode: (text: string) => void; onError?: (msg: string) => void; paused?: boolean }) {
  const t = useT()
  const id = useRef('qr-' + Math.random().toString(36).slice(2, 8))
  const scanner = useRef<Html5Qrcode | null>(null)
  const last = useRef('')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (paused) return
    let cancelled = false
    const s = new Html5Qrcode(id.current, { verbose: false })
    scanner.current = s
    const startP = s.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: (w, h) => { const m = Math.floor(Math.min(w, h) * 0.72); return { width: m, height: m } }, aspectRatio: 1 },
      text => { if (text !== last.current) { last.current = text; onDecode(text); setTimeout(() => { last.current = '' }, 4000) } },
      () => { /* per-frame decode misses are normal */ },
    )
    startP.catch(e => {
      if (cancelled) return
      const m = /Permission|NotAllowed/i.test(String(e)) ? t('Camera is blocked. Allow camera access in your browser, or enter the bus code below.') : t('No camera found. Enter the bus code below.')
      setMsg(m); onError?.(m)
    })
    return () => {
      cancelled = true
      // stop() THROWS if the camera never started (permission denied), so only stop after a successful start.
      startP.then(() => s.stop()).catch(() => {}).finally(() => { try { s.clear() } catch { /* ignore */ } })
    }
  }, [paused])

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-sign bg-black">
      <div id={id.current} className="absolute inset-0 [&_video]:object-cover [&_video]:h-full [&_video]:w-full" />
      {/* custom frame: four brackets instead of the library's default box */}
      <div className="pointer-events-none absolute inset-[14%]" aria-hidden>
        {['top-0 left-0 border-t-4 border-l-4', 'top-0 right-0 border-t-4 border-r-4', 'bottom-0 left-0 border-b-4 border-l-4', 'bottom-0 right-0 border-b-4 border-r-4'].map(c => (
          <span key={c} className={`absolute h-10 w-10 border-[rgb(var(--sign))] rounded-sm ${c}`} />
        ))}
      </div>
      {msg && <div className="absolute inset-0 grid place-items-center p-6 text-center text-white bg-black/80 font-medium">{msg}</div>}
    </div>
  )
}
