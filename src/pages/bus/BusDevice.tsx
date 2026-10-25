import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Banner, Logo, Panel, Segmented, Spinner, Toggle } from '@/components/ui/Primitives'
import { BusQr } from '@/components/qr/RotatingQr'
import { useCampus, useNow, useRules, useSettings } from '@/firebase/hooks'
import { getStore } from '@/firebase/store'
import { patchProfile, useProfile } from '@/app/session'
import { freshGeofence, initialRun, processBusFix } from '@/lib/busEngine'
import { activeStops, zoneLabel } from '@/lib/shuttle'
import { clock } from '@/lib/clock'
import { haversineM } from '@/lib/geofence'
import type { BellPeriod, BusLocation, Stop } from '@/types'
import { useT } from '@/i18n'

// Free-tier friendly: write when the shuttle moved >10 m, or at least every 20 s so the 30 s freshness check for scans keeps passing.
const MIN_WRITE_GAP_MS = 10000
const HEARTBEAT_MS = 20000
const MIN_MOVE_M = 10

/**
 * There is no timetable, so "is a run possible right now?" can only come from the bell schedule: the shuttle matters
 * from a few minutes before each period ends until a few minutes after the next one starts, plus a margin around the school day.
 * Outside those windows the phone idles (no writes), which protects the free-tier quota.
 */
export function inShuttleWindow(bell: BellPeriod[], nowMin: number): boolean {
  if (bell.length < 2) return true
  const first = bell[0], last = bell[bell.length - 1]
  if (nowMin >= first.start - 30 && nowMin < first.start + 5) return true // before first bell
  if (nowMin > last.end - 5 && nowMin <= last.end + 20) return true // after the last bell
  return bell.slice(1).some((b, i) => nowMin >= bell[i].end - 3 && nowMin <= b.start + 6)
}

