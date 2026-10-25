import { Panel, RollingNumber, Spinner, Banner } from '@/components/ui/Primitives'
import { SimulatedTag } from '@/components/ui/StatusChip'
import { useCampus, useCollection, useRules } from '@/firebase/hooks'
import { autoExcusedCount, delayStats, MINUTES_PER_LATE_BUS_DISPUTE, overrideCount, realOnly, scanStats, teacherMinutesSaved } from '@/lib/metrics'
import { useT } from '@/i18n'
import type { AttendanceDoc, Checkin } from '@/types'
import { useState } from 'react'
import { Toggle } from '@/components/ui/Primitives'

export default function Reports() {
  const t = useT()
  const campus = useCampus()
  const rules = useRules()
  const { rows: attendance } = useCollection<AttendanceDoc>('attendance')
  const { rows: checkins } = useCollection<Checkin>('checkins')
  const [includeSim, setIncludeSim] = useState(true)
  if (!campus.ready) return <Spinner />
  const att = includeSim ? attendance : realOnly(attendance as any) as AttendanceDoc[]
  const ck = includeSim ? checkins : realOnly(checkins)
  const runs = includeSim ? campus.runs : campus.runs.filter(r => !r.isSimulated)
  const d = delayStats(runs, rules.normalRideMin, rules.delayThresholdMin)
  const excused = autoExcusedCount(att)
  const scans = scanStats(ck)
  const byBus = campus.buses.map(b => ({ b, s: delayStats(runs.filter(x => x.busId === b.id), rules.normalRideMin, rules.delayThresholdMin) })).filter(x => x.s.n > 0).sort((a, b) => (b.s.averageDelayMin ?? 0) - (a.s.averageDelayMin ?? 0))
  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-5xl font-extrabold leading-[.95]">{t('Reports')}</h1>
      <div className="flex items-center gap-3 flex-wrap"><div className="w-72"><Toggle checked={includeSim} onChange={setIncludeSim} label={t('Include simulated data')} /></div>{includeSim && <SimulatedTag />}</div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Panel className="p-4"><div className="font-display text-6xl font-extrabold leading-none"><RollingNumber value={d.lateTrips} /></div><div className="text-mute mt-1">{t('Slow runs (of {n} finished runs)', { n: d.n })}</div></Panel>
        <Panel className="p-4"><div className="font-display text-6xl font-extrabold leading-none"><RollingNumber value={excused} /></div><div className="text-mute mt-1">{t('Tardies auto-excused')}</div></Panel>
        <Panel className="p-4"><div className="font-display text-6xl font-extrabold leading-none"><RollingNumber value={teacherMinutesSaved(excused)} /></div><div className="text-mute mt-1">{t('Teacher minutes saved (estimate)')}</div></Panel>
      </div>
      <Banner tone="info" icon="info">{t('Estimate = tardies auto-excused × {m} minutes per dispute. The {m}-minute figure is an assumption until teachers are interviewed; replace it in lib/metrics.ts.', { m: MINUTES_PER_LATE_BUS_DISPUTE })}</Banner>
      <Panel className="p-4">
        <h2 className="text-3xl font-bold mb-2">{t('Slowest shuttles')}</h2>
        {byBus.length === 0 ? <p className="text-mute">{t('No finished runs yet.')}</p> : (
          <ul className="divide-y divide-line">{byBus.map(({ b, s }) => <li key={b.id} className="py-2 flex justify-between"><span className="font-bold">{t('Shuttle {n}', { n: b.number })}</span><span className="num text-mute">{t('{m} min average ride', { m: (s.averageRideMin ?? 0).toFixed(1) })} · {s.slowRuns}/{s.n} {t('slow')}</span></li>)}</ul>
        )}
      </Panel>
      <Panel className="p-4 text-sm text-mute">{t('Scans: {a}. Verified: {b}. Teacher overrides: {c}.', { a: scans.total, b: scans.verificationRate.value != null ? `${Math.round(scans.verificationRate.value * 100)}% (n=${scans.verificationRate.n})` : '–', c: overrideCount(att) })}</Panel>
    </div>
  )
}
