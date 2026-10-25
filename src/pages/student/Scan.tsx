import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Banner, Field, Select, Spinner, TextInput } from '@/components/ui/Primitives'
import { Scanner } from '@/components/qr/Scanner'
import { useStudentPlan } from './useStudentPlan'
import { useSettings } from '@/firebase/hooks'
import { getStore } from '@/firebase/store'
import { currentRunFor, getOneFix, submitCheckin } from '@/app/checkin'
import { parseQr, qrPayloadFor, type QrPayload } from '@/lib/verifyCheckin'
import { SCHOOL_ID } from '@/firebase/config'
import { track } from '@/evidence/track'
import { useT } from '@/i18n'

type Outcome = { kind: 'ok' | 'unverified' | 'dup' | 'error'; text: string; busNumber?: string; reason?: string }

export default function Scan() {
  const t = useT()
  const { student, campus, now, checkins, todayRuns } = useStudentPlan()
  const settings = useSettings()
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState<Outcome | null>(null)
  const [manualBus, setManualBus] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [cameraFailed, setCameraFailed] = useState(false)

  if (!campus.ready || !student) return <Spinner />

  async function handle(text: string | QrPayload) {
    if (busy || !student) return
    setBusy(true)
    track('scan_attempt')
    try {
      const qr = typeof text === 'string' ? parseQr(text) : text
      if (!qr) { setOut({ kind: 'error', text: t('That is not a ShuttleSync code. Scan the code on the shuttle screen.') }); track('scan_failed', { why: 'not_ours' }); return }
      const bus = campus.busById.get(qr.b)
      if (!bus) { setOut({ kind: 'error', text: t('We do not know that shuttle. Ask the driver which shuttle you are on.') }); track('scan_failed', { why: 'unknown_bus' }); return }
      // No timetable: the scan belongs to whatever run this shuttle is on (or about to start).
      const run = currentRunFor(bus, todayRuns)
      if (!run) { setOut({ kind: 'error', text: t('Shuttle {n} is not sharing its location right now. Try again when it is at the stop.', { n: bus.number }) }); track('scan_failed', { why: 'no_run' }); return }
      if (navigator.vibrate) navigator.vibrate(30)
      const fix = await getOneFix()
      const { result } = await submitCheckin({
        store: getStore(), student, bus, run, qr, method: 'qr', studentFix: fix, nowMs: now.nowMs, nowMin: now.minutes, existing: checkins,
        isPilot: settings.mode === 'pilot', isSimulated: settings.mode !== 'pilot',
      })
      if (result.duplicate) { setOut({ kind: 'dup', text: t.dyn(result.reason), busNumber: bus.number }); return }
      if (!result.accepted) { setOut({ kind: 'error', text: t.dyn(result.reason) }); track('scan_failed', { why: 'rejected' }); return }
      if (navigator.vibrate) navigator.vibrate(result.verified ? [40, 40, 80] : 80)
      track(result.verified ? 'scan_success' : 'scan_unverified', result.verified ? {} : { reason: result.reason })
      setOut({ kind: result.verified ? 'ok' : 'unverified', text: result.verified ? t('You are checked in') : t('Checked in, but unverified'), busNumber: bus.number, reason: result.reason })
    } finally { setBusy(false) }
  }

  async function manual(e: React.FormEvent) {
    e.preventDefault()
    const bus = campus.busById.get(manualBus)
    if (!bus) return
    // The 10-character code shown under the shuttle QR is the same token the QR carries.
    await handle({ s: SCHOOL_ID, b: bus.id, t: manualCode.trim().toLowerCase() })
  }

  async function demoScan(busId: string) {
    const bus = campus.busById.get(busId)!
    await handle(await qrPayloadFor(bus, SCHOOL_ID, Date.now(), 'rotating'))
  }

  if (out) {
    const tone = out.kind === 'ok' ? 'ok' : out.kind === 'error' ? 'bad' : 'warn'
    const colors = { ok: 'bg-ok text-[rgb(var(--brand-ink))]', warn: 'bg-warn text-[rgb(var(--brand-ink))]', bad: 'bg-bad text-[rgb(var(--brand-ink))]' }[tone]
    return (
      <div className="space-y-5" data-testid="scan-result">
        <div className={`rounded-sign p-6 ${colors}`}>
          <motion.div initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }} className="h-16 w-16 rounded-full bg-white/20 grid place-items-center">
            <Icon name={out.kind === 'ok' ? 'check-circle' : out.kind === 'error' ? 'warn' : 'help-circle'} size={40} />
          </motion.div>
          <h1 className="text-5xl font-extrabold leading-[.95] mt-4">{out.text}</h1>
          {out.busNumber && <p className="mt-1 text-lg font-bold">{t('Shuttle {n}', { n: out.busNumber })}</p>}
          {out.reason && <p className="mt-2 text-lg" data-testid="scan-reason">{t.dyn(out.reason)}</p>}
        </div>
        {out.kind === 'unverified' && <Banner tone="info" icon="shield">{t('This is not a mistake on your part. Your teacher will see you scanned and decide. You will not be marked tardy automatically.')}</Banner>}
        <div className="flex gap-3">
          <Link to="/student" className="flex-1"><Button full size="lg">{t('Back to today')}</Button></Link>
          {out.kind === 'error' && <Button variant="outline" size="lg" onClick={() => setOut(null)}>{t('Try again')}</Button>}
        </div>
      </div>
    )
  }

  const demoBuses = campus.buses.filter(b => b.isSimulated || settings.mode === 'demo')
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-5xl font-extrabold leading-[.95]">{t('Scan the shuttle code')}</h1>
        <p className="text-mute mt-2">{t('Point your camera at the code on the shuttle screen. Do it once you are on the shuttle.')}</p>
      </div>
      <Scanner onDecode={handle} paused={busy} onError={() => setCameraFailed(true)} />
      {busy && <Spinner label={t('Checking in')} />}

      <details className="bg-panel border border-line rounded-sign p-4" open={cameraFailed}>
        <summary className="font-bold cursor-pointer min-h-[44px] flex items-center">{t('Camera not working? Enter the code')}</summary>
        <form onSubmit={manual} className="space-y-3 mt-2">
          <Field label={t('Shuttle')}>
            <Select value={manualBus} onChange={e => setManualBus(e.target.value)} required data-testid="manual-bus">
              <option value="">{t('Choose a shuttle')}</option>
              {campus.buses.map(b => <option key={b.id} value={b.id}>{t('Shuttle {n}', { n: b.number })}</option>)}
            </Select>
          </Field>
          <Field label={t('Code under the QR')} hint={t('10 letters and numbers')}><TextInput value={manualCode} onChange={e => setManualCode(e.target.value)} required autoCapitalize="none" autoCorrect="off" data-testid="manual-code" /></Field>
          <Button type="submit" variant="outline" full>{t('Check in')}</Button>
        </form>
      </details>

      {demoBuses.length > 0 && settings.mode === 'demo' && (
        <details className="border border-dashed border-warn/60 rounded-sm p-4">
          <summary className="font-bold cursor-pointer min-h-[44px] flex items-center">{t('Demo shortcut: pretend to scan')}</summary>
          <p className="text-sm text-mute mb-2">{t('Only in demo mode. Uses the shuttle code directly so you can test on a laptop without a camera.')}</p>
          <div className="flex flex-wrap gap-2">
            {demoBuses.map(b => <Button key={b.id} size="sm" variant="outline" onClick={() => demoScan(b.id)} data-testid={`demo-scan-${b.id}`}>{t('Shuttle {n}', { n: b.number })}</Button>)}
          </div>
        </details>
      )}
      <p className="text-xs text-mute">{t('Your location is read once, right now, only to check you are near the shuttle.')} <Link className="underline" to="/privacy">{t('Privacy')}</Link></p>
    </div>
  )
}
