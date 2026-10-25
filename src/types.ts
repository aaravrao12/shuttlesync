// Shared types. Mirrors the Firestore model in SPEC.md §7, adapted to how Plano Senior's shuttle really works:
// ONE continuous loop between the Building A loop and the Building H loop (the Annex). No timetable, no choice of bus.
//
// Time convention: anything about the *school day* is "school minutes" = minutes since midnight in the
// school's timezone, read from the (possibly demo-shifted) clock. Anything about *the real world*
// (GPS freshness, createdAt) is epoch milliseconds. Mixing the two is the classic bug, so names say which.

export type Role = 'student' | 'teacher' | 'admin' | 'bus' | 'kiosk' | 'team'

export interface LatLng { lat: number; lng: number }

export interface School { id: string; name: string; timezone: string; createdAt: number }

/**
 * main  = Buildings A, D, E: connected indoors, served by the Building A loop (D and E have no stop of their own).
 * annex = Building H (the former Haggard Middle School), served by the H loop.
 * closed = under construction (B: interior demolition, C: being rebuilt). No classes, no stop.
 */
export type Zone = 'main' | 'annex' | 'closed'
export type ShuttleZone = 'main' | 'annex'

export interface Building {
  id: string
  name: string
  code: string
  color: string
  lat: number
  lng: number
  zone: Zone
  /** shown on the map and 3D scene for closed buildings, e.g. "Interior demolition" */
  note?: string
  /** true until someone confirms the coordinates on site */
  approximate?: boolean
}

export interface Stop {
  id: string
  name: string
  /** which end of the loop this stop belongs to */
  zone: ShuttleZone
  kind: 'primary' | 'rain'
  /** buildings whose students use this stop */
  servesBuildingIds: string[]
  /** rain-only stops are ignored unless settings.rainStopActive */
  rainOnly?: boolean
  lat: number
  lng: number
  /** true until someone taps "Use this phone's location" at the real stop */
  approximate?: boolean
  address?: string
  /** Enter radius; exit radius is 1.5x (hysteresis, see lib/geofence.ts). */
  geofenceRadiusM: number
}

export type BusStatus = 'idle' | 'boarding' | 'in_transit' | 'delayed'

export interface BusLocation extends LatLng {
  speedMps: number
  heading: number
  accuracyM: number
  /** epoch ms (real clock) so freshness checks do not depend on the demo clock */
  updatedAt: number
}

/** A shuttle. Any shuttle at your stop goes to the other end of the loop. */
export interface Bus {
  id: string
  number: string
  label: string
  capacity: number
  qrSecret: string
  status: BusStatus
  lastLocation?: BusLocation
  currentStopId?: string | null
  /** primary stop of the zone the shuttle is heading to (while on a run) */
  nextStopId?: string | null
  /** minutes until it reaches its destination */
  etaToNextStop?: number | null
  /** minutes beyond the normal ride (or beyond the normal wait while boarding) */
  delayMinutes?: number
  avgSpeedMps?: number
  /** true when location comes from the simulator, shown as "Simulated" in the UI */
  isSimulated?: boolean
  activeRunId?: string | null
  /** counter used to make deterministic run ids */
  runSeq?: number
  /** dispatch heads-up: minutes the shuttle expects to be slow before it has even left (cleared each run) */
  reportedDelayMin?: number
}

export type RunStatus = 'boarding' | 'in_transit' | 'completed'

/**
 * A run = one one-way trip (A -> H or H -> A), detected from the shuttle's own GPS (see lib/busEngine.ts):
 * it opens (boarding) when the shuttle enters a stop, starts when it leaves the geofence, and ends when it
 * enters a stop at the other end. Times are school minutes.
 */
export interface Run {
  id: string
  busId: string
  date: string
  fromZone: ShuttleZone
  toZone: ShuttleZone
  fromStopId: string
  status: RunStatus
  boardingAt: number
  departedAt?: number | null
  arrivedAt?: number | null
  arrivedStopId?: string | null
  isSimulated?: boolean
}

export interface BellPeriod {
  id: string
  period: number
  name: string
  start: number
  end: number
  /** when the passing period begins (= end of previous class) */
  transitionStart: number
  /** a lunch hour that sits between the previous period and this one (e.g. 11:49–12:49, A block until 12:18) */
  lunchBefore?: { start: number; end: number; splitAt?: number }
}

export interface ScheduleEntry {
  period: number
  buildingId: string
  room: string
  teacherId?: string | null
  teacherName?: string
  courseName: string
}

export interface Student {
  id: string
  name: string
  grade?: number
  studentNumber?: string
  preferredLanguage?: 'en' | 'es' | 'other'
  schedule: ScheduleEntry[]
  isSimulated?: boolean
  /** short anonymous code used in AI prompts instead of the name */
  code?: string
  /** device/auth uid that claimed this enrolled student (see Onboarding) */
  ownerUid?: string
}

