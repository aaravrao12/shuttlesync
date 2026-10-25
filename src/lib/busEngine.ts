// Shuttle engine: turns one GPS fix from a shuttle into the state changes everyone else watches.
// The SAME function is used by a real shuttle phone and by the demo simulator, so the demo exercises
// the real logic (geofence → run detection → ETA → delay → events), not a fake.
//
// There is no timetable. A "run" is one one-way trip, detected purely from where the shuttle is:
//   enters a stop            → the previous run ENDS (if it was heading here) and a new run opens in "boarding"
//   leaves that stop         → the boarding run STARTS (in_transit)
//   returns to the zone it just left (e.g. A loop → rain stop) → that was a hop inside one zone, not a real run: back to boarding
import type { Bus, BusLocation, BusStatus, Run, ShuttleEvent, Stop } from '@/types'
import { GeofenceState, initialGeofence, stepGeofence } from './geofence'
import { rollingAvgSpeed } from './eta'
import { expectedArrival, nearestStopInZone, otherZone, projectedArrival, remainingRideMin, type ShuttleRules } from './shuttle'

export interface EngineInput {
  bus: Bus
  fix: BusLocation
  /** the shuttle's current run (bus.activeRunId), if any */
  run: Run | null
  /** ACTIVE stops only (the rain stop is excluded unless the admin turned it on) */
  stops: Stop[]
  geofence: GeofenceState
  nowMin: number
  nowMs: number
  date: string
  rules: ShuttleRules
}

export interface EngineOutput {
  busPatch: Partial<Bus>
  /** runs to create or update (full documents; ids are deterministic) */
  runUpserts: Run[]
  events: Omit<ShuttleEvent, 'id'>[]
  geofence: GeofenceState
}

export const runId = (date: string, busId: string, seq: number) => `${date}_${busId}_${seq}`

