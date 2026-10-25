import { describe, it, expect } from 'vitest'
import { resolveStatus, STATUS_META } from '@/lib/studentStatus'
import type { Checkin } from '@/types'

const ck = (verified: boolean): Checkin => ({ id: 'c', studentId: 's', busId: 'shuttle1', runId: 'r1', scannedAt: 0, scannedAtSchoolMin: 600, method: 'qr', verified, verifyReason: '' })
const base = { needsShuttle: true, nextBell: 608, nowMin: 602 }

describe('resolveStatus (no timetable: the class bell is the fair cutoff)', () => {
  it('same zone → no shuttle', () => expect(resolveStatus({ ...base, needsShuttle: false })).toBe('no_shuttle'))
  it('teacher override wins', () => expect(resolveStatus({ ...base, override: 'arrived' })).toBe('arrived'))
  it('verified check-in, ride in progress, fine → on the way', () => expect(resolveStatus({ ...base, checkin: ck(true), rideExcused: false })).toBe('on_the_way'))
  it('verified check-in, ride finished, fine → arrived', () => expect(resolveStatus({ ...base, checkin: ck(true), runCompleted: true, rideExcused: false })).toBe('arrived'))
  it('verified check-in on a slow ride → excused (also once it has finished)', () => {
    expect(resolveStatus({ ...base, checkin: ck(true), rideExcused: true })).toBe('excused_bus_late')
    expect(resolveStatus({ ...base, checkin: ck(true), runCompleted: true, rideExcused: true })).toBe('excused_bus_late')
  })
  it('unverified is never auto-excused or auto-flagged', () => {
    expect(resolveStatus({ ...base, checkin: ck(false), rideExcused: true })).toBe('unverified')
    expect(resolveStatus({ ...base, checkin: ck(false), runCompleted: true, rideExcused: false })).toBe('unverified')
  })
  it('no check-in: "waiting" until the bell, then "not checked in" (neutral wording; the teacher decides)', () => {
    expect(resolveStatus({ ...base, nowMin: 607.9 })).toBe('waiting')
    expect(resolveStatus({ ...base, nowMin: 608 })).toBe('not_checked_in')
  })
  it('every status has icon + text + tone (never color alone)', () => {
    for (const m of Object.values(STATUS_META)) expect(m.icon && m.label && m.tone).toBeTruthy()
  })
  it('the excused label says shuttle', () => expect(STATUS_META.excused_bus_late.label).toBe('Excused: shuttle delay'))
})
