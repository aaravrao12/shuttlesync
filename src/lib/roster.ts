// Roster builder: for one teacher + one class period, who is where? Pure function → unit tested.
// Teachers read the SAME statuses students see (studentStatus.ts) — one source of truth, no divergence.
import type { AttendanceDoc, AttendanceStatus, BellPeriod, Building, Bus, Checkin, LiveStatus, Override, Run, ScheduleEntry, Stop, Student } from '@/types'
import { projectedArrival, rideAssessment, shuttleNeed, type RideAssessment, type ShuttleNeed, type ShuttleRules } from './shuttle'
import { resolveStatus } from './studentStatus'

export interface RosterRow {
  student: Student
  entry: ScheduleEntry
  /** building of the previous class (where the student is coming from), if any */
  fromBuildingId?: string
  need: ShuttleNeed
  checkin: Checkin | null
  run: Run | null
  status: LiveStatus
  /** actual (or projected) arrival at the other end, school minutes */
  projectedArrive: number | null
  assessment: RideAssessment | null
  /** latest teacher decision, if any */
  decision: Override | null
}

export interface RosterCounts {
  total: number
  arrived: number
  onTheWay: number
  excused: number
  unverified: number
  notCheckedIn: number
  waiting: number
  noShuttle: number
  /** teacher marked tardy/absent */
  markedAbsent: number
}

export interface RosterInput {
  teacherId: string
  period: number
  students: Student[]
  bell: BellPeriod[]
  buildings: Building[]
  stops: Stop[]
  buses: Bus[]
  /** today's runs only */
  runs: Run[]
  checkins: Checkin[]
  attendance: AttendanceDoc | null
  nowMin: number
  rules: ShuttleRules
}

/** Map a teacher's decision onto the status vocabulary so counters and chips stay consistent. */
export function decisionToStatus(d: AttendanceStatus): LiveStatus | null {
  switch (d) {
    case 'present': return 'arrived'
    case 'excused_bus_late': return 'excused_bus_late'
    case 'in_transit': return 'on_the_way'
    default: return null // tardy / absent / unknown are teacher outcomes, not live statuses
  }
}

/**
 * A check-in belongs to this passing period if it was scanned shortly before the previous class ended (kids leave early)
 * up to a bit after this class started, and the run was heading to the zone of this class.
 */
export function checkinForTransition(student: string, checkins: Checkin[], runs: Run[], toZone: string | undefined, prevEnd: number, bellStart: number): Checkin | null {
  const byId = new Map(runs.map(r => [r.id, r]))
  const mine = checkins.filter(c => c.studentId === student && c.scannedAtSchoolMin >= prevEnd - 5 && c.scannedAtSchoolMin <= bellStart + 20 && byId.get(c.runId)?.toZone === toZone)
  return mine.sort((a, b) => b.scannedAt - a.scannedAt)[0] ?? null
}

export function buildRoster(i: RosterInput): { rows: RosterRow[]; counts: RosterCounts; lateBuses: { bus: string; minutes: number }[] } {
  const byBuilding = new Map(i.buildings.map(b => [b.id, b]))
  const busById = new Map(i.buses.map(b => [b.id, b]))
  const runById = new Map(i.runs.map(r => [r.id, r]))
  const bellFor = (p: number) => i.bell.find(b => b.period === p)
  const latestDecision = new Map<string, Override>()
  for (const o of i.attendance?.overrides ?? []) latestDecision.set(o.studentId, o)

  const rows: RosterRow[] = []
  for (const student of i.students) {
    const entry = student.schedule.find(e => e.period === i.period && e.teacherId === i.teacherId)
    if (!entry) continue
    const prev = student.schedule.find(e => e.period === i.period - 1)
    const prevBell = bellFor(i.period - 1), thisBell = bellFor(i.period)
    const need: ShuttleNeed = prev && prevBell && thisBell ? shuttleNeed(byBuilding.get(prev.buildingId), byBuilding.get(entry.buildingId)) : { needs: false }
    const checkin = need.needs && prevBell && thisBell ? checkinForTransition(student.id, i.checkins, i.runs, need.toZone, prevBell.end, thisBell.start) : null
    const run = checkin ? runById.get(checkin.runId) ?? null : null

    let projected: number | null = null
    let assessment: RideAssessment | null = null
    if (run && checkin && thisBell) {
      projected = projectedArrival({ run, bus: busById.get(run.busId), stops: i.stops, rules: i.rules, nowMin: i.nowMin })
      assessment = rideAssessment({ scanMin: checkin.scannedAtSchoolMin, arriveMin: projected, nextBell: thisBell.start, rules: i.rules })
    }
    const decision = latestDecision.get(student.id) ?? null
    const status = resolveStatus({
      needsShuttle: need.needs, checkin, runCompleted: run?.status === 'completed', rideExcused: assessment?.excused,
      nextBell: thisBell?.start ?? 0, nowMin: i.nowMin, override: decision ? decisionToStatus(decision.to) : null,
    })
    rows.push({ student, entry, fromBuildingId: prev?.buildingId, need, checkin, run, status, projectedArrive: projected, assessment, decision })
  }

  const counts: RosterCounts = { total: rows.length, arrived: 0, onTheWay: 0, excused: 0, unverified: 0, notCheckedIn: 0, waiting: 0, noShuttle: 0, markedAbsent: 0 }
  for (const r of rows) {
    if (r.decision && decisionToStatus(r.decision.to) === null && r.decision.to !== 'unknown') { counts.markedAbsent++; continue }
    switch (r.status) {
      case 'arrived': counts.arrived++; break
      case 'on_the_way': counts.onTheWay++; break
      case 'excused_bus_late': counts.excused++; break
      case 'unverified': counts.unverified++; break
      case 'not_checked_in': counts.notCheckedIn++; break
      case 'waiting': counts.waiting++; break
      case 'no_shuttle': counts.noShuttle++; break
    }
  }

  // Which shuttles slowed riders down, and by how much beyond a normal ride (only shuttles that excused someone).
  const late = new Map<string, number>()
  for (const r of rows) {
    if (r.status === 'excused_bus_late' && r.run && r.assessment && !r.decision) {
      const bus = busById.get(r.run.busId)
      if (bus) late.set(bus.number, Math.max(late.get(bus.number) ?? 0, Math.max(1, r.assessment.extraMin)))
    }
  }
  return { rows, counts, lateBuses: [...late].map(([bus, minutes]) => ({ bus, minutes })) }
}

/** Final per-student record saved with the approved attendance note. */
export function recordsFromRows(rows: RosterRow[]): Record<string, AttendanceStatus> {
  const out: Record<string, AttendanceStatus> = {}
  for (const r of rows) {
    if (r.decision) { out[r.student.id] = r.decision.to; continue }
    out[r.student.id] =
      r.status === 'arrived' || r.status === 'no_shuttle' ? 'present'
      : r.status === 'excused_bus_late' ? 'excused_bus_late'
      : r.status === 'on_the_way' || r.status === 'waiting' ? 'in_transit'
      : 'unknown'
  }
  return out
}

export const attendanceDocId = (date: string, period: number, teacherId: string) => `${date}_p${period}_${teacherId}`
