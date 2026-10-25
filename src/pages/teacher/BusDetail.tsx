import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EmptyState, Panel, Spinner } from '@/components/ui/Primitives'
import { Pill, SimulatedTag } from '@/components/ui/StatusChip'
import { MapView } from '@/components/map/MapView'
import { useCampus, useCollection, useNow, usePeople, useRules } from '@/firebase/hooks'
import { fmtClock } from '@/lib/time'
import { delayStats } from '@/lib/metrics'
import { zoneLabel } from '@/lib/shuttle'
import { useT } from '@/i18n'
import type { Checkin, Student } from '@/types'

/** One shuttle: where it is now, how its runs went today, and who rode. */
export default function BusDetail() {
  const t = useT()
  const { busId } = useParams()
  const campus = useCampus()
  const rules = useRules()
  const now = useNow(1000)
  const { students } = usePeople()
  const { rows: checkins } = useCollection<Checkin>('checkins')
  if (!campus.ready) return <Spinner />
  const bus = campus.busById.get(busId ?? '')
  if (!bus) return <EmptyState icon="bus" title={t('Shuttle not found')} action={<Link to="/teacher"><Button variant="outline">{t('Back to dashboard')}</Button></Link>} />
  const runs = campus.runs.filter(x => x.busId === bus.id && x.date === now.date).sort((a, b) => b.boardingAt - a.boardingAt)
  const stats = delayStats(runs, rules.normalRideMin, rules.delayThresholdMin)
  const aboard = (runId: string) => checkins.filter(c => c.runId === runId).map(c => students.find(s => s.id === c.studentId)).filter(Boolean) as Student[]
  const stopName = (id: string) => campus.stopById.get(id)?.name ?? id
  return (
    <div className="max-w-4xl space-y-5">
      <Link to="/teacher" className="text-sm underline text-mute">{t('Back to dashboard')}</Link>
      <div className="flex items-center gap-3 flex-wrap"><h1 className="text-5xl font-extrabold leading-[.95]">{t('Shuttle {n}', { n: bus.number })}</h1>{bus.isSimulated && <SimulatedTag />}<Pill tone={bus.status === 'delayed' ? 'warn' : bus.status === 'idle' ? 'mute' : 'info'}>{bus.status.replace('_', ' ')}</Pill></div>
      <MapView buildings={campus.buildings} stops={campus.stops} buses={[bus]} rainActive={rules.rainStopActive} highlightBusId={bus.id} height={300} />
      <div className="grid grid-cols-3 gap-3 text-center">
        <Panel className="p-3"><div className="font-display text-5xl font-extrabold num">{stats.averageRideMin != null ? stats.averageRideMin.toFixed(1) : '–'}</div><div className="text-sm text-mute">{t('Average ride (min)')}{stats.n ? ` (n=${stats.n})` : ''}</div></Panel>
        <Panel className="p-3"><div className="font-display text-5xl font-extrabold num">{stats.n ? `${Math.round((stats.onTimeRate.value ?? 0) * 100)}%` : '–'}</div><div className="text-sm text-mute">{t('Runs within the normal ride')}</div></Panel>
        <Panel className="p-3"><div className="font-display text-5xl font-extrabold num">{runs.reduce((n, x) => n + aboard(x.id).length, 0)}</div><div className="text-sm text-mute">{t('Students checked in')}</div></Panel>
      </div>
      <Panel className="p-4">
        <h2 className="text-3xl font-bold mb-2">{t('Runs today')}</h2>
        <p className="text-xs text-mute mb-2">{t('A run is one trip between the two ends of the loop, detected from the shuttle\'s GPS.')}</p>
        <ul className="divide-y divide-line">
          {runs.map(x => (
            <li key={x.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
              <span className="num"><b>{fmtClock(x.departedAt ?? x.boardingAt)}</b> {t(zoneLabel(x.fromZone))} → {t(zoneLabel(x.toZone))} <span className="text-mute">({stopName(x.fromStopId)})</span></span>
              <span className="flex items-center gap-2 text-sm"><span className="text-mute">{aboard(x.id).length} {t('aboard')}</span><Pill tone={x.status === 'completed' ? 'ok' : x.status === 'in_transit' ? 'info' : 'mute'}>{x.status.replace('_', ' ')}</Pill>{x.arrivedAt != null && x.departedAt != null && <span className="num text-mute">{t('ride {m} min', { m: (x.arrivedAt - x.departedAt).toFixed(1) })}</span>}</span>
            </li>
          ))}
          {runs.length === 0 && <li className="py-3 text-mute">{t('No runs yet today. They appear as the shuttle reaches and leaves each stop.')}</li>}
        </ul>
      </Panel>
    </div>
  )
}