export default function BusDevice() {
  const t = useT()
  const campus = useCampus()
  const settings = useSettings()
  const rules = useRules()
  const profile = useProfile()
  const now = useNow(1000)
  const [view, setView] = useState<'status' | 'qr'>('status')
  const [qrMode, setQrMode] = useState<'rotating' | 'static'>('rotating')
  const [running, setRunning] = useState(false)
  const [allDay, setAllDay] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [fix, setFix] = useState<BusLocation | null>(null)
  const [lastWrite, setLastWrite] = useState(0)
  const [wake, setWake] = useState<'on' | 'off' | 'unsupported'>('off')

  const bus = campus.busById.get(profile.busId ?? '')
  const live = useRef({ campus, bus, rules, allDay, geofence: freshGeofence(), lastWrittenAt: 0, lastWrittenLoc: null as BusLocation | null })
  live.current.campus = campus; live.current.bus = bus; live.current.rules = rules; live.current.allDay = allDay

  const watchId = useRef<number | null>(null)
  const wakeLock = useRef<any>(null)

  const handleFix = useCallback(async (pos: GeolocationPosition) => {
    const { campus, bus, rules } = live.current
    if (!bus) return
    const loc: BusLocation = {
      lat: pos.coords.latitude, lng: pos.coords.longitude, speedMps: pos.coords.speed ?? 0,
      heading: pos.coords.heading ?? 0, accuracyM: pos.coords.accuracy, updatedAt: Date.now(),
    }
    setFix(loc)
    const nowMs = Date.now()
    const moved = live.current.lastWrittenLoc ? haversineM(loc, live.current.lastWrittenLoc) : Infinity
    const gap = nowMs - live.current.lastWrittenAt
    if (gap < MIN_WRITE_GAP_MS || (moved < MIN_MOVE_M && gap < HEARTBEAT_MS)) return
    const store = getStore()
    if (!live.current.allDay && !inShuttleWindow(campus.bell, clock.minutes())) {
      if (bus.status !== 'idle') { live.current.lastWrittenAt = nowMs; await store.update('buses', bus.id, { status: 'idle', nextStopId: null, etaToNextStop: null, delayMinutes: 0, reportedDelayMin: 0 }) }
      return
    }
    live.current.lastWrittenAt = nowMs; live.current.lastWrittenLoc = loc
    const run = campus.runs.find(r => r.id === bus.activeRunId) ?? null
    const out = processBusFix({ bus, fix: loc, run, stops: activeStops(campus.stops, rules), geofence: live.current.geofence, nowMin: clock.minutes(), nowMs: clock.nowMs(), date: clock.date(), rules })
    live.current.geofence = out.geofence
    await store.update('buses', bus.id, { ...out.busPatch, isSimulated: false })
    for (const r of out.runUpserts) await store.set('runs', r.id, { ...r, isSimulated: false })
    for (const e of out.events) await store.add('events', { ...e, isSimulated: false })
    setLastWrite(nowMs)
  }, [])

  async function acquireWake() {
    try {
      if (!('wakeLock' in navigator)) return setWake('unsupported')
      wakeLock.current = await (navigator as any).wakeLock.request('screen')
      setWake('on')
      wakeLock.current.addEventListener('release', () => setWake('off'))
    } catch { setWake('off') }
  }

  async function start() {
    if (!bus) return
    setGeoError(null)
    if (!('geolocation' in navigator)) { setGeoError(t('This device cannot share location.')); return }
    live.current.geofence = freshGeofence()
    watchId.current = navigator.geolocation.watchPosition(handleFix, e => setGeoError(e.code === 1 ? t('Location is blocked. Allow location for this site in your browser settings, then tap Start again.') : t('Waiting for a GPS signal. Move near a window or go outside.')), { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 })
    setRunning(true)
    acquireWake()
    // Tell the demo simulator to leave this shuttle alone while a real phone drives it.
    await getStore().update('settings', 'main', { realBusIds: Array.from(new Set([...settings.realBusIds, bus.id])) })
    await getStore().update('buses', bus.id, { isSimulated: false })
  }

  async function stop() {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
    wakeLock.current?.release?.().catch?.(() => {})
    setRunning(false)
    if (bus) await getStore().update('settings', 'main', { realBusIds: settings.realBusIds.filter(x => x !== bus.id) })
  }

  /** The phone may be switched on mid-loop. Tell it where the shuttle is so the first run is right. */
  async function sync(a: { at?: Stop; toward?: 'main' | 'annex' }) {
    if (!bus) return
    const init = initialRun({ bus, date: clock.date(), nowMin: clock.minutes(), stops: activeStops(campus.stops, rules), ...a })
    live.current.geofence = init.geofence
    const store = getStore()
    await store.set('runs', init.run.id, init.run)
    await store.update('buses', bus.id, { activeRunId: init.run.id, runSeq: init.seq, status: init.run.status === 'boarding' ? 'boarding' : 'in_transit', currentStopId: a.at?.id ?? null })
  }

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && running) acquireWake() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [running])
  useEffect(() => () => { if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current) }, [])

  if (!campus.ready) return <Spinner />
  const age = lastWrite ? Math.round((Date.now() - lastWrite) / 1000) : null
  void now

  if (!bus) {
    return (
      <div className="mx-auto max-w-xl p-4 space-y-4">
        <Logo />
        <h1 className="text-5xl font-extrabold leading-[.95]">{t('Which shuttle are you on?')}</h1>
        <Banner tone="warn" icon="shield">{t('This phone shares the shuttle location. It is a passenger device. The driver should never use it while driving.')}</Banner>
        <div className="grid grid-cols-2 gap-3">
          {campus.buses.map(b => (
            <button key={b.id} onClick={() => patchProfile({ role: 'bus', busId: b.id })} data-testid={`pick-${b.id}`}
              className="bg-panel border border-line rounded-sign p-4 text-left hover:border-brand min-h-[88px]">
              <span className="font-display text-5xl font-extrabold leading-none">{b.number}</span>
              <span className="block text-sm text-mute mt-1">{t('Shuttle {n}', { n: b.number })}</span>
            </button>
          ))}
          {campus.buses.length === 0 && <p className="text-mute col-span-2">{t('No shuttles are set up yet. An admin adds them in School setup.')}</p>}
        </div>
        <Link to="/start" className="text-sm underline text-mute">{t('Back')}</Link>
      </div>
    )
  }

  const run = campus.runs.find(r => r.id === bus.activeRunId) ?? null
  const live2 = activeStops(campus.stops, rules)
  const at = bus.currentStopId ? campus.stopById.get(bus.currentStopId) : null
  const next = bus.nextStopId ? campus.stopById.get(bus.nextStopId) : null
  const stopA = live2.find(s => s.zone === 'main' && s.kind === 'primary'), stopH = live2.find(s => s.zone === 'annex' && s.kind === 'primary')
  return (
    <div className="min-h-dvh bg-[rgb(21_23_27)] text-white p-4 space-y-4">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center justify-between"><span className="font-display text-3xl font-extrabold">{t('Shuttle {n}', { n: bus.number })}</span><button className="text-sm underline opacity-80" onClick={() => { stop(); patchProfile({ busId: undefined }) }}>{t('Change shuttle')}</button></div>
        <Banner tone="warn" icon="shield">{t('Passenger device. Not for the driver.')}</Banner>

        <Segmented label={t('Screen')} value={view} onChange={setView} options={[{ value: 'status', label: t('Status') }, { value: 'qr', label: t('Show QR code') }]} />

        {view === 'qr' ? (
          <Panel className="p-5 text-ink text-center space-y-3">
            <h2 className="text-4xl font-extrabold leading-none">{t('Scan to check in')}</h2>
            <BusQr bus={bus} mode={qrMode} size={Math.min(320, window.innerWidth - 90)} />
            <div className="flex justify-center"><Segmented label="QR type" value={qrMode} onChange={setQrMode} options={[{ value: 'rotating', label: t('Rotating') }, { value: 'static', label: t('Printed') }]} /></div>
            <p className="text-sm text-mute">{t('Hold this screen up when students board. The code changes every minute.')}</p>
          </Panel>
        ) : (
          <Panel className="p-5 text-ink space-y-4">
            <div className="flex items-center gap-3">
              <span className={`h-4 w-4 rounded-full ${running && fix ? 'bg-ok animate-pulseRing' : running ? 'bg-warn' : 'bg-line'}`} />
              <div className="font-display text-4xl font-extrabold leading-none" data-testid="bus-state">{!running ? t('Not sharing') : fix ? t('Sharing location') : t('Looking for GPS')}</div>
            </div>
            {geoError && <Banner tone="bad">{geoError}</Banner>}
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-mute">{t('Current run')}</dt><dd className="font-bold">{run ? `${t(zoneLabel(run.fromZone))} → ${t(zoneLabel(run.toZone))}` : t('Not started yet')}</dd></div>
              <div><dt className="text-mute">{t('Status')}</dt><dd className="font-bold">{bus.status.replace('_', ' ')}{bus.delayMinutes && bus.delayMinutes > 0.5 ? ` · ${Math.round(bus.delayMinutes)} min slow` : ''}</dd></div>
              <div><dt className="text-mute">{at ? t('At') : t('Heading to')}</dt><dd className="font-bold">{(at ?? next)?.name ?? '–'}{!at && bus.etaToNextStop != null ? ` · ${bus.etaToNextStop.toFixed(1)} min` : ''}</dd></div>
              <div><dt className="text-mute">{t('GPS accuracy')}</dt><dd className="font-bold num">{fix ? `±${Math.round(fix.accuracyM)} m` : '–'}</dd></div>
              <div><dt className="text-mute">{t('Last sent')}</dt><dd className="font-bold num">{age != null ? t('{s}s ago', { s: age }) : '–'}</dd></div>
              <div><dt className="text-mute">{t('Screen stays on')}</dt><dd className="font-bold">{wake === 'on' ? t('Yes') : wake === 'unsupported' ? t('Not supported: keep the screen awake yourself') : t('No')}</dd></div>
            </dl>
            {running && !run && stopA && stopH && (
              <div className="space-y-2" data-testid="where-are-you">
                <p className="font-bold">{t('Where is the shuttle right now?')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => sync({ at: stopA })} data-testid="sync-at-a">{t('At {s}', { s: stopA.name })}</Button>
                  <Button variant="outline" onClick={() => sync({ at: stopH })} data-testid="sync-at-h">{t('At {s}', { s: stopH.name })}</Button>
                  <Button variant="outline" onClick={() => sync({ toward: 'main' })}>{t('On the road to the main campus')}</Button>
                  <Button variant="outline" onClick={() => sync({ toward: 'annex' })}>{t('On the road to the Annex')}</Button>
                </div>
                <p className="text-xs text-mute">{t('After this, the phone detects each run by itself when the shuttle leaves and reaches a stop.')}</p>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-mute">{t('Stuck or running slow?')}</span>
              {[5, 10].map(m => <Button key={m} size="sm" variant="outline" onClick={() => getStore().update('buses', bus.id, { reportedDelayMin: m })} data-testid={`report-${m}`}>+{m} min</Button>)}
              {!!bus.reportedDelayMin && <Button size="sm" variant="ghost" onClick={() => getStore().update('buses', bus.id, { reportedDelayMin: 0 })}>{t('Clear')}</Button>}
            </div>
            <Toggle checked={allDay} onChange={setAllDay} label={t('Share all day (uses more of the free quota)')} />
            {!running
              ? <Button full size="lg" icon="play" onClick={start} data-testid="bus-start">{t('Start sharing')}</Button>
              : <Button full size="lg" variant="outline" icon="pause" onClick={stop} data-testid="bus-stop">{t('Stop sharing')}</Button>}
            <p className="text-xs text-mute">{t('Only this shuttle is tracked, never the people on it. Updates are sent every few seconds while it moves, around passing periods.')}</p>
          </Panel>
        )}
      </div>
    </div>
  )
}
