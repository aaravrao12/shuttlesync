// The one place a check-in is created, whether it came from a QR scan, the stop kiosk, or a teacher.
import type { Bus, Checkin, CheckinMethod, Run, Student } from '@/types'
import type { Store } from '@/firebase/store'
import { verifyCheckin, type QrPayload, type StudentFix, type VerifyResult } from '@/lib/verifyCheckin'

/**
 * Which run does a scan belong to? There is no timetable, so it is simply the shuttle's CURRENT run:
 * the one it is boarding for, or the one it is already on. (If the shuttle phone has not reported a run, there is nothing to attach to.)
 */
export function currentRunFor(bus: Pick<Bus, 'activeRunId' | 'id'>, runs: Run[]): Run | null {
  const r = runs.find(x => x.id === bus.activeRunId && x.busId === bus.id)
  return r && r.status !== 'completed' ? r : null
}

const shortName = (n: string) => { const p = n.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : n }

// Token windows and GPS freshness use the REAL clock (phones must agree with each other even when the demo clock is shifted);
// school-schedule fields use the school clock (nowMin / nowMs below).
export interface CheckinRequest {
  store: Store
  student: Student
  bus: Bus
  run: Run
  qr: QrPayload | null
  method: CheckinMethod
  studentFix: StudentFix | null
  nowMs: number
  nowMin: number
  existing: Checkin[]
  by?: string
  isPilot: boolean
  isSimulated: boolean
}

export async function submitCheckin(r: CheckinRequest): Promise<{ result: VerifyResult; checkin?: Checkin }> {
  let result: VerifyResult
  if (r.method === 'qr' && r.qr) {
    result = await verifyCheckin({ qr: r.qr, bus: r.bus, studentId: r.student.id, tripId: r.run.id, studentFix: r.studentFix, nowMs: Date.now(), existing: r.existing.map(c => ({ studentId: c.studentId, tripId: c.runId })) })
  } else {
    // Kiosk / teacher: a human vouches for the student, so there is nothing to second-guess.
    const dup = r.existing.some(c => c.studentId === r.student.id && c.runId === r.run.id)
    result = {
      accepted: !dup, duplicate: dup, verified: true, token: 'static', distanceToBusM: null,
      reason: dup ? 'Already checked in on this ride.' : r.method === 'kiosk' ? 'Checked in by a monitor at the stop.' : 'Marked by a teacher.',
    }
  }
  if (!result.accepted) return { result }

  const checkin: Omit<Checkin, 'id'> = {
    studentId: r.student.id, busId: r.bus.id, runId: r.run.id, fromStopId: r.run.fromStopId, toZone: r.run.toZone,
    scannedAt: Date.now(), scannedAtSchoolMin: r.nowMin, method: r.method,
    studentLocation: r.studentFix, busLocationAtScan: r.bus.lastLocation ? { lat: r.bus.lastLocation.lat, lng: r.bus.lastLocation.lng } : null,
    distanceToBusM: result.distanceToBusM, verified: result.verified, verifyReason: result.reason,
    by: r.by, isPilot: r.isPilot, isSimulated: r.isSimulated,
  }
  // Deterministic id (student+run) makes a double tap or a second device idempotent.
  const id = `${r.student.id}_${r.run.id}`
  await r.store.set('checkins', id, checkin)
  await r.store.add('events', {
    type: result.verified ? 'checkin' : 'checkin_unverified', busId: r.bus.id, studentId: r.student.id,
    message: result.verified ? `${shortName(r.student.name)} checked in on Shuttle ${r.bus.number}.` : `${shortName(r.student.name)} checked in on Shuttle ${r.bus.number} (unverified — teacher decides).`,
    createdAt: r.nowMs, isSimulated: r.isSimulated,
  })
  return { result, checkin: { ...checkin, id } }
}

/** Ask the browser for one location fix. Only ever called at the instant of a scan (location minimalism). */
export function getOneFix(timeoutMs = 7000): Promise<StudentFix | null> {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 5000 },
    )
  })
}
