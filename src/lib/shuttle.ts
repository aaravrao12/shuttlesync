// Shuttle logic for Plano Senior's real setup: ONE continuous loop between the Building A loop and the Building H loop.
// No timetable, no choice of bus. This file answers four questions, all with plain arithmetic:
//   1. Does my next class need the shuttle?              → shuttleNeed / planDay
//   2. Where is each shuttle and when can I board?       → shuttleWhere / etaToBoard
//   3. Will I make it?                                   → willIMakeIt
//   4. If the ride is slow, am I excused?                → rideAssessment
import type { Building, BellPeriod, Bus, Run, ScheduleEntry, ShuttleZone, Stop } from '@/types'
import { haversineM } from './geofence'
import { DEFAULT_SPEED_MPS, MAX_SPEED_MPS, MIN_SPEED_MPS } from './eta'

export interface ShuttleRules {
  /** typical one-way ride, minutes */
  normalRideMin: number
  /** minutes beyond normal before a rider is excused */
  delayThresholdMin: number
  /** typical wait at a stop, minutes */
  dwellMin: number
  walkToStopMin: number
  walkFromStopMin: number
  rainStopActive: boolean
}

export const DEFAULT_RULES: ShuttleRules = { normalRideMin: 5, delayThresholdMin: 3, dwellMin: 2, walkToStopMin: 3, walkFromStopMin: 2, rainStopActive: false }

/** Pick only the rule fields out of an app-settings object (missing values fall back to the defaults). */
export function rulesFrom(s?: Partial<ShuttleRules> | null): ShuttleRules {
  return {
    normalRideMin: s?.normalRideMin ?? DEFAULT_RULES.normalRideMin,
    delayThresholdMin: s?.delayThresholdMin ?? DEFAULT_RULES.delayThresholdMin,
    dwellMin: s?.dwellMin ?? DEFAULT_RULES.dwellMin,
    walkToStopMin: s?.walkToStopMin ?? DEFAULT_RULES.walkToStopMin,
    walkFromStopMin: s?.walkFromStopMin ?? DEFAULT_RULES.walkFromStopMin,
    rainStopActive: s?.rainStopActive ?? DEFAULT_RULES.rainStopActive,
  }
}

/** "Cutting it close" if you would arrive with fewer than this many minutes to spare. */
export const CUT_CLOSE_MIN = 3
/** A shuttle whose phone has not reported for this long is treated as offline (real clock, ms). */
export const OFFLINE_AFTER_MS = 60_000

export const otherZone = (z: ShuttleZone): ShuttleZone => (z === 'main' ? 'annex' : 'main')
export const zoneLabel = (z: ShuttleZone) => (z === 'main' ? 'Main campus' : 'Annex (H)')

/** Rain-only stops are ignored unless the admin switched the rain stop on. */
export const activeStops = (stops: Stop[], rules: ShuttleRules) => stops.filter(s => !s.rainOnly || rules.rainStopActive)

export const primaryStop = (zone: ShuttleZone, stops: Stop[]) => stops.find(s => s.zone === zone && s.kind === 'primary')

/** Which stop would a student in this building use right now? D and E walk indoors to the A loop, or use the rain stop in rain. */
export function stopFor(building: Building | undefined, stops: Stop[], rules: ShuttleRules): Stop | undefined {
  if (!building || building.zone === 'closed') return undefined
  const live = activeStops(stops, rules).filter(s => s.zone === building.zone)
  return live.find(s => s.kind === 'rain' && s.servesBuildingIds.includes(building.id)) ?? live.find(s => s.kind === 'primary') ?? live[0]
}

// ---- 1. Does my next class need the shuttle? ----------------------------------------------------------------

export interface ShuttleNeed { needs: boolean; fromZone?: ShuttleZone; toZone?: ShuttleZone }

export function shuttleNeed(from?: Building, to?: Building): ShuttleNeed {
  if (!from || !to || from.zone === 'closed' || to.zone === 'closed') return { needs: false }
  if (from.zone === to.zone) return { needs: false }
  return { needs: true, fromZone: from.zone, toZone: to.zone }
}

export interface Transition {
  toPeriod: number
  fromBuildingId: string
  toBuildingId: string
  prevEnd: number
  /** bell time of the class the student must reach (school minutes) */
  nextBell: number
  needsShuttle: boolean
  fromZone?: ShuttleZone
  toZone?: ShuttleZone
  boardStopId?: string
  destStopId?: string
  message: string
}

