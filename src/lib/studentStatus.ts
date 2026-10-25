// Status resolver: one student, one passing period → one honest label (SPEC §8.5).
// Every status has an icon name + text + color token so color is never the only signal.
import type { Bus, Checkin, LiveStatus, Student } from '@/types'

export interface StatusMeta { label: string; short: string; icon: string; tone: 'ok' | 'info' | 'warn' | 'bad' | 'mute' }

// `excused_bus_late` is the internal key; the label says "shuttle" because that is what Plano Senior students ride.
export const STATUS_META: Record<LiveStatus, StatusMeta> = {
  arrived:          { label: 'Arrived',                      short: 'Arrived',        icon: 'check-circle', tone: 'ok' },
  on_the_way:       { label: 'On the way',                   short: 'On the way',     icon: 'bus',          tone: 'info' },
  excused_bus_late: { label: 'Excused: shuttle delay',       short: 'Excused',        icon: 'clock',        tone: 'warn' },
  no_shuttle:       { label: 'No shuttle needed',            short: 'No shuttle',     icon: 'footprints',   tone: 'mute' },
  unverified:       { label: 'Unverified — teacher decides', short: 'Unverified',     icon: 'help-circle',  tone: 'warn' },
  not_checked_in:   { label: 'Not checked in',               short: 'Not checked in', icon: 'circle-slash', tone: 'bad' },
  waiting:          { label: 'Hasn\'t boarded yet',          short: 'Waiting',        icon: 'hourglass',    tone: 'mute' },
}

export interface StatusInput {
  /** is this student expected to take the shuttle for this passing period? */
  needsShuttle: boolean
  checkin?: Checkin | null
  /** true when the shuttle run the student checked into has ended */
  runCompleted?: boolean
  /** result of rideAssessment() for the checked-in run (projected until it arrives): excused for a slow ride or a missed bell */
  rideExcused?: boolean
  /** bell time of the class they are heading to */
  nextBell: number
  nowMin: number
  /** teacher override takes precedence */
  override?: LiveStatus | null
}

/**
 * With no timetable there is no "the last bus has left" moment. The fair cutoff is the class bell:
 * until it rings a student who has not checked in is simply "Hasn't boarded yet"; after it, "Not checked in"
 * (a neutral label, never "skipping"; the teacher decides).
 */
export function resolveStatus(i: StatusInput): LiveStatus {
  if (i.override) return i.override
  if (!i.needsShuttle) return 'no_shuttle'
  if (i.checkin) {
    // Unverified is never auto-excused or auto-flagged: a human decides.
    // (Even if the shuttle arrived on time we cannot say THIS student was on it.)
    if (!i.checkin.verified) return 'unverified'
    if (i.rideExcused) return 'excused_bus_late'
    return i.runCompleted ? 'arrived' : 'on_the_way'
  }
  return i.nowMin >= i.nextBell ? 'not_checked_in' : 'waiting'
}

export function busLabel(bus?: Pick<Bus, 'number'> | null): string { return bus ? `Shuttle ${bus.number}` : 'Shuttle' }
export type { Student }
