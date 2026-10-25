import type { Bus } from '@/types'
import { zoneLabel, type ShuttleWhere } from '@/lib/shuttle'
import { Icon } from './Icon'
import { Pill, SimulatedTag } from './StatusChip'
import { useT } from '@/i18n'

export interface ShuttleCardData { where: ShuttleWhere; etaToMeMin: number | null; riders: number; delayMinutes: number }

/** One live line per shuttle: where it is right now, how long until you can board it, how many riders, and whether it is slow. */
export function ShuttleCard({ bus, live, delayThreshold, showEta = true }: { bus: Bus; live: ShuttleCardData; delayThreshold: number; showEta?: boolean }) {
  const t = useT()
  const w = live.where
  const slow = live.delayMinutes > delayThreshold
  const where =
    w.kind === 'offline' ? t('No signal from this shuttle')
    : w.kind === 'unknown' ? t('Finding its place on the loop')
    : w.kind === 'at_stop' ? t('At {s}', { s: w.stop.name })
    : t('En route to {z}', { z: t(zoneLabel(w.toZone)) })
  const eta = live.etaToMeMin
  return (
    <li className={`rounded-sign border p-3 flex flex-wrap items-center gap-x-4 gap-y-1 ${slow ? 'border-warn/60 bg-warn/5' : 'border-line bg-panel'}`} data-testid={`shuttle-${bus.id}`}>
      <span className="grid place-items-center h-10 w-10 rounded-[6px] bg-[rgb(21_23_27)] text-[rgb(var(--sign))] font-display text-2xl font-extrabold shrink-0">{bus.number}</span>
      <div className="flex-1 min-w-[10rem]">
        <div className="font-bold flex items-center gap-2 flex-wrap">{t('Shuttle {n}', { n: bus.number })}{bus.isSimulated && <SimulatedTag />}</div>
        <div className="text-sm text-mute flex items-center gap-1.5"><Icon name={w.kind === 'at_stop' ? 'pin' : 'bus'} size={14} />{where}</div>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-sm">
        {showEta && eta != null && <Pill tone="info" icon="clock">{eta <= 0.5 ? t('At your stop now') : t('{m} min to your stop', { m: Math.max(1, Math.round(eta)) })}</Pill>}
        <Pill tone="mute" icon="users">{t('{n} aboard', { n: live.riders })}</Pill>
        {slow && <Pill tone="warn" icon="clock">{t('Running about {m} min slow', { m: Math.max(1, Math.round(live.delayMinutes)) })}</Pill>}
      </div>
    </li>
  )
}