/** One entry per passing period where the student has classes in consecutive periods. */
export function planDay(schedule: ScheduleEntry[], bell: BellPeriod[], buildings: Building[], stops: Stop[], rules: ShuttleRules): Transition[] {
  const byId = new Map(buildings.map(b => [b.id, b]))
  const entries = [...schedule].sort((a, b) => a.period - b.period)
  const out: Transition[] = []
  for (let k = 0; k < entries.length - 1; k++) {
    const cur = entries[k], next = entries[k + 1]
    if (next.period !== cur.period + 1) continue // free period / lunch: nothing to plan
    const curBell = bell.find(b => b.period === cur.period), nextBell = bell.find(b => b.period === next.period)
    if (!curBell || !nextBell) continue
    const from = byId.get(cur.buildingId), to = byId.get(next.buildingId)
    const need = shuttleNeed(from, to)
    const board = need.needs ? stopFor(from, stops, rules) : undefined
    const dest = need.needs ? stopFor(to, stops, rules) : undefined
    out.push({
      toPeriod: next.period, fromBuildingId: cur.buildingId, toBuildingId: next.buildingId, prevEnd: curBell.end, nextBell: nextBell.start,
      needsShuttle: need.needs, fromZone: need.fromZone, toZone: need.toZone, boardStopId: board?.id, destStopId: dest?.id,
      message: need.needs
        ? `${board?.name ?? zoneLabel(need.fromZone!)} to ${dest?.name ?? zoneLabel(need.toZone!)}`
        : from && to && from.zone === 'main' && from.id !== to.id ? 'No shuttle needed: walk indoors.' : 'No shuttle needed.',
    })
  }
  return out
}

/** The passing period that matters right now: the first whose class bell has not rung (plus a 2-minute grace). */
export const currentTransition = (plans: Transition[], nowMin: number) => plans.find(p => nowMin < p.nextBell + 2)

// ---- 2. Where is each shuttle, and when can I board? ----------------------------------------------------------

export type ShuttleWhere =
  | { kind: 'offline' }
  | { kind: 'unknown' }
  | { kind: 'at_stop'; stop: Stop }
  | { kind: 'en_route'; fromZone: ShuttleZone; toZone: ShuttleZone }

export function shuttleWhere(bus: Bus, run: Run | null | undefined, stops: Stop[], nowRealMs: number): ShuttleWhere {
  if (!bus.lastLocation || nowRealMs - bus.lastLocation.updatedAt > OFFLINE_AFTER_MS) return { kind: 'offline' }
  const at = bus.currentStopId ? stops.find(s => s.id === bus.currentStopId) : undefined
  if (at) return { kind: 'at_stop', stop: at }
  if (run && run.status === 'in_transit') return { kind: 'en_route', fromZone: run.fromZone, toZone: run.toZone }
  return { kind: 'unknown' }
}

/** Speed used for ETAs: the shuttle's recent average, or the speed implied by the normal ride over the loop distance. */
export function loopSpeedMps(bus: Bus | undefined, stops: Stop[], rules: ShuttleRules): number {
  const a = primaryStop('main', stops), h = primaryStop('annex', stops)
  const implied = a && h ? haversineM(a, h) / (rules.normalRideMin * 60) : DEFAULT_SPEED_MPS
  const v = bus?.avgSpeedMps ?? implied
  return Math.min(MAX_SPEED_MPS, Math.max(MIN_SPEED_MPS, v))
}

/** Minutes until a moving shuttle reaches `dest`; by distance when we have its GPS, otherwise by the clock. */
export function remainingRideMin(bus: Bus, run: Run | null | undefined, dest: Stop, stops: Stop[], rules: ShuttleRules, nowMin: number): number {
  if (bus.lastLocation) return Math.max(0.2, haversineM(bus.lastLocation, dest) / loopSpeedMps(bus, stops, rules) / 60)
  const elapsed = run?.departedAt != null ? nowMin - run.departedAt : 0
  return Math.max(0.2, rules.normalRideMin - elapsed)
}

/** The stop in `zone` that a shuttle in transit is closest to (so the rain stop counts when it is active). */
export function nearestStopInZone(zone: ShuttleZone, stops: Stop[], from?: { lat: number; lng: number }): Stop | undefined {
  const z = stops.filter(s => s.zone === zone)
  if (!from || z.length < 2) return z.find(s => s.kind === 'primary') ?? z[0]
  return [...z].sort((a, b) => haversineM(from, a) - haversineM(from, b))[0]
}