export interface TeacherPeriod { period: number; buildingId: string; room: string; courseName: string }

export interface Teacher {
  id: string
  name: string
  email?: string
  periods: TeacherPeriod[]
  isSimulated?: boolean
}

export type CheckinMethod = 'qr' | 'kiosk' | 'photo' | 'teacher_manual'

export interface Checkin {
  id: string
  studentId: string
  busId: string
  runId: string
  fromStopId?: string
  toZone?: ShuttleZone
  scannedAt: number // epoch ms
  scannedAtSchoolMin: number
  method: CheckinMethod
  studentLocation?: { lat: number; lng: number; accuracyM: number } | null
  busLocationAtScan?: LatLng | null
  distanceToBusM?: number | null
  verified: boolean
  verifyReason: string
  by?: string // kiosk/teacher id for non-QR methods
  isPilot?: boolean
  isSimulated?: boolean
}

export type EventType =
  | 'bus_arrived' | 'bus_departed' | 'bus_delayed' | 'bus_recovered'
  | 'checkin' | 'checkin_unverified' | 'override' | 'note_approved' | 'system'

export interface ShuttleEvent {
  id: string
  type: EventType
  busId?: string
  studentId?: string
  stopId?: string
  message: string
  createdAt: number
  isSimulated?: boolean
}

export type AttendanceStatus =
  | 'present' | 'in_transit' | 'excused_bus_late' | 'tardy' | 'absent' | 'unknown'

export interface Override { studentId: string; from: string; to: AttendanceStatus; reason: string; by: string; at: number }

export interface AttendanceDoc {
  id: string // date_period_teacher
  date: string
  period: number
  teacherId: string
  records: Record<string, AttendanceStatus>
  overrides: Override[]
  aiNote?: string
  aiNoteSource?: 'ai' | 'template'
  approvedAt?: number | null
  isSimulated?: boolean
}

/** What a student sees (SPEC §8.5). Each has icon + text + color. `excused_bus_late` is shown as "Excused: shuttle delay". */
export type LiveStatus =
  | 'arrived' | 'on_the_way' | 'excused_bus_late' | 'no_shuttle'
  | 'unverified' | 'not_checked_in' | 'waiting'

export interface AnalyticsEvent {
  id: string
  type: string
  role: string
  sessionId: string
  props: Record<string, unknown>
  createdAt: number
  isPilot: boolean
  isSimulated: boolean
}

export interface Feedback {
  id: string
  role: string
  rating: number // ease 1-5
  easeScore: number
  wouldUse: number // 1-5
  text: string
  screen: string
  createdAt: number
  isPilot: boolean
  isSimulated?: boolean
}

export interface UsabilityTest {
  id: string
  participantCode: string
  role: 'student' | 'teacher'
  round: 1 | 2
  task: string
  success: boolean
  durationMs: number
  stuckAt?: string
  notes?: string
  createdAt: number
}

export interface SusResponse { id: string; participantCode: string; round: 1 | 2; answers: number[]; score: number; createdAt: number }

export interface ChangelogEntry {
  id: string
  date: string
  observation: string
  change: string
  resultAfter: string
  linkedTestIds: string[]
}

export interface BaselineEntry {
  id: string
  source: 'survey' | 'ride_along' | 'interview'
  metric: string
  value: number | string
  n: number
  notes?: string
  date: string
}

export interface AppSettings {
  id: 'main'
  mode: 'demo' | 'pilot'
  analyticsOff: boolean
  /** demo clock: virtual = anchorVirtualMs + (real - anchorRealMs) * speed */
  clock: { anchorRealMs: number; anchorVirtualMs: number; speed: number }
  /** per-shuttle extra hold in school minutes used by the "make shuttle slow" demo control */
  simDelays: Record<string, number>
  /** when true, the demo simulator drives the shuttles */
  simulatorOn: boolean
  /** the one device (store uid) that runs the simulator, so two devices never double-write events */
  simulatorOwner?: string | null
  /** bus ids driven by a real phone; simulator leaves these alone */
  realBusIds: string[]
  /** typical one-way ride between the two loops (admin-configurable) */
  normalRideMin: number
  /** minutes beyond normal that a ride may take before the rider is excused */
  delayThresholdMin: number
  /** typical time the shuttle waits at a stop */
  dwellMin: number
  /** walk from class to the stop, and from the stop to class */
  walkToStopMin: number
  walkFromStopMin: number
  /** the rain-only stop by the pond (off by default) */
  rainStopActive: boolean
}

export type WithId<T> = T & { id: string }
