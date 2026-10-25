// Demo campus modeled on how Plano Senior's shuttle ACTUALLY works (as described by the team):
//
//   • One continuous loop between the Building A loop (main campus hub, Independence Pkwy) and the Building H loop
//     (the Annex, 2832 Parkhaven Dr). No timetable. Any shuttle at your stop goes to the other end.
//   • Buildings A, D and E are one zone: D and E have NO stop of their own, students walk indoors to the A loop.
//   • Buildings B (interior demolition) and C (being rebuilt) are closed: no classes, no stop.
//   • A rain-only stop by the pond serves D and E; an admin toggle turns it on (off by default).
//
// Stop coordinates are approximate until someone taps "Use this phone's location" at each real stop (Admin → School setup).
// Building coordinates, the bell schedule, the people and the number of shuttles are demo placeholders. EVERYTHING people-related
// here is simulated and labeled so in the UI (isSimulated: true).
import type { BellPeriod, Building, Bus, ScheduleEntry, Stop, Student, Teacher } from '@/types'

export const SCHOOL_ID: string = (import.meta as any).env?.VITE_SCHOOL_ID || 'plano-senior'

export const BUILDINGS: Building[] = [
  { id: 'A', name: 'Building A', code: 'A', color: 'bldA', zone: 'main', lat: 33.02805, lng: -96.75335, approximate: true },
  { id: 'D', name: 'Building D', code: 'D', color: 'bldD', zone: 'main', lat: 33.02845, lng: -96.75385, approximate: true },
  { id: 'E', name: 'Building E', code: 'E', color: 'bldE', zone: 'main', lat: 33.02775, lng: -96.75405, approximate: true },
  { id: 'H', name: 'Building H (Annex)', code: 'H', color: 'bldH', zone: 'annex', lat: 33.03345, lng: -96.74925, approximate: true },
  { id: 'B', name: 'Building B', code: 'B', color: 'bldB', zone: 'closed', note: 'Interior demolition', lat: 33.02875, lng: -96.75315, approximate: true },
  { id: 'C', name: 'Building C', code: 'C', color: 'bldC', zone: 'closed', note: 'Being rebuilt', lat: 33.02715, lng: -96.75345, approximate: true },
]

export const STOPS: Stop[] = [
  {
    id: 'stop-a', name: 'Building A loop', zone: 'main', kind: 'primary', servesBuildingIds: ['A', 'D', 'E'],
    address: 'Bus/shuttle lot off Independence Pkwy, Plano, TX', lat: 33.027724, lng: -96.7528, approximate: true, geofenceRadiusM: 45,
  },
  {
    id: 'stop-h', name: 'Building H loop', zone: 'annex', kind: 'primary', servesBuildingIds: ['H'],
    address: '2832 Parkhaven Dr, Plano, TX (district buses and shuttles only)', lat: 33.033244, lng: -96.748814, approximate: true, geofenceRadiusM: 45,
  },
  {
    // PLACEHOLDER position: the real east-lot-by-the-pond location is not known yet. Set it on site in Admin → School setup.
    id: 'stop-rain', name: 'East lot by the pond (rain only)', zone: 'main', kind: 'rain', rainOnly: true, servesBuildingIds: ['D', 'E'],
    address: 'PLACEHOLDER: set on site', lat: 33.0278, lng: -96.7512, approximate: true, geofenceRadiusM: 35,
  },
]

/** Default: 2 shuttles on the loop. The number is configurable in Admin. */
export const makeBuses = (count = 2): Bus[] => Array.from({ length: count }, (_, i) => ({
  id: `shuttle${i + 1}`,
  number: String(i + 1),
  label: `Shuttle ${i + 1}`,
  capacity: 36,
  qrSecret: `demo-secret-shuttle${i + 1}`,
  status: 'idle' as const,
  isSimulated: true,
  delayMinutes: 0,
}))

const hm = (h: number, m: number) => h * 60 + m