/** Minutes until a shuttle can be boarded at `board` (0 = it is boarding there now). null = no live signal. */
export function etaToBoard(a: { bus: Bus; run?: Run | null; board: Stop; stops: Stop[]; rules: ShuttleRules; nowMin: number; nowRealMs: number }): number | null {
  const w = shuttleWhere(a.bus, a.run, a.stops, a.nowRealMs)
  if (w.kind === 'offline' || w.kind === 'unknown') return null
  const { rules, nowMin } = a
  if (w.kind === 'at_stop') {
    if (w.stop.zone === a.board.zone) return 0
    // dwelling at the other end: finish waiting, then ride over
    const waited = a.run?.status === 'boarding' ? nowMin - a.run.boardingAt : 0
    return Math.max(0, rules.dwellMin - waited) + rules.normalRideMin
  }
  if (w.toZone === a.board.zone) return remainingRideMin(a.bus, a.run, a.board, a.stops, rules, nowMin)
  // heading away from my end: reach the far stop, wait, ride back
  const far = nearestStopInZone(w.toZone, a.stops, a.bus.lastLocation) ?? a.board
  return remainingRideMin(a.bus, a.run, far, a.stops, rules, nowMin) + rules.dwellMin + rules.normalRideMin
}

/** When will this run (or the one a rider is on) reach the other end? school minutes. */
export function projectedArrival(a: { run: Run; bus?: Bus; stops: Stop[]; rules: ShuttleRules; nowMin: number }): number {
  const { run, bus, rules, nowMin } = a
  if (run.arrivedAt != null) return run.arrivedAt
  if (run.status === 'in_transit') {
    const dest = bus ? nearestStopInZone(run.toZone, a.stops, bus.lastLocation) : primaryStop(run.toZone, a.stops)
    // reportedDelayMin = a dispatch "this shuttle is stuck/slow" heads-up; the demo's "Make shuttle slow" button sets it too
    if (bus && dest) return nowMin + remainingRideMin(bus, run, dest, a.stops, rules, nowMin) + (bus.reportedDelayMin ?? 0)
    return Math.max(nowMin, (run.departedAt ?? nowMin) + rules.normalRideMin)
  }
  // still boarding: finish the wait at the stop, then a normal ride, plus any dispatch heads-up
  const waitLeft = Math.max(0, rules.dwellMin - (nowMin - run.boardingAt))
  return nowMin + waitLeft + rules.normalRideMin + (bus?.reportedDelayMin ?? 0)
}

/** The arrival we would have expected if nothing were slow: used to measure how late a run is. */
export const expectedArrival = (run: Run, rules: ShuttleRules) =>
  run.status === 'in_transit' && run.departedAt != null ? run.departedAt + rules.normalRideMin : run.boardingAt + rules.dwellMin + rules.normalRideMin

// ---- 3. Will I make it? ------------------------------------------------------------------------------------------

export type Verdict = 'on_track' | 'close' | 'late' | 'unknown'

export interface MakeIt { verdict: Verdict; slackMin: number | null; arriveMin: number | null; boardInMin: number | null }

/**
 * Time you have (now → bell) vs time you need:
 *   walk to the stop (or wait for the shuttle, whichever is longer) + normal ride + walk to class.
 * Slack ≥ 3 min → on track; 0–3 → cutting it close; < 0 → likely late (you are excused if the shuttle is slow).
 */
export function willIMakeIt(a: { nowMin: number; nextBell: number; etaBoardMin: number | null; rules: ShuttleRules }): MakeIt {
  if (a.etaBoardMin == null) return { verdict: 'unknown', slackMin: null, arriveMin: null, boardInMin: null }
  const boardIn = Math.max(a.etaBoardMin, a.rules.walkToStopMin)
  const arrive = a.nowMin + boardIn + a.rules.normalRideMin + a.rules.walkFromStopMin
  const slack = a.nextBell - arrive
  return { verdict: slack >= CUT_CLOSE_MIN ? 'on_track' : slack >= 0 ? 'close' : 'late', slackMin: slack, arriveMin: arrive, boardInMin: boardIn }
}

// ---- 4. Excused for a slow ride? ---------------------------------------------------------------------------------

export interface RideAssessment { rideMin: number; excused: boolean; reason: 'slow_ride' | 'misses_bell' | 'ok'; extraMin: number }

/**
 * No schedule to compare against, so we measure the rider's own ride: scan time → arrival at the other end.
 * Excused if the ride took longer than normal + threshold, OR the shuttle reaches the other end after the class bell.
 * Works the same on a projected arrival, which is how "excused" appears before the shuttle has arrived.
 */
export function rideAssessment(a: { scanMin: number; arriveMin: number; nextBell: number; rules: ShuttleRules }): RideAssessment {
  const rideMin = a.arriveMin - a.scanMin
  const slow = rideMin > a.rules.normalRideMin + a.rules.delayThresholdMin
  const missesBell = a.arriveMin > a.nextBell
  return { rideMin, excused: slow || missesBell, reason: slow ? 'slow_ride' : missesBell ? 'misses_bell' : 'ok', extraMin: Math.max(0, Math.round(rideMin - a.rules.normalRideMin)) }
}
