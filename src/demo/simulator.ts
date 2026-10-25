// Shuttle simulator for demos and tests. It does NOT fake the results: it only fakes the GPS.
// Positions are fed through the same processBusFix() a real shuttle phone uses, so run detection, geofence events,
// ETA, delay and student statuses in the demo are produced by the real logic.
//
// The shuttles loop continuously A <-> H with a short dwell at each end (no timetable). With the rain stop on, the
// main-campus end becomes A loop → rain stop, so the engine's "hop inside a zone" rule gets exercised too.
import type { AppSettings, Bus, BusLocation, Run, Stop } from '@/types'
import type { Store } from '@/firebase/store'
import { GeofenceState, haversineM } from '@/lib/geofence'
import { freshGeofence, initialRun, processBusFix } from '@/lib/busEngine'
import { activeStops, primaryStop, rulesFrom, type ShuttleRules } from '@/lib/shuttle'
import { clock } from '@/lib/clock'

export interface SimPos { lat: number; lng: number; speedMps: number; heading: number; atStop: Stop | null; towardZone?: 'main' | 'annex' }

interface Leg { stop: Stop; travelMin: number; dwellMin: number }

const bearing = (a: Stop, b: Stop) => {
  const y = Math.sin((b.lng - a.lng) * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180)
  const x = Math.cos(a.lat * Math.PI / 180) * Math.sin(b.lat * Math.PI / 180) - Math.sin(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.cos((b.lng - a.lng) * Math.PI / 180)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** The cyclic waypoint list the shuttles drive. Each leg = travel to the stop, then wait there. */
export function loopLegs(stops: Stop[], rules: ShuttleRules): Leg[] {
  const a = primaryStop('main', stops), h = primaryStop('annex', stops)
  const rain = activeStops(stops, rules).find(s => s.kind === 'rain')
  if (!a || !h) return []
  if (rain) {
    return [
      { stop: a, travelMin: rules.normalRideMin, dwellMin: 1 },
      { stop: rain, travelMin: 1.5, dwellMin: 1 },
      { stop: h, travelMin: Math.max(1, rules.normalRideMin - 1), dwellMin: rules.dwellMin },
    ]
  }
  return [{ stop: a, travelMin: rules.normalRideMin, dwellMin: rules.dwellMin }, { stop: h, travelMin: rules.normalRideMin, dwellMin: rules.dwellMin }]
}

export const cycleMin = (legs: Leg[]) => legs.reduce((t, l) => t + l.travelMin + l.dwellMin, 0)

/** Where is a shuttle at `phaseMin` minutes into the loop? Linear between stops, dwelling at each. */
export function loopPosition(legs: Leg[], phaseMin: number): SimPos {
  const T = cycleMin(legs)
  let t = ((phaseMin % T) + T) % T
  for (let i = 0; i < legs.length; i++) {
    const prev = legs[(i - 1 + legs.length) % legs.length].stop, leg = legs[i]
    if (t <= leg.travelMin) {
      const f = leg.travelMin ? t / leg.travelMin : 1
      return { lat: prev.lat + (leg.stop.lat - prev.lat) * f, lng: prev.lng + (leg.stop.lng - prev.lng) * f, speedMps: haversineM(prev, leg.stop) / (leg.travelMin * 60), heading: bearing(prev, leg.stop), atStop: null, towardZone: leg.stop.zone }
    }
    t -= leg.travelMin
    if (t <= leg.dwellMin) return { lat: leg.stop.lat, lng: leg.stop.lng, speedMps: 0, heading: bearing(prev, leg.stop), atStop: leg.stop }
    t -= leg.dwellMin
  }
  const last = legs[legs.length - 1].stop
  return { lat: last.lat, lng: last.lng, speedMps: 0, heading: 0, atStop: last }
}

interface BusSim { shift: number; applied: number; frozen: number | null; holdUntil: number; geofence: GeofenceState; started: boolean }

export interface SimSnapshot { buses: Bus[]; runs: Run[]; stops: Stop[]; settings: AppSettings }

/** Create a ticker. Call `tick()` about once a second; it reads the latest snapshot each time. */
export function createSimulator(store: Store, snapshot: () => SimSnapshot) {
  const sims = new Map<string, BusSim>()
  const sim = (id: string): BusSim => {
    let s = sims.get(id)
    if (!s) { s = { shift: 0, applied: 0, frozen: null, holdUntil: 0, geofence: freshGeofence(), started: false }; sims.set(id, s) }
    return s
  }

  return async function tick() {
    const { buses, runs, stops, settings } = snapshot()
    const rules = rulesFrom(settings)
    const live = activeStops(stops, rules)
    const legs = loopLegs(stops, rules)
    if (!legs.length) return
    const T = cycleMin(legs)
    const nowMin = clock.minutes()
    const nowMs = clock.nowMs()
    const date = clock.date()
    const mine = buses.filter(b => !settings.realBusIds.includes(b.id)).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))

    for (const [idx, bus] of mine.entries()) {
      const s = sim(bus.id)
      const offset = (idx * T) / Math.max(1, mine.length) // spread the shuttles evenly around the loop

      // "Make shuttle slow": a new delay value freezes the shuttle for that many minutes, then the loop resumes shifted.
      const wanted = settings.simDelays[bus.id] ?? 0
      if (wanted > s.applied) {
        const extra = wanted - s.applied
        s.frozen = nowMin - s.shift
        s.holdUntil = nowMin + extra
        s.shift += extra
        s.applied = wanted
      } else if (wanted < s.applied) { s.shift = 0; s.applied = 0; s.frozen = null; s.holdUntil = 0 }

      const holding = s.frozen != null && nowMin < s.holdUntil
      if (s.frozen != null && !holding && bus.reportedDelayMin) await store.update('buses', bus.id, { reportedDelayMin: 0 }) // hold is over: GPS tells the truth now
      const tt = holding ? (s.frozen as number) : nowMin - s.shift
      const pos = loopPosition(legs, tt + offset)
      const fix: BusLocation = { lat: pos.lat, lng: pos.lng, speedMps: holding ? 0 : pos.speedMps, heading: pos.heading, accuracyM: 6, updatedAt: Date.now() }

      let run = runs.find(r => r.id === bus.activeRunId && r.busId === bus.id) ?? null
      let busNow = bus
      // First tick: start from where the loop says the shuttle is (a real phone gets the same help via "Where are you?").
      if (!s.started || !run) {
        s.started = true
        if (!run) {
          const init = initialRun(pos.atStop ? { bus, date, nowMin, at: pos.atStop, stops: live } : { bus, date, nowMin, toward: pos.towardZone, stops: live })
          run = init.run; s.geofence = init.geofence
          busNow = { ...bus, runSeq: init.seq }
          await store.set('runs', run.id, { ...run, isSimulated: true })
        }
      }
      const out = processBusFix({ bus: busNow, fix, run, stops: live, geofence: s.geofence, nowMin, nowMs, date, rules })
      s.geofence = out.geofence
      await store.update('buses', bus.id, { ...out.busPatch, isSimulated: true, ...(run && !out.busPatch.activeRunId ? { activeRunId: run.id } : {}) })
      for (const r of out.runUpserts) await store.set('runs', r.id, { ...r, isSimulated: true })
      for (const e of out.events) await store.add('events', { ...e, isSimulated: true })
    }
  }
}
