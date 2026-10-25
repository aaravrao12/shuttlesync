// Simulated riders for the demo: they "scan" via the same data path, flagged isSimulated so they never reach Results.
import type { Bus, Run, Student } from '@/types'
import type { Store } from '@/firebase/store'

export async function checkInSimulated(store: Store, student: Student, bus: Bus, run: Run, nowMin: number, nowMs: number) {
  await store.set('checkins', `${student.id}_${run.id}`, {
    studentId: student.id, busId: bus.id, runId: run.id, fromStopId: run.fromStopId, toZone: run.toZone,
    scannedAt: Date.now(), scannedAtSchoolMin: nowMin, method: 'qr',
    studentLocation: null, busLocationAtScan: null, distanceToBusM: null, verified: true, verifyReason: 'Simulated rider', isPilot: false, isSimulated: true,
  })
  await store.add('events', { type: 'checkin', busId: bus.id, studentId: student.id, message: `${student.name.split(' ')[0]} ${student.name.split(' ').pop()![0]}. checked in on Shuttle ${bus.number}.`, createdAt: nowMs, isSimulated: true })
}

export async function undoSimulated(store: Store, student: Student, run: Run) {
  await store.remove('checkins', `${student.id}_${run.id}`)
}
