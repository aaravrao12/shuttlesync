import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Banner, EmptyState, Spinner } from '@/components/ui/Primitives'
import { ShuttleCard } from '@/components/ui/ShuttleCard'
import { StatusChip } from '@/components/ui/StatusChip'
import { MapView } from '@/components/map/MapView'
import { fmtClock } from '@/lib/time'
import { useStudentPlan } from './useStudentPlan'
import { useT } from '@/i18n'

/** "Shuttles" tab: every shuttle on a live map, where it is, and how long until you can board. */
export default function MyBus() {
  const t = useT()
  const { student, campus, rules, plan, shuttles, checkin, status, projected, now, boardStop } = useStudentPlan()
  if (!campus.ready || !student) return <Spinner />
  if (!campus.buses.length) return <EmptyState icon="bus" title={t('No shuttles yet')} body={t('Shuttles will show up here once they start sharing their location.')} action={<Link to="/student"><Button variant="outline">{t('Back to today')}</Button></Link>} />

  const eta = projected != null ? projected - now.minutes : null
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-5xl font-extrabold leading-[.95]">{t('Live shuttles')}</h1>
        {checkin && status && <StatusChip status={status} />}
      </div>
      {checkin && eta != null && <p className="text-xl font-medium num">{eta <= 0.5 ? t('Arriving now') : t('Arrives in {m} min', { m: Math.max(1, Math.round(eta)) })}{plan ? ` · ${t('bell at {time}', { time: fmtClock(plan.nextBell) })}` : ''}</p>}
      <MapView buildings={campus.buildings} stops={campus.stops} buses={campus.buses} rainActive={rules.rainStopActive} height={340} highlightStopId={boardStop?.id} />
      <ul className="space-y-2">
        {campus.buses.map(b => <ShuttleCard key={b.id} bus={b} live={shuttles.find(s => s.busId === b.id)!} delayThreshold={rules.delayThresholdMin} showEta={!!plan?.needsShuttle} />)}
      </ul>
      {rules.rainStopActive && <Banner tone="info" icon="pin">{t('Rain stop is on: D and E students meet the shuttle at the east lot by the pond.')}</Banner>}
      {status === 'excused_bus_late' && <Banner tone="warn" icon="clock">{t('Your ride is running slow. You will be excused, not marked tardy.')}</Banner>}
      {!checkin && plan?.needsShuttle && <Link to="/student/scan"><Button full size="lg" icon="scan">{t('Check in on the shuttle')}</Button></Link>}
      {campus.buses.some(b => b.isSimulated) && <p className="text-xs text-mute">{t('These shuttles are simulated for the demo.')}</p>}
    </div>
  )
}
