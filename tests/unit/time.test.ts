import { describe, it, expect } from 'vitest'
import { parseClock, fmtClock, fmtCountdown, schoolMinutes, schoolDate, median } from '@/lib/time'
import { clock, clockAt } from '@/lib/clock'

describe('time', () => {
  it('parses and formats clock strings', () => {
    expect(parseClock('08:05')).toBe(485)
    expect(parseClock('1:30 PM')).toBe(13 * 60 + 30)
    expect(parseClock('12:00 AM')).toBe(0)
    expect(fmtClock(485)).toBe('8:05 AM')
    expect(fmtClock(0)).toBe('12:00 AM')
    expect(fmtClock(13 * 60 + 5)).toBe('1:05 PM')
  })
  it('rejects garbage', () => { expect(() => parseClock('nope')).toThrow() })
  it('formats countdowns', () => { expect(fmtCountdown(0.2)).toBe('now'); expect(fmtCountdown(3.4)).toBe('3 min') })
  it('reads wall-clock minutes in the school timezone', () => {
    // 15:00 UTC in January is 9:00 AM in Chicago (CST, UTC-6)
    const d = new Date('2026-01-15T15:00:00Z')
    expect(schoolMinutes(d, 'America/Chicago')).toBe(9 * 60)
    expect(schoolDate(new Date('2026-01-15T03:00:00Z'), 'America/Chicago')).toBe('2026-01-14')
  })
  it('median', () => { expect(median([])).toBeNull(); expect(median([3, 1, 2])).toBe(2); expect(median([1, 2, 3, 4])).toBe(2.5) })
})

describe('demo clock', () => {
  it('jumps to a target time and runs at speed', () => {
    clock.configure(clockAt(9 * 60 + 58, 4))
    const m = clock.minutes()
    expect(m).toBeGreaterThanOrEqual(9 * 60 + 58)
    expect(m).toBeLessThan(9 * 60 + 59)
    expect(clock.isReal()).toBe(false)
    const t0 = clock.nowMs(1_000_000_000_000)
    const t1 = clock.nowMs(1_000_000_000_000 + 1000)
    expect(t1 - t0).toBe(4000) // 4x
    clock.configure(undefined)
    expect(clock.isReal()).toBe(true)
  })
})
