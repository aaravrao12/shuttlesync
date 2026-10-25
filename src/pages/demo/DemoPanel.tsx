import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Banner, Panel, Segmented, TextInput, Toggle } from '@/components/ui/Primitives'
import { BusSign } from '@/components/ui/BuildingBadge'
import { StatusChip, SimulatedTag } from '@/components/ui/StatusChip'
import { useCampus, useCollection, useNow, usePeople, useRules, useSettings, useStoreMode } from '@/firebase/hooks'
import { getStore } from '@/firebase/store'
import { seedDemo, resetRuns, clearDemoActivity } from '@/firebase/seed'
import { clock, clockAt } from '@/lib/clock'
import { fmtClock } from '@/lib/time'
import { currentTransition, planDay, zoneLabel } from '@/lib/shuttle'
import { checkInSimulated, undoSimulated } from '@/demo/riders'
import { forcedOffline, setForcedOffline } from '@/firebase/config'
import { useToast } from '@/app/Toast'
import { useT } from '@/i18n'
import type { Checkin } from '@/types'

const SKIP_KEY = 'ss_sim_skips'
const loadSkips = (): string[] => { try { return JSON.parse(localStorage.getItem(SKIP_KEY) || '[]') } catch { return [] } }

/** Presenter's remote control: clock, shuttle simulator, slow shuttles, rain stop, simulated riders, data mode. */
export default function DemoPanel() {
  const t = useT()
  const toast = useToast()
  const campus = useCampus()
  const rules = useRules()
  const settings = useSettings()
  const now = useNow(1000)
  const { students } = usePeople()
  const { mode } = useStoreMode()
  const { rows: checkins } = useCollection<Checkin>('checkins')
  const [skips, setSkips] = useState<string[]>(loadSkips)
  const store = getStore()
  const sims = students.filter(s => s.isSimulated)
  const todayRuns = campus.runs.filter(x => x.date === now.date)

  const toggleSkip = (id: string) => setSkips(s => { const n = s.includes(id) ? s.filter(x => x !== id) : [...s, id]; try { localStorage.setItem(SKIP_KEY, JSON.stringify(n)) } catch { /* ignore */ } return n })

  // Each simulated student: do they need the shuttle now, is a shuttle boarding at their end, and have they checked in?
  const riders = useMemo(() => sims.map(s => {
    const plan = currentTransition(planDay(s.schedule, campus.bell, campus.buildings, campus.stops, rules), now.minutes)
    const run = plan?.needsShuttle ? todayRuns.find(r => r.fromZone === plan.fromZone && r.status !== 'completed' && (r.status === 'boarding' || r.status === 'in_transit')) : undefined
    const bus = run ? campus.busById.get(run.busId) : undefined
    const checkin = plan?.needsShuttle ? checkins.find(c => c.studentId === s.id && todayRuns.some(r => r.id === c.runId && r.toZone === plan.toZone) && c.scannedAtSchoolMin >= plan.prevEnd - 5) : undefined
    return { s, plan, run, bus, checkin }
  }), [sims, campus.bell, campus.buildings, campus.stops, rules, now.minutes, checkins, todayRuns, campus.busById])

  const setClock = (cfg: typeof settings.clock) => store.update('settings', 'main', { clock: cfg })
  const jump = (min: number, speed = settings.clock.speed || 1) => setClock(clockAt(min, speed))
  const [hhmm, setHhmm] = useState('10:05')
  const speed = settings.clock.anchorRealMs ? settings.clock.speed : 1

  async function slow(busId: string, extra: number) {
    const total = (settings.simDelays[busId] ?? 0) + extra
    await store.update('settings', 'main', { simDelays: { ...settings.simDelays, [busId]: total } })
    await store.update('buses', busId, { reportedDelayMin: total })
    toast(t('Shuttle {n} will run slow', { n: campus.busById.get(busId)?.number ?? '' }), 'warn')
  }
  async function resetDelays() { await store.update('settings', 'main', { simDelays: {} }); await Promise.all(campus.buses.map(b => store.update('buses', b.id, { reportedDelayMin: 0 }))) }

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center gap-3 flex-wrap"><h1 className="text-5xl font-extrabold leading-[.95]">{t('Demo control')}</h1><SimulatedTag /></div>
      <p className="text-mute max-w-prose">{t('Drive the demo from here. Everything created in demo mode is labeled Simulated and kept out of the Results page.')}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-4 space-y-3">
          <h2 className="text-3xl font-bold">{t('Data mode')}</h2>
          <Segmented label={t('Data mode')} value={settings.mode} onChange={m => store.update('settings', 'main', { mode: m })} options={[{ value: 'demo', label: t('Demo (simulated)') }, { value: 'pilot', label: t('Real pilot') }]} />
          <p className="text-sm text-mute">{settings.mode === 'pilot' ? t('Pilot mode: scans and feedback count toward Results. Switch back to demo before showing the app to a crowd.') : t('Demo mode: nothing counts toward Results.')}</p>
          <Toggle checked={settings.analyticsOff} onChange={v => store.update('settings', 'main', { analyticsOff: v })} label={t('Turn analytics off')} />
          <Toggle checked={forcedOffline()} onChange={v => { setForcedOffline(v); location.reload() }} label={t('Force offline demo on this device (reloads)')} />
          <p className="text-xs text-mute">{t('Store: {m}', { m: mode === 'memory' ? t('this device only') : 'Firebase' })}</p>
        </Panel>

        <Panel className="p-4 space-y-3">
          <h2 className="text-3xl font-bold">{t('Clock')} <span className="num text-xl text-mute">{fmtClock(now.minutes)}</span></h2>
          <div className="flex flex-wrap gap-2">
            {campus.bell.slice(0, -1).map(b => <Button key={b.id} size="sm" variant="outline" onClick={() => jump(b.end + 0.5)} data-testid={`jump-${b.period}`}>{t('After period {p}', { p: b.period })}</Button>)}
          </div>
          <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); const [h, m] = hhmm.split(':').map(Number); if (!isNaN(h) && !isNaN(m)) jump(h * 60 + m) }}>
            <TextInput aria-label={t('Jump to time (24h)')} value={hhmm} onChange={e => setHhmm(e.target.value)} className="!w-28" data-testid="jump-input" />
            <Button size="sm" type="submit" variant="outline" data-testid="jump-go">{t('Jump to time')}</Button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label={t('Speed')} value={String(speed)} onChange={v => setClock(clockAt(clock.minutes(), Number(v)))} options={[{ value: '1', label: '1×' }, { value: '2', label: '2×' }, { value: '4', label: '4×' }, { value: '8', label: '8×' }]} />
            <Button size="sm" variant="ghost" onClick={() => setClock({ anchorRealMs: 0, anchorVirtualMs: 0, speed: 1 })} icon="reset">{t('Use real time')}</Button>
          </div>
        </Panel>

        <Panel className="p-4 space-y-3">
          <h2 className="text-3xl font-bold">{t('Simulated shuttles')}</h2>
          <Toggle checked={settings.simulatorOn && settings.simulatorOwner === store.uid()} onChange={v => store.update('settings', 'main', { simulatorOn: v, simulatorOwner: v ? store.uid() : null })} label={t('Run the shuttle simulator on this device')} />
          <p className="text-xs text-mute">{t('The shuttles loop between the A loop and the H loop with a short wait at each end. Keep this tab open while presenting. Real shuttle phones are never overridden.')}</p>
          <div className="grid gap-2">
            {campus.buses.map(b => (
              <div key={b.id} className="flex items-center justify-between gap-2 flex-wrap">
                <span className="flex items-center gap-2"><BusSign number={b.number} /> <span className="text-sm text-mute">{b.status.replace('_', ' ')}{b.delayMinutes && b.delayMinutes > 0.5 ? ` · ${Math.round(b.delayMinutes)} min slow` : ''}{settings.realBusIds.includes(b.id) ? ` · ${t('real phone')}` : ''}</span></span>
                <Button size="sm" variant="outline" onClick={() => slow(b.id, 9)} data-testid={`slow-${b.id}`}>{t('Make Shuttle {n} slow', { n: b.number })}</Button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={resetDelays} icon="reset">{t('Clear slowness')}</Button>
          <Toggle checked={rules.rainStopActive} onChange={v => store.update('settings', 'main', { rainStopActive: v })} label={t('Rain stop active (east lot by the pond)')} />
        </Panel>

        <Panel className="p-4 space-y-3">
          <h2 className="text-3xl font-bold">{t('Campus data')}</h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={async () => { await seedDemo(store, now.date); toast(t('Demo campus loaded')) }} data-testid="seed-demo">{t('Load demo campus')}</Button>
            <Button size="sm" variant="outline" onClick={async () => { await resetRuns(store, campus.buses); await store.update('settings', 'main', { simDelays: {} }); toast(t('Runs reset')) }} data-testid="reset-runs">{t('Reset today\'s runs')}</Button>
            <Button size="sm" variant="outline" onClick={async () => { await clearDemoActivity(store); toast(t('Demo activity cleared')) }}>{t('Clear demo activity')}</Button>
          </div>
          <Banner tone="info">{t('"Clear demo activity" removes only simulated rows. Real pilot data is never touched.')}</Banner>
        </Panel>
      </div>

      <Panel className="p-4">
        <h2 className="text-3xl font-bold mb-1">{t('Simulated riders')}</h2>
        <p className="text-sm text-mute mb-3">{t('Check simulated students in on the shuttle that is boarding at their end. Mark a student as "skips" to show "Not checked in".')}</p>
        <ul className="divide-y divide-line">
          {riders.map(({ s, plan, run, bus, checkin }) => (
            <li key={s.id} className="py-2 flex items-center justify-between gap-3 flex-wrap">
              <span><b>{s.name}</b> <span className="text-sm text-mute">{plan?.needsShuttle ? `${t(zoneLabel(plan.fromZone!))} → ${t(zoneLabel(plan.toZone!))} · ${t('period {p}', { p: plan.toPeriod })}` : plan ? t('No shuttle needed') : t('Nothing now')}</span></span>
              <span className="flex items-center gap-2">
                {checkin && <StatusChip status="on_the_way" compact />}
                {plan?.needsShuttle && !checkin && <Button size="sm" variant={skips.includes(s.id) ? 'primary' : 'ghost'} onClick={() => toggleSkip(s.id)} aria-pressed={skips.includes(s.id)} data-testid={`sim-skip-${s.code}`}>{skips.includes(s.id) ? t('Skips') : t('Skip')}</Button>}
                {plan?.needsShuttle && (checkin
                  ? <Button size="sm" variant="ghost" onClick={() => { const r = todayRuns.find(x => x.id === checkin.runId); if (r) undoSimulated(store, s, r) }}>{t('Undo')}</Button>
                  : <Button size="sm" variant="outline" disabled={!run} data-testid={`sim-in-${s.code}`} onClick={() => run && bus && checkInSimulated(store, s, bus, run, now.minutes, now.nowMs)}>{run ? t('Check in') : t('No shuttle boarding')}</Button>)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2 flex-wrap">
          <Button size="sm" data-testid="sim-in-all" onClick={async () => { for (const r of riders) if (r.plan?.needsShuttle && r.run && r.bus && !r.checkin && !skips.includes(r.s.id)) await checkInSimulated(store, r.s, r.bus, r.run, now.minutes, now.nowMs) }}>{t('Check in everyone except skippers')}</Button>
          <Link to="/pitch"><Button size="sm" variant="outline" icon="slides">{t('Open pitch mode')}</Button></Link>
          <Link to="/teacher"><Button size="sm" variant="outline" icon="map">{t('Open teacher dashboard')}</Button></Link>
        </div>
      </Panel>
    </div>
  )
}
