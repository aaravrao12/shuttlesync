// The app's single source of "now". In a real pilot it is just the system clock.
// In demo mode the team can jump to "9:58 AM" or run at 4x so a whole passing period fits in a demo.
// Everything that touches the schedule must call clock.now() — never new Date() — or the demo desyncs.
import type { AppSettings } from '@/types'
import { DEFAULT_TZ, schoolDate, schoolMinutes } from './time'

type ClockCfg = AppSettings['clock']

let cfg: ClockCfg = { anchorRealMs: 0, anchorVirtualMs: 0, speed: 1 }
let tz = DEFAULT_TZ
const listeners = new Set<() => void>()

export const clock = {
  /** Replace the clock configuration (called when settings sync in from the store). */
  configure(next: ClockCfg | undefined, timezone = DEFAULT_TZ) {
    cfg = next && next.speed > 0 ? next : { anchorRealMs: 0, anchorVirtualMs: 0, speed: 1 }
    tz = timezone
    listeners.forEach(l => l())
  },
  isReal(): boolean {
    return cfg.anchorRealMs === 0 && cfg.speed === 1
  },
  nowMs(real = Date.now()): number {
    if (cfg.anchorRealMs === 0) return real
    return cfg.anchorVirtualMs + (real - cfg.anchorRealMs) * cfg.speed
  },
  now(): Date {
    return new Date(clock.nowMs())
  },
  /** Current school minutes (fractional). */
  minutes(): number {
    return schoolMinutes(clock.now(), tz)
  },
  date(): string {
    return schoolDate(clock.now(), tz)
  },
  tz: () => tz,
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },
}

/** Build a clock config that makes "now" read as `targetMinutes` of today's school date, at `speed`. */
export function clockAt(targetMinutes: number, speed = 1, timezone = DEFAULT_TZ): ClockCfg {
  const realNow = Date.now()
  const currentMin = schoolMinutes(new Date(realNow), timezone)
  return { anchorRealMs: realNow, anchorVirtualMs: realNow + (targetMinutes - currentMin) * 60_000, speed }
}