export function processBusFix(i: EngineInput): EngineOutput {
  const label = `Shuttle ${i.bus.number}`
  const events: EngineOutput['events'] = []
  const upserts = new Map<string, Run>()
  let seq = i.bus.runSeq ?? 0
  let cur: Run | null = i.run ? { ...i.run } : null

  const save = (r: Run) => { cur = r; upserts.set(r.id, { ...r }) }
  const open = (stop: Stop, status: 'boarding' | 'in_transit' = 'boarding') => {
    seq += 1
    save({
      id: runId(i.date, i.bus.id, seq), busId: i.bus.id, date: i.date, fromZone: stop.zone, toZone: otherZone(stop.zone), fromStopId: stop.id,
      status, boardingAt: i.nowMin, departedAt: status === 'in_transit' ? i.nowMin : null, isSimulated: i.bus.isSimulated,
    })
  }

  const geo = stepGeofence(i.geofence, i.fix, i.stops, i.nowMs)
  const avg = rollingAvgSpeed(i.bus.avgSpeedMps, i.fix.speedMps)
  const stopName = (id: string) => i.stops.find(s => s.id === id)?.name ?? id

  for (const ev of geo.events) {
    const stop = i.stops.find(s => s.id === ev.stopId)
    if (!stop) continue
    if (ev.type === 'bus_arrived') {
      events.push({ type: 'bus_arrived', busId: i.bus.id, stopId: stop.id, message: `${label} arrived at ${stopName(stop.id)}.`, createdAt: i.nowMs })
      const c = cur as Run | null
      if (c && c.status === 'in_transit') {
        if (stop.zone === c.toZone) { save({ ...c, status: 'completed', arrivedAt: i.nowMin, arrivedStopId: stop.id }); open(stop) }
        else if (stop.zone === c.fromZone) save({ ...c, status: 'boarding', fromStopId: stop.id, departedAt: null }) // hop inside the zone
      } else if (c && c.status === 'boarding') {
        if (stop.zone === c.fromZone) save({ ...c, fromStopId: stop.id })
        else { save({ ...c, status: 'completed' }); open(stop) } // missed a departure event: close it out and start fresh
      } else open(stop)
    } else {
      events.push({ type: 'bus_departed', busId: i.bus.id, stopId: stop.id, message: `${label} left ${stopName(stop.id)}.`, createdAt: i.nowMs })
      const c = cur as Run | null
      if (c && c.status === 'boarding' && stop.zone === c.fromZone) save({ ...c, status: 'in_transit', departedAt: i.nowMin, fromStopId: stop.id })
      else if (!c || c.status === 'completed') open(stop, 'in_transit')
    }
  }

  // ---- shuttle-level state ------------------------------------------------------------------------
  const run = cur as Run | null
  let status: BusStatus = 'idle'
  let delayMinutes = 0
  let etaToNext: number | null = null
  let nextStopId: string | null = null
  if (run && run.status !== 'completed') {
    const busNow: Bus = { ...i.bus, lastLocation: i.fix, avgSpeedMps: avg }
    const proj = projectedArrival({ run, bus: busNow, stops: i.stops, rules: i.rules, nowMin: i.nowMin })
    delayMinutes = Math.max(0, Math.round((proj - expectedArrival(run, i.rules)) * 10) / 10)
    const dest = nearestStopInZone(run.toZone, i.stops, i.fix)
    nextStopId = dest?.id ?? null
    if (run.status === 'in_transit' && dest) etaToNext = Math.round(remainingRideMin(busNow, run, dest, i.stops, i.rules, i.nowMin) * 10) / 10
    status = delayMinutes > i.rules.delayThresholdMin ? 'delayed' : run.status === 'boarding' ? 'boarding' : 'in_transit'
  }

  // Announce a slow shuttle once, not on every GPS tick.
  const wasDelayed = i.bus.status === 'delayed'
  if (status === 'delayed' && !wasDelayed) {
    events.push({ type: 'bus_delayed', busId: i.bus.id, message: `${label} is running about ${Math.max(1, Math.round(delayMinutes))} min slow. Riders who checked in are excused automatically.`, createdAt: i.nowMs })
  } else if (status !== 'delayed' && wasDelayed && status !== 'idle') {
    events.push({ type: 'bus_recovered', busId: i.bus.id, message: `${label} is back to normal.`, createdAt: i.nowMs })
  }

  return {
    busPatch: {
      lastLocation: i.fix,
      avgSpeedMps: avg,
      status,
      currentStopId: geo.state.atStopId,
      nextStopId,
      etaToNextStop: etaToNext,
      delayMinutes,
      activeRunId: run && run.status !== 'completed' ? run.id : run?.id ?? null,
      runSeq: seq,
    },
    runUpserts: [...upserts.values()],
    events,
    geofence: geo.state,
  }
}

export const freshGeofence = initialGeofence

/**
 * Tell the engine where a shuttle phone is when it starts sharing (a real phone may be switched on mid-loop).
 * "at" a stop → a boarding run at that stop; "toward" a zone → a run already in transit.
 */
export function initialRun(a: { bus: Bus; date: string; nowMin: number; at?: Stop; toward?: 'main' | 'annex'; stops: Stop[] }): { run: Run; geofence: GeofenceState; seq: number } {
  const seq = (a.bus.runSeq ?? 0) + 1
  if (a.at) {
    return {
      seq, geofence: { atStopId: a.at.id, pending: null },
      run: { id: runId(a.date, a.bus.id, seq), busId: a.bus.id, date: a.date, fromZone: a.at.zone, toZone: otherZone(a.at.zone), fromStopId: a.at.id, status: 'boarding', boardingAt: a.nowMin, isSimulated: a.bus.isSimulated },
    }
  }
  const to = a.toward ?? 'annex'
  const from = otherZone(to)
  const fromStop = a.stops.find(s => s.zone === from && s.kind === 'primary') ?? a.stops.find(s => s.zone === from)!
  return {
    seq, geofence: initialGeofence(),
    run: { id: runId(a.date, a.bus.id, seq), busId: a.bus.id, date: a.date, fromZone: from, toZone: to, fromStopId: fromStop.id, status: 'in_transit', boardingAt: a.nowMin, departedAt: a.nowMin, isSimulated: a.bus.isSimulated },
  }
}
