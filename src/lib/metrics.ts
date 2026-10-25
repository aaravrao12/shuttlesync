// Pilot metrics: pure functions over logged data → the numbers on the Results page and in the AI note.
// Keeping these pure (data in, number out) is what lets us unit test them and trace every slide to a row.
import type { AnalyticsEvent, AttendanceDoc, Checkin, Feedback, Run, UsabilityTest, SusResponse } from '@/types'
import { median } from './time'

export interface Rate { value: number | null; n: number }
const rate = (num: number, den: number): Rate => ({ value: den ? num / den : null, n: den })

export function scanStats(checkins: Checkin[]) {
  const qr = checkins.filter(c => c.method === 'qr')
  const verified = qr.filter(c => c.verified).length
  return {
    total: checkins.length,
    qr: qr.length,
    kiosk: checkins.filter(c => c.method === 'kiosk').length,
    manual: checkins.filter(c => c.method === 'teacher_manual').length,
    verificationRate: rate(verified, qr.length),
    unverified: qr.length - verified,
  }
}

/** Unverified scans a teacher later accepted as present. These are the "false flags" the spec asks us to track. */
export function falseFlagRate(checkins: Checkin[], attendance: AttendanceDoc[]): Rate {
  const unverified = checkins.filter(c => c.method === 'qr' && !c.verified)
  if (!unverified.length) return { value: null, n: 0 }
  let cleared = 0
  for (const c of unverified) {
    const cleared1 = attendance.some(a => a.overrides.some(o => o.studentId === c.studentId && (o.to === 'present' || o.to === 'excused_bus_late')))
    if (cleared1) cleared++
  }
  return rate(cleared, unverified.length)
}

/** Median seconds between scan_attempt and scan_success inside the same session. */
export function medianCheckinSeconds(events: AnalyticsEvent[]): number | null {
  const bySession = new Map<string, { attempt?: number; success?: number }>()
  for (const e of [...events].sort((a, b) => a.createdAt - b.createdAt)) {
    const s = bySession.get(e.sessionId) ?? {}
    if (e.type === 'scan_attempt' && s.attempt == null) s.attempt = e.createdAt
    if (e.type === 'scan_success' && s.attempt != null && s.success == null) s.success = e.createdAt
    bySession.set(e.sessionId, s)
  }
  const secs = [...bySession.values()].filter(s => s.attempt != null && s.success != null).map(s => (s.success! - s.attempt!) / 1000)
  return median(secs)
}

/**
 * Ride-time stats from finished runs. There is no timetable to be "late" against, so the unit is the ride itself:
 * departure from one stop → arrival at the other. A run is "slow" if it took longer than normal + threshold.
 */
export function delayStats(runs: Run[], normalRideMin = 5, thresholdMin = 3) {
  const done = runs.filter(r => r.status === 'completed' && r.arrivedAt != null && r.departedAt != null)
  const rides = done.map(r => (r.arrivedAt as number) - (r.departedAt as number))
  const slow = rides.filter(m => m > normalRideMin + thresholdMin)
  return {
    n: done.length,
    averageRideMin: rides.length ? rides.reduce((a, b) => a + b, 0) / rides.length : null,
    /** average minutes beyond a normal ride (never negative) */
    averageDelayMin: rides.length ? rides.reduce((a, m) => a + Math.max(0, m - normalRideMin), 0) / rides.length : null,
    lateTrips: slow.length,
    slowRuns: slow.length,
    onTimeRate: rate(done.length - slow.length, done.length),
  }
}

/** Students whose record ended as excused_bus_late — would have been tardy without ShuttleSync. */
export function autoExcusedCount(attendance: AttendanceDoc[]): number {
  return attendance.reduce((n, a) => n + Object.values(a.records).filter(s => s === 'excused_bus_late').length, 0)
}

export function overrideCount(attendance: AttendanceDoc[]): number {
  return attendance.reduce((n, a) => n + a.overrides.length, 0)
}

export function taskStats(tests: UsabilityTest[], round: 1 | 2) {
  const r = tests.filter(t => t.round === round)
  const ok = r.filter(t => t.success)
  return {
    n: r.length,
    successRate: rate(ok.length, r.length),
    medianMs: median(ok.map(t => t.durationMs)),
  }
}

/** Standard SUS: odd items score (answer-1), even items score (5-answer), sum × 2.5 → 0–100. */
export function susScore(answers: number[]): number {
  if (answers.length !== 10) throw new Error('SUS needs exactly 10 answers')
  const sum = answers.reduce((acc, a, i) => acc + (i % 2 === 0 ? a - 1 : 5 - a), 0)
  return sum * 2.5
}

export function susAverage(rs: SusResponse[], round: 1 | 2): { value: number | null; n: number } {
  const r = rs.filter(x => x.round === round)
  return { value: r.length ? r.reduce((a, b) => a + b.score, 0) / r.length : null, n: r.length }
}

export function feedbackStats(fb: Feedback[]) {
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  return { n: fb.length, ease: avg(fb.map(f => f.easeScore).filter(Boolean)), wouldUse: avg(fb.map(f => f.wouldUse).filter(Boolean)) }
}

export function delta(before: number | null, after: number | null): { abs: number; pct: number | null } | null {
  if (before == null || after == null) return null
  return { abs: after - before, pct: before !== 0 ? ((after - before) / Math.abs(before)) * 100 : null }
}

/** Estimated teacher minutes saved. The formula is shown on the Reports page; the assumption is editable there. */
export const MINUTES_PER_LATE_BUS_DISPUTE = 2 // ASSUMPTION — replace after interviewing teachers (see TESTING.md)
export const teacherMinutesSaved = (autoExcused: number, perDispute = MINUTES_PER_LATE_BUS_DISPUTE) => autoExcused * perDispute

/** Keep only rows that count as real pilot data. Demo rows are excluded unless asked for. */
export function realOnly<T extends { isPilot?: boolean; isSimulated?: boolean }>(rows: T[], includeSimulated = false): T[] {
  return rows.filter(r => (includeSimulated ? true : !r.isSimulated) && (includeSimulated ? true : r.isPilot !== false))
}
