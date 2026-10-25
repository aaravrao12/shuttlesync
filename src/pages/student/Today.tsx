import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { BuildingBadge } from '@/components/ui/BuildingBadge'
import { Icon } from '@/components/ui/Icon'
import { Banner, CountdownRing, EmptyState, Spinner } from '@/components/ui/Primitives'
import { ShuttleCard } from '@/components/ui/ShuttleCard'
import { StatusChip } from '@/components/ui/StatusChip'
import { fmtClock } from '@/lib/time'
import { zoneLabel, type Transition, type Verdict } from '@/lib/shuttle'
import { useStudentPlan } from './useStudentPlan'
import { Coach } from './Coach'
import { OffHours } from '@/app/OffHours'
import { useT } from '@/i18n'
import { coachSeen } from '@/app/session'

/** Notification reminders only work while the app is open/installed (no server push needed, $0). */
function useLeaveReminder(plan: Transition | undefined, nowMin: number) {
  const fired = useRef<string>('')
  useEffect(() => {
    if (!plan?.needsShuttle || localStorage.getItem('ss_notify') !== '1') return
    const key = `${plan.toPeriod}`
    if (fired.current === key) return
    // Passing period starts at prevEnd; nudge the student when it begins.
    if (nowMin >= plan.prevEnd && nowMin < plan.prevEnd + 2 && 'Notification' in window && Notification.permission === 'granted') {
      fired.current = key
      new Notification('Time to head to the shuttle', { body: 'Check the live tracker to see if you will make it.' })
    }
  }, [plan, nowMin])
}

const VERDICT: Record<Verdict, { text: string; icon: string; cls: string }> = {
  // text uses --brand-ink (white in light mode, dark in dark mode) so it keeps contrast on the lighter dark-mode status colors
  on_track: { text: 'On track', icon: 'check-circle', cls: 'bg-ok text-[rgb(var(--brand-ink))]' },
  close: { text: 'Cutting it close', icon: 'clock', cls: 'bg-warn text-[rgb(var(--brand-ink))]' },
  late: { text: 'Likely late', icon: 'warn', cls: 'bg-bad text-[rgb(var(--brand-ink))]' },
  unknown: { text: 'Waiting for a shuttle signal', icon: 'hourglass', cls: 'bg-[rgb(var(--ink))] text-[rgb(var(--ground))]' },
}

