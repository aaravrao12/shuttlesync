// Turn the AI's reading of a timetable photo into Trip documents, with every row checked against the real campus.
// Rows we cannot map (unknown bus, unknown stop, no matching passing period) are shown to the admin as problems, never guessed.
// NOT USED: Plano Senior's shuttle is one continuous loop with no timetable, so the timetable photo import is switched off in Admin.
// The mapper is kept (and tested) in case a school with a real timetable needs it; it has its own trip type for that reason.
import type { BellPeriod, Bus, Stop, Building } from '@/types'
import type { TimetableExtraction } from './schemas'
import { parseClock } from '@/lib/time'

export interface LegacyTrip {
  id: string; busId: string; routeId: string; period: number; date: string; fromStopId: string; toStopId: string
  stops: { stopId: string; scheduled: number }[]; scheduledDepart: number; scheduledArrive: number; status: 'scheduled'; nextBell: number
}
type Trip = LegacyTrip

export interface MappedRow { raw: TimetableExtraction['trips'][number]; trip?: Trip; problem?: string }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

export function findStop(name: string, stops: Stop[], buildings: Building[]): Stop | undefined {
  const n = norm(name)
  return stops.find(s => norm(s.name) === n)
    ?? stops.find(s => { const b = buildings.find(x => s.servesBuildingIds.includes(x.id) && (norm(x.name) === n || norm(x.code) === n || n.endsWith(' ' + norm(x.code)) || n.includes(norm(x.name)))); return !!b && (norm(b.name) === n || norm(b.code) === n || n.endsWith(' ' + norm(b.code)) || n.includes(norm(b.name))) })
}

export function mapTimetable(x: TimetableExtraction, ctx: { buses: Bus[]; stops: Stop[]; buildings: Building[]; bell: BellPeriod[]; date: string }): MappedRow[] {
  const bell = [...ctx.bell].sort((a, b) => a.period - b.period)
  return x.trips.map(raw => {
    const bus = ctx.buses.find(b => norm(b.number) === norm(raw.busNumber))
    if (!bus) return { raw, problem: `Unknown bus "${raw.busNumber}"` }
    const from = findStop(raw.fromStop, ctx.stops, ctx.buildings), to = findStop(raw.toStop, ctx.stops, ctx.buildings)
    if (!from) return { raw, problem: `Unknown stop "${raw.fromStop}"` }
    if (!to) return { raw, problem: `Unknown stop "${raw.toStop}"` }
    let depart: number, arrive: number
    try { depart = parseClock(raw.depart); arrive = parseClock(raw.arrive) } catch { return { raw, problem: 'Could not read the times' } }
    if (arrive <= depart) return { raw, problem: 'Arrival is not after departure' }
    const k = bell.findIndex((b, i) => i > 0 && depart >= bell[i - 1].end - 3 && depart <= b.start)
    if (k < 0) return { raw, problem: 'Departure is not inside a passing period' }
    const next = bell[k]
    return {
      raw,
      trip: {
        id: `${ctx.date}_p${next.period}_${bus.id}`, busId: bus.id, routeId: '', period: next.period, date: ctx.date,
        fromStopId: from.id, toStopId: to.id, stops: [{ stopId: from.id, scheduled: depart }, { stopId: to.id, scheduled: arrive }],
        scheduledDepart: depart, scheduledArrive: arrive, status: 'scheduled', nextBell: next.start,
      },
    }
  })
}
