// Seeding: load the demo campus, reset the shuttles for a new demo run, wipe demo data.
import type { Store } from './store'
import { schoolDate } from '@/lib/time'
import { BUILDINGS, STOPS, makeBell, makeBuses, makeStudents, makeTeachers } from '@/demo/seedData'
import { DEFAULT_SETTINGS } from './hooks'

/** Collections that make up the campus configuration (replaced wholesale by "Load demo campus"). Includes the retired timetable ones. */
const CAMPUS_COLLECTIONS = ['buildings', 'stops', 'buses', 'runs', 'bellSchedule', 'routes', 'trips']

export async function clearCampus(store: Store) {
  for (const c of CAMPUS_COLLECTIONS) await store.clear(c)
}

/** Replace the campus with the simulated Plano Senior loop (A <-> H, closed B and C, rain stop off). */
export async function seedDemo(store: Store, date?: string) {
  await clearCampus(store)
  const existing = await store.get('settings', 'main')
  await Promise.all([
    ...BUILDINGS.map(b => store.set('buildings', b.id, b)),
    ...STOPS.map(s => store.set('stops', s.id, s)),
    ...makeBuses().map(b => store.set('buses', b.id, b)),
    ...makeBell().map(b => store.set('bellSchedule', b.id, b)),
    ...makeTeachers().map(t => store.set('teachers', t.id, t)),
    ...makeStudents().map(s => store.set('students', s.id, s)),
    store.set('settings', 'main', { ...DEFAULT_SETTINGS, ...(existing ?? {}), id: 'main' }),
    // A real decision by the team, logged so the Results page can tell the "we learned, then changed" story. Result after: fill in after the pilot.
    store.get('changelog', 'loop-model').then(c => c ?? store.set('changelog', 'loop-model', {
      date: date ?? schoolDate(new Date()),
      observation: 'We first assumed students needed help picking a bus. Learning how the shuttle really works showed it is one continuous loop between the A loop and the H loop, with no timetable and no choice of bus.',
      change: 'Replaced bus-picking and timetable planning with a live shuttle tracker, "Will I make it?", and fair tardies based on each rider\'s actual ride time.',
      resultAfter: '', linkedTestIds: [],
    })),
  ])
}

/** True when this browser still holds data from the first (timetable) version of the app. */
export const isLegacyCampus = (buildings: { zone?: string }[]) => buildings.length > 0 && buildings.some(b => !b.zone)

/** Forget today's runs and reset every shuttle to idle (for a fresh demo or a restart). */
export async function resetRuns(store: Store, buses: { id: string }[]) {
  await store.clear('runs')
  await Promise.all(buses.map(b => store.update('buses', b.id, { status: 'idle', lastLocation: null, currentStopId: null, nextStopId: null, etaToNextStop: null, delayMinutes: 0, activeRunId: null, runSeq: 0, reportedDelayMin: 0 })))
}

/** Remove only simulated/demo records (check-ins, events, runs, analytics flagged simulated). Real pilot data is untouched. */
export async function clearDemoActivity(store: Store) {
  for (const coll of ['checkins', 'events', 'runs', 'analytics', 'feedback', 'attendance']) {
    const rows = await new Promise<any[]>(res => { const u = store.watchCollection(coll, r => { u(); res(r) }) })
    await Promise.all(rows.filter(r => r.isSimulated).map(r => store.remove(coll, r.id)))
  }
}