export default function Today() {
  const t = useT()
  const sp = useStudentPlan()
  const { student, campus, rules, now, plans, plan, shuttles, makeIt, checkin, status, projected, boardStop } = sp
  useLeaveReminder(plan, now.minutes)
  const [coach, setCoach] = useState(!coachSeen('today'))

  if (!campus.ready) return <Spinner />
  if (!student) return <EmptyState icon="users" title={t('Finish setting up')} body={t('Add your schedule so we can find your shuttle.')} action={<Link to="/student/onboarding"><Button>{t('Set up my schedule')}</Button></Link>} />

  const bld = (id?: string) => campus.buildingById.get(id ?? '')
  const day = [...student.schedule].sort((a, b) => a.period - b.period)
  const first = campus.bell[0]
  const lastEnd = campus.bell[campus.bell.length - 1]?.end ?? 0
  const rainNote = rules.rainStopActive && boardStop?.kind === 'rain'

  let hero: React.ReactNode
  if (!plan) {
    hero = (
      <div className="rounded-sign bg-panel border border-line p-6">
        <h1 className="text-5xl font-extrabold leading-[.95]">{now.minutes < (first?.start ?? 0) ? t('School has not started') : now.minutes > lastEnd ? t('No more shuttles today') : t('No shuttle in your next break')}</h1>
        <p className="text-mute mt-2">{t('Your day is below.')}</p>
      </div>
    )
  } else if (!plan.needsShuttle) {
    const to = bld(plan.toBuildingId), from = bld(plan.fromBuildingId)
    const indoors = from?.zone === 'main' && to?.zone === 'main' && from.id !== to.id
    hero = (
      <div className="rounded-sign bg-panel border border-line p-6 flex items-center gap-4" data-testid="no-shuttle">
        <BuildingBadge code={to?.code} size={56} />
        <div>
          <h1 className="text-5xl font-extrabold leading-[.95]">{indoors ? t('No shuttle needed: walk indoors') : t('No shuttle needed')}</h1>
          <p className="text-mute mt-1">{t('Your next class is in {b}.', { b: to?.name ?? '' })} {indoors && t('A, D and E are connected inside.')}</p>
        </div>
      </div>
    )
  } else {
    const toB = bld(plan.toBuildingId)
    const v = VERDICT[makeIt?.verdict ?? 'unknown']
    const bellIn = plan.nextBell - now.minutes
    const arrivesIn = projected != null ? projected - now.minutes : null
    hero = (
      <motion.div layout className="rounded-sign bg-[rgb(var(--sign))] text-[rgb(var(--sign-ink))] p-5 shadow-[0_6px_0_rgb(var(--ink)/.9)]" data-testid="next-move">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-[6px] bg-[rgb(21_23_27)] text-white px-2.5 py-1 font-display font-bold">
              <span className="text-[rgb(var(--sign))]">{t(zoneLabel(plan.fromZone!))}</span><span aria-hidden>→</span><span>{t(zoneLabel(plan.toZone!))}</span>
            </div>
            <h1 className="text-[2.9rem] sm:text-6xl font-extrabold leading-[.9] mt-3">{checkin ? t('You\'re on the shuttle') : t('Take the shuttle to {b}', { b: toB?.code ?? '' })}</h1>
            <p className="mt-2 font-medium text-lg">{t('Period {p} · {b} · bell at {time}', { p: plan.toPeriod, b: toB?.name ?? '', time: fmtClock(plan.nextBell) })}</p>
          </div>
          {checkin && arrivesIn != null && (
            <div className="text-center shrink-0">
              <CountdownRing minutes={arrivesIn} fraction={Math.min(1, arrivesIn / Math.max(1, rules.normalRideMin))} size={112} label={t('Arrives in')} />
              <div className="text-xs font-bold mt-1">{t('Arrives in')}</div>
            </div>
          )}
        </div>

        {!checkin && (
          <div className="mt-4 space-y-3">
            <div className={`inline-flex items-center gap-2 rounded-pill px-3 py-1.5 font-bold ${v.cls}`} data-testid="verdict" data-verdict={makeIt?.verdict ?? 'unknown'}><Icon name={v.icon} size={18} />{t(v.text)}</div>
            {makeIt && makeIt.verdict !== 'unknown' && (
              <ul className="text-sm font-medium grid gap-0.5">
                <li>{makeIt.boardInMin != null && sp.bestEta != null && sp.bestEta <= 0.5 ? t('A shuttle is at your stop now.') : t('A shuttle can pick you up in about {m} min.', { m: Math.max(1, Math.round(makeIt.boardInMin ?? 0)) })}</li>
                <li>{t('The ride takes about {m} min, then a {w} min walk.', { m: rules.normalRideMin, w: rules.walkFromStopMin })}</li>
                <li>{makeIt.slackMin! >= 0 ? t('The bell is in {b} min, so you would have about {s} min to spare.', { b: Math.max(0, Math.round(bellIn)), s: Math.round(makeIt.slackMin!) }) : t('The bell is in {b} min, so you would arrive about {s} min late. If the shuttle is slow, you are excused.', { b: Math.max(0, Math.round(bellIn)), s: Math.abs(Math.round(makeIt.slackMin!)) })}</li>
              </ul>
            )}
            <p className="text-sm font-medium flex items-center gap-1.5"><Icon name="pin" size={14} />{t('Board at {s}', { s: boardStop?.name ?? '' })}</p>
            <Link to="/student/scan" data-coach="scan"><Button size="lg" icon="scan" data-testid="goto-scan" className="!bg-[rgb(21_23_27)] !text-white">{t('Check in on the shuttle')}</Button></Link>
          </div>
        )}
        {checkin && status && <div className="mt-4"><span className="inline-flex rounded-pill bg-[rgb(var(--panel))]"><StatusChip status={status} /></span></div>}
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-mute font-medium">{t('Hi {name}', { name: student.name.split(' ')[0] })}</p>
        <div className="num text-sm text-mute">{fmtClock(now.minutes)}</div>
      </div>
      <OffHours />
      {hero}
      {rainNote && <Banner tone="info" icon="pin">{t('Rain stop is on. Meet the shuttle at {s}.', { s: boardStop?.name ?? '' })}</Banner>}
      {status === 'excused_bus_late' && checkin && <p className="text-sm text-mute">{t('Your ride is running slow. You will be excused, not marked tardy.')}</p>}
      {checkin && status !== 'excused_bus_late' && <p className="text-sm text-mute">{t('Checked in at {time}.', { time: fmtClock(checkin.scannedAtSchoolMin) })}</p>}

      {plan?.needsShuttle && (
        <section aria-label={t('Live shuttles')}>
          <h2 className="text-3xl font-bold mb-2">{t('Live shuttles')}</h2>
          <ul className="space-y-2" data-testid="shuttle-list">
            {campus.buses.map(b => { const l = shuttles.find(s => s.busId === b.id)!; return <ShuttleCard key={b.id} bus={b} live={l} delayThreshold={rules.delayThresholdMin} /> })}
            {campus.buses.length === 0 && <li className="text-mute">{t('No shuttles are set up yet.')}</li>}
          </ul>
          <p className="text-xs text-mute mt-2">{t('Any shuttle at your stop goes to the other end. There is no timetable.')}</p>
        </section>
      )}

      <section aria-label={t('Your day')}>
        <h2 className="text-3xl font-bold mb-3">{t('Your day')}</h2>
        <ol className="relative">
          {day.map((e, idx) => {
            const b = campus.bell.find(x => x.period === e.period)
            const tp = plans.find(p => p.toPeriod === e.period + 1)
            const here = b && now.minutes >= b.start && now.minutes < b.end
            return (
              <li key={e.period} className="relative pl-12 pb-5">
                {idx < day.length - 1 && <span className="absolute left-[19px] top-10 bottom-0 w-[3px] route-track" aria-hidden />}
                <span className="absolute left-0 top-0"><BuildingBadge code={bld(e.buildingId)?.code} size={40} /></span>
                <div className={`rounded-sign border p-3 ${here ? 'border-brand bg-brand/5' : 'border-line bg-panel'}`}>
                  <div className="flex justify-between gap-2"><span className="font-bold">{t('Period {p}', { p: e.period })} · {e.courseName}</span>{here && <span className="text-xs font-bold text-brand">{t('Now')}</span>}</div>
                  <div className="text-sm text-mute num">{b ? `${fmtClock(b.start)}–${fmtClock(b.end)}` : ''} · {t('Room')} {e.room}{e.teacherName ? ` · ${e.teacherName}` : ''}</div>
                </div>
                {(() => { const nb = campus.bell.find(x => x.period === e.period + 1); return nb?.lunchBefore ? (
                  <div className="mt-2 rounded-sign border border-dashed border-line bg-raised px-3 py-2 text-sm" data-testid="lunch-row">
                    <span className="font-bold">{t('Lunch')}</span> <span className="num text-mute">{fmtClock(nb.lunchBefore.start)}–{fmtClock(nb.lunchBefore.end)}</span>
                    {nb.lunchBefore.splitAt != null && <span className="text-mute"> · {t('All students. A block until {t}, then B block.', { t: fmtClock(nb.lunchBefore.splitAt) })}</span>}
                  </div>) : null })()}
                {tp && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <Icon name={tp.needsShuttle ? 'bus' : 'footprints'} size={16} />
                    <span className="font-bold">{tp.needsShuttle ? t('Shuttle: {a} to {b}', { a: t(zoneLabel(tp.fromZone!)), b: t(zoneLabel(tp.toZone!)) }) : t('No shuttle needed')}</span>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </section>
      {coach && <Coach onDone={() => setCoach(false)} />}
    </div>
  )
}
