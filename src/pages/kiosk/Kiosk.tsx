import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Banner, Logo, Sheet, Spinner, TextInput } from '@/components/ui/Primitives'
import { BuildingBadge } from '@/components/ui/BuildingBadge'
import { Icon } from '@/components/ui/Icon'
import { StatusChip } from '@/components/ui/StatusChip'
import { useCampus, useCollection, useNow, usePeople, useRules, useSettings } from '@/firebase/hooks'
import { getStore } from '@/firebase/store'
import { patchProfile, useProfile, useStaffUnlocked } from '@/app/session'
import { StaffGate } from '@/pages/auth/StaffGate'
import { activeStops, zoneLabel } from '@/lib/shuttle'
import { submitCheckin } from '@/app/checkin'
import { track } from '@/evidence/track'
import { useToast } from '@/app/Toast'
import { useT } from '@/i18n'
import type { Checkin, Run, Student } from '@/types'

/** Stop kiosk: a monitor at a stop checks in students who have no phone (or a dead one). Nobody is excluded. */
export default function Kiosk() {
  const unlocked = useStaffUnlocked()
  return unlocked ? <KioskInner /> : <StaffGate />
}

function KioskInner() {
  const t = useT()
  const toast = useToast()
  const campus = useCampus()
  const rules = useRules()
  const now = useNow(1000)
  const settings = useSettings()
  const profile = useProfile()
  const { students } = usePeople()
  const { rows: checkins } = useCollection<Checkin>('checkins')
  const [q, setQ] = useState('')
  const [picking, setPicking] = useState<Student | null>(null)

  const stops = useMemo(() => activeStops(campus.stops, rules), [campus.stops, rules])
  const stop = stops.find(s => s.id === profile.stopId)

  // The runs a student could board RIGHT NOW at this stop: a shuttle that is boarding in this stop's zone.
  const boarding = useMemo(() => {
    if (!stop) return []
    return campus.runs.filter(r => r.date === now.date && r.status === 'boarding' && r.fromZone === stop.zone)
      .map(r => ({ run: r, bus: campus.busById.get(r.busId)! })).filter(x => x.bus)
  }, [campus.runs, campus.busById, stop, now.date])

  if (!campus.ready) return <Spinner />

  if (!stop) {
    return (
      <div className="mx-auto max-w-xl p-4 space-y-4">
        <Logo />
        <h1 className="text-5xl font-extrabold leading-[.95]">{t('Which stop are you at?')}</h1>
        <div className="grid gap-3">
          {stops.map(s => (
            <button key={s.id} onClick={() => patchProfile({ role: 'kiosk', stopId: s.id })} className="flex items-center gap-3 bg-panel border border-line rounded-sign p-4 min-h-[64px] hover:border-brand text-left" data-testid={`pick-${s.id}`}>
              <BuildingBadge code={s.zone === 'main' ? 'A' : 'H'} size={40} /><span><span className="text-xl font-bold block">{s.name}</span><span className="text-sm text-mute">{t(zoneLabel(s.zone))}</span></span>
            </button>
          ))}
        </div>
        <Link to="/start" className="text-sm underline text-mute">{t('Back')}</Link>
      </div>
    )
  }

  const norm = (s: string) => s.toLowerCase()
  const list = students.filter(s => !q || norm(s.name).includes(norm(q)) || norm(s.studentNumber ?? '').includes(norm(q))).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40)

  async function checkIn(student: Student, run: Run) {
    const bus = campus.busById.get(run.busId)!
    const { result } = await submitCheckin({
      store: getStore(), student, bus, run, qr: null, method: 'kiosk', studentFix: null, nowMs: now.nowMs, nowMin: now.minutes,
      existing: checkins, by: profile.stopId, isPilot: settings.mode === 'pilot', isSimulated: student.isSimulated || settings.mode !== 'pilot',
    })
    track('kiosk_checkin')
    toast(result.duplicate ? t('{n} was already checked in', { n: student.name }) : t('{n} checked in on Shuttle {b}', { n: student.name, b: bus.number }), result.duplicate ? 'info' : 'ok')
    setPicking(null)
  }

  function tap(student: Student) {
    if (boarding.length === 1) return void checkIn(student, boarding[0].run) // one shuttle boarding: no question to ask
    setPicking(student)
  }

  const isIn = (s: Student) => boarding.some(b => checkins.some(c => c.studentId === s.id && c.runId === b.run.id))

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3"><BuildingBadge code={stop.zone === 'main' ? 'A' : 'H'} size={44} /><div><h1 className="text-4xl font-extrabold leading-none">{t('Stop kiosk')}</h1><p className="text-mute text-sm">{stop.name}</p></div></div>
        <Button variant="ghost" size="sm" onClick={() => patchProfile({ stopId: undefined })}>{t('Change stop')}</Button>
      </div>
      <Banner tone="info" icon="users">{t('Tap a student to check them in on the shuttle that is boarding. Use this for students without a phone or with a dead battery.')}</Banner>

      <div className="flex flex-wrap gap-2" aria-label={t('Boarding now')}>
        {boarding.length === 0 ? <span className="text-mute">{t('No shuttle is boarding at this stop right now.')}</span> : boarding.map(b => (
          <span key={b.run.id} className="inline-flex items-center gap-2 rounded-pill bg-[rgb(21_23_27)] text-white px-3 py-1 font-display text-xl font-bold"><Icon name="bus" size={16} />{t('Shuttle {n}', { n: b.bus.number })}<span className="text-[rgb(var(--sign))]">→ {t(zoneLabel(b.run.toZone))}</span></span>
        ))}
      </div>

      <div className="relative">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
        <TextInput className="!pl-10 !min-h-[56px] text-lg" placeholder={t('Search by name or student number')} value={q} onChange={e => setQ(e.target.value)} data-testid="kiosk-search" aria-label={t('Search students')} />
      </div>

      <ul className="grid gap-2">
        {list.map(s => (
          <li key={s.id}>
            <button disabled={!boarding.length} onClick={() => tap(s)} data-testid={`kiosk-${s.code ?? s.id}`}
              className="w-full flex items-center justify-between gap-3 bg-panel border border-line rounded-sign px-4 min-h-[64px] text-left hover:border-brand disabled:opacity-50">
              <span><span className="text-xl font-bold block">{s.name}</span><span className="text-sm text-mute">{s.studentNumber ? `#${s.studentNumber} · ` : ''}{t('Grade {g}', { g: s.grade ?? '' })}{s.isSimulated ? ` · ${t('Simulated')}` : ''}</span></span>
              {isIn(s) ? <StatusChip status="on_the_way" /> : <span className="font-bold text-brand">{t('Check in')}</span>}
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="text-mute p-4">{t('No student matches. Ask them to set up the app, or ask a teacher to mark them present.')}</li>}
      </ul>

      <Sheet open={!!picking} onClose={() => setPicking(null)} title={picking ? t('Which shuttle is {n} taking?', { n: picking.name }) : ''}>
        <div className="grid gap-2">
          {boarding.map(b => (
            <Button key={b.run.id} variant="outline" size="lg" onClick={() => picking && checkIn(picking, b.run)}>{t('Shuttle {n}', { n: b.bus.number })} → {t(zoneLabel(b.run.toZone))}</Button>
          ))}
        </div>
      </Sheet>
    </div>
  )
}
