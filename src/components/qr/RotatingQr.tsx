import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { Bus } from '@/types'
import { encodeQr, qrPayloadFor, TOKEN_WINDOW_MS } from '@/lib/verifyCheckin'
import { SCHOOL_ID } from '@/firebase/config'
import { clock } from '@/lib/clock'

/** The bus's QR. In 'rotating' mode the token changes every 60 s, so a screenshot is useless a couple of minutes later. */
export function BusQr({ bus, mode = 'rotating', size = 280 }: { bus: Pick<Bus, 'id' | 'qrSecret' | 'number'>; mode?: 'rotating' | 'static'; size?: number }) {
  const [src, setSrc] = useState('')
  const [text, setText] = useState('')
  const [left, setLeft] = useState(60)

  useEffect(() => {
    let alive = true
    const draw = async () => {
      // Tokens use the REAL clock (not the demo clock) so phones agree with each other no matter how the demo clock is set.
      const payload = await qrPayloadFor(bus, SCHOOL_ID, Date.now(), mode)
      const str = encodeQr(payload)
      const url = await QRCode.toDataURL(str, { margin: 1, width: size * 2, errorCorrectionLevel: 'M', color: { dark: '#15171B', light: '#FFFFFF' } })
      if (alive) { setSrc(url); setText(payload.t) }
    }
    draw()
    const id = setInterval(() => { draw(); setLeft(Math.ceil((TOKEN_WINDOW_MS - (Date.now() % TOKEN_WINDOW_MS)) / 1000)) }, 1000)
    return () => { alive = false; clearInterval(id) }
  }, [bus.id, bus.qrSecret, mode, size])

  void clock
  return (
    <figure className="inline-block text-center">
      <div className="bg-white p-3 rounded-sign inline-block">
        {src ? <img src={src} alt={`QR code for Shuttle ${bus.number}`} width={size} height={size} /> : <div style={{ width: size, height: size }} />}
      </div>
      <figcaption className="mt-2 text-sm num">
        {mode === 'rotating' ? <>Shuttle code <b className="font-mono tracking-wider" data-testid="bus-code">{text}</b> · refreshes in {left}s</> : <>Printed code · location check only</>}
      </figcaption>
    </figure>
  )
}
