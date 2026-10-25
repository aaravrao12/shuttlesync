// Time helpers. "School minutes" = minutes since local midnight in the school's timezone.
// Why a number instead of Date: bell schedules and bus timetables are all "8:05 AM"-style wall-clock
// times, so comparing plain numbers is simpler and easier to unit test than juggling Date objects.

export const DEFAULT_TZ = 'America/Chicago'

/** Parse "08:05" or "8:05 AM" to school minutes. */
export function parseClock(s: string): number {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i)
  if (!m) throw new Error(`Bad time: ${s}`)
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const ap = m[3]?.toLowerCase()
  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return h * 60 + min
}

/** 485 -> "8:05 AM". Fractional minutes are floored. */
export function fmtClock(minutes: number): string {
  const total = Math.floor(minutes)
  const h24 = Math.floor(total / 60) % 24
  const m = total % 60
  const ap = h24 >= 12 ? 'PM' : 'AM'
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h}:${String(m).padStart(2, '0')} ${ap}`
}

/** "3 min", "1 min", "now" — countdown copy. */
export function fmtCountdown(minutes: number): string {
  if (minutes <= 0.5) return 'now'
  const m = Math.round(minutes)
  return `${m} min`
}

/** Minutes since midnight for an instant, in a timezone (fractional). */
export function schoolMinutes(d: Date, tz = DEFAULT_TZ): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d)
  const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value ?? '0', 10)
  return get('hour') * 60 + get('minute') + get('second') / 60
}

/** YYYY-MM-DD in a timezone. */
export function schoolDate(d: Date, tz = DEFAULT_TZ): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const g = (t: string) => parts.find(p => p.type === t)?.value
  return `${g('year')}-${g('month')}-${g('day')}`
}

/** True on Mon–Fri in the school's timezone. */
export function isSchoolDay(d: Date, tz = DEFAULT_TZ): boolean {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d)
  return wd !== 'Sat' && wd !== 'Sun'
}

export const median = (xs: number[]): number | null => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
