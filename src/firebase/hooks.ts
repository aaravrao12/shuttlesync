// React bindings for the store. One shared listener per collection (ref-counted),
// so ten components reading `buses` cost one subscription, not ten (matters for the Firestore free tier).
import { useEffect, useMemo, useState, useSyncExternalStore, useCallback } from 'react'
import type { AppSettings, Bus, BellPeriod, Building, Checkin, Run, ShuttleEvent, Stop, Student, Teacher, AttendanceDoc } from '@/types'
import { DEFAULT_RULES, rulesFrom, type ShuttleRules } from '@/lib/shuttle'
import { getStore, type Doc } from './store'
import { clock } from '@/lib/clock'
import { DEFAULT_TZ } from '@/lib/time'

interface Shared { rows: any[]; ready: boolean; subs: Set<() => void>; unsub: (() => void) | null }
const shared = new Map<string, Shared>()
const EMPTY: any[] = []

function ensure(coll: string): Shared {
  let s = shared.get(coll)
  if (!s) {
    s = { rows: EMPTY, ready: false, subs: new Set(), unsub: null }
    shared.set(coll, s)
    const sh = s
    sh.unsub = getStore().watchCollection(coll, rows => { sh.rows = rows; sh.ready = true; sh.subs.forEach(f => f()) })
  }
  return s
}

function subscribe(coll: string) {
  return (fn: () => void) => {
    const s = ensure(coll)
    s.subs.add(fn)
    return () => {
      s.subs.delete(fn)
      if (!s.subs.size) { s.unsub?.(); shared.delete(coll) }
    }
  }
}

export function useCollection<T = any>(coll: string): { rows: Doc<T>[]; ready: boolean } {
  const sub = useMemo(() => subscribe(coll), [coll])
  const rows = useSyncExternalStore(sub, () => ensure(coll).rows, () => EMPTY) as Doc<T>[]
  const ready = useSyncExternalStore(sub, () => ensure(coll).ready, () => false)
  return { rows, ready }
}

export function useDocument<T = any>(coll: string, id: string | null | undefined): Doc<T> | null {
  const { rows } = useCollection<T>(coll)
  return useMemo(() => (id ? rows.find(r => r.id === id) ?? null : null), [rows, id])
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'main', mode: 'demo', analyticsOff: false,
  clock: { anchorRealMs: 0, anchorVirtualMs: 0, speed: 1 },
  simDelays: {}, simulatorOn: false, realBusIds: [],
  ...DEFAULT_RULES,
}

/** The shuttle rules (normal ride, delay threshold, rain stop, ...) from the shared settings. */
export function useRules(): ShuttleRules {
  const s = useSettings()
  return useMemo(() => rulesFrom(s), [s.normalRideMin, s.delayThresholdMin, s.dwellMin, s.walkToStopMin, s.walkFromStopMin, s.rainStopActive])
}

export function useSettings(): AppSettings {
  const { rows } = useCollection<AppSettings>('settings')
  const s = rows.find(r => r.id === 'main')
  return useMemo(() => ({ ...DEFAULT_SETTINGS, ...(s ?? {}), clock: { ...DEFAULT_SETTINGS.clock, ...(s?.clock ?? {}) } }) as AppSettings, [s])
}

/** Keep the global clock in sync with the shared demo-clock setting. Mount once near the root. */
export function useClockSync() {
  const s = useSettings()
  useEffect(() => { clock.configure(s.clock, DEFAULT_TZ) }, [s.clock.anchorRealMs, s.clock.anchorVirtualMs, s.clock.speed])
}

/** Re-render every `ms` with the current school-clock time. */
export function useNow(ms = 1000): { minutes: number; date: string; nowMs: number } {
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force(x => x + 1), ms)
    const off = clock.subscribe(() => force(x => x + 1))
    return () => { clearInterval(id); off() }
  }, [ms])
  return { minutes: clock.minutes(), date: clock.date(), nowMs: clock.nowMs() }
}

/** Everything the screens need, in one call. */
export function useCampus() {
  const buildings = useCollection<Building>('buildings')
  const stops = useCollection<Stop>('stops')
  const buses = useCollection<Bus>('buses')
  const bell = useCollection<BellPeriod>('bellSchedule')
  const runs = useCollection<Run>('runs')
  const ready = buildings.ready && stops.ready && buses.ready && bell.ready && runs.ready
  const bellSorted = useMemo(() => [...bell.rows].sort((a, b) => a.period - b.period), [bell.rows])
  const sortedBuses = useMemo(() => [...buses.rows].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })), [buses.rows])
  return {
    ready,
    empty: ready && buildings.rows.length === 0,
    buildings: buildings.rows, stops: stops.rows, buses: sortedBuses,
    bell: bellSorted, runs: runs.rows,
    stopById: useMemo(() => new Map(stops.rows.map(s => [s.id, s])), [stops.rows]),
    buildingById: useMemo(() => new Map(buildings.rows.map(b => [b.id, b])), [buildings.rows]),
    busById: useMemo(() => new Map(buses.rows.map(b => [b.id, b])), [buses.rows]),
  }
}

export function usePeople() {
  const students = useCollection<Student>('students')
  const teachers = useCollection<Teacher>('teachers')
  return { students: students.rows, teachers: teachers.rows, ready: students.ready && teachers.ready }
}

export function useLive() {
  const checkins = useCollection<Checkin>('checkins')
  const events = useCollection<ShuttleEvent>('events')
  const attendance = useCollection<AttendanceDoc>('attendance')
  const sortedEvents = useMemo(() => [...events.rows].sort((a, b) => b.createdAt - a.createdAt), [events.rows])
  return { checkins: checkins.rows, events: sortedEvents, attendance: attendance.rows }
}

/** Fire-and-forget writer helpers with stable identities. */
export function useStoreActions() {
  const store = getStore()
  return useMemo(() => ({
    set: (c: string, id: string, d: object) => store.set(c, id, d),
    update: (c: string, id: string, d: object) => store.update(c, id, d),
    add: (c: string, d: object) => store.add(c, d),
    remove: (c: string, id: string) => store.remove(c, id),
  }), [store])
}

export function useStoreMode() {
  const store = getStore()
  return { mode: store.mode, fallbackReason: store.fallbackReason }
}

export const useStable = useCallback