/**
 * Plano Senior's published daily bell schedule (provided by the team): periods 0–7, with ONE lunch hour for everyone after
 * period 3 (11:49–12:49; A block until 12:18, B block 12:18–12:49). Edit in Admin → Bell schedule if it changes
 * (early-release or special-schedule days are NOT modeled yet).
 */
export const makeBell = (): BellPeriod[] => {
  const rows: [number, number, number][] = [
    [0, hm(8, 5), hm(8, 51)], [1, hm(9, 5), hm(9, 51)], [2, hm(10, 3), hm(10, 51)], [3, hm(11, 3), hm(11, 49)],
    [4, hm(12, 49), hm(13, 35)], [5, hm(13, 47), hm(14, 33)], [6, hm(14, 45), hm(15, 31)], [7, hm(15, 43), hm(16, 30)],
  ]
  return rows.map(([period, start, end], i) => ({
    id: `p${period}`, period, name: `Period ${period}`, start, end, transitionStart: i === 0 ? start : rows[i - 1][2],
    ...(period === 4 ? { lunchBefore: { start: hm(11, 49), end: hm(12, 49), splitAt: hm(12, 18) } } : {}),
  }))
}

// ---- Simulated people -------------------------------------------------------------------------

const TEACHER_BY_BUILDING: Record<string, { id: string; name: string }> = {
  A: { id: 't-okafor', name: 'Mr. Okafor' },
  D: { id: 't-hughes', name: 'Mr. Hughes' },
  E: { id: 't-chen', name: 'Ms. Chen' },
  H: { id: 't-rivera', name: 'Ms. Rivera' },
}
const COURSES = ['English III', 'Algebra II', 'Chemistry', 'U.S. History', 'Spanish III', 'Studio Art', 'Computer Science']
const courseFor = (period: number, b: string) => COURSES[(period + b.charCodeAt(0)) % COURSES.length]

export const makeTeachers = (): Teacher[] =>
  Object.entries(TEACHER_BY_BUILDING).map(([b, t]) => ({
    id: t.id,
    name: t.name,
    isSimulated: true,
    periods: Array.from({ length: 8 }, (_, p) => ({ period: p, buildingId: b, room: `${b}${100 + p * 3}`, courseName: courseFor(p, b) })),
  }))

// One letter per period (periods 0–7) = the building of that class. A/D/E are the main campus, H is the annex.
const STUDENT_ROWS: [string, string, string][] = [
  ['s01', 'Maya Rodriguez', 'AAAHHDDE'],
  ['s02', 'Jordan Lee', 'AAAHHHAA'],
  ['s03', 'Priya Patel', 'AAAHEEHH'],
  ['s04', 'Noah Williams', 'HHHAAEEH'],
  ['s05', 'Sofia Garcia', 'DDDHHAAH'],
  ['s06', 'Ethan Brown', 'EEEHHAAA'],
  ['s07', 'Ava Johnson', 'HHHEEDDH'],
  ['s08', 'Liam Davis', 'AAADDEEE'], // never leaves the main campus
  ['s09', 'Isabella Cruz', 'DDDDHHAA'],
  ['s10', 'Mason Kim', 'HHHHHHHH'], // never leaves the annex
  ['s11', 'Zoe Nguyen', 'AAAHAAHH'],
  ['s12', 'Caleb Turner', 'EEEHHAAD'],
]

export const makeStudents = (): Student[] =>
  STUDENT_ROWS.map(([id, name, pattern]) => ({
    id: `demo-${id}`,
    name,
    code: id.toUpperCase(),
    grade: 10 + (parseInt(id.slice(1), 10) % 3),
    studentNumber: `D${id.slice(1).padStart(5, '0')}`,
    preferredLanguage: 'en',
    isSimulated: true,
    schedule: pattern.split('').map((b, p): ScheduleEntry => {
      const t = TEACHER_BY_BUILDING[b]
      return { period: p, buildingId: b, room: `${b}${100 + p * 3}`, teacherId: t.id, teacherName: t.name, courseName: courseFor(p, b) }
    }),
  }))
