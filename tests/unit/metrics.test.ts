import { describe, it, expect } from 'vitest'
import { scanStats, susScore, delayStats, taskStats, delta, autoExcusedCount, medianCheckinSeconds, realOnly, falseFlagRate, teacherMinutesSaved } from '@/lib/metrics'
import type { AttendanceDoc, Checkin, Run, UsabilityTest, AnalyticsEvent } from '@/types'

const ck = (o: Partial<Checkin>): Checkin => ({ id: Math.random() + '', studentId: 's', busId: 'b', runId: 'r', scannedAt: 0, scannedAtSchoolMin: 0, method: 'qr', verified: true, verifyReason: '', ...o })

describe('metrics', () => {
  it('verification rate counts QR scans only', () => {
    const s = scanStats([ck({}), ck({}), ck({ verified: false }), ck({ method: 'kiosk' })])
    expect(s.verificationRate).toEqual({ value: 2 / 3, n: 3 }); expect(s.kiosk).toBe(1)
  })
  it('SUS: all-best answers = 100, all-neutral = 50', () => {
    expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100)
    expect(susScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 3])).toBe(50)
    expect(() => susScore([1])).toThrow()
  })
  it('ride stats come from finished runs: average ride, minutes over normal, and how many ran slow', () => {
    const run = (ride: number, i: number): Run => ({ id: 'r' + i, busId: 'b', date: 'd', fromZone: 'main', toZone: 'annex', fromStopId: 'a', status: 'completed', boardingAt: 0, departedAt: 10, arrivedAt: 10 + ride })
    const runs = [run(5, 1), run(9, 2), run(7, 3), { ...run(5, 4), status: 'in_transit' as const, arrivedAt: null }]
    const d = delayStats(runs, 5, 3) // slow = longer than 8 minutes
    expect(d.n).toBe(3); expect(d.averageRideMin).toBe(7); expect(d.slowRuns).toBe(1)
    expect(d.averageDelayMin).toBeCloseTo((0 + 4 + 2) / 3); expect(d.onTimeRate.value).toBeCloseTo(2 / 3)
  })
  it('ride stats are empty, not zero, with no finished runs', () => {
    expect(delayStats([])).toMatchObject({ n: 0, averageRideMin: null, averageDelayMin: null })
  })
  it('task stats by round and delta', () => {
    const mk = (round: 1 | 2, success: boolean, durationMs: number): UsabilityTest => ({ id: '', participantCode: 'P', role: 'student', round, task: '', success, durationMs, createdAt: 0 })
    const tests = [mk(1, true, 90000), mk(1, false, 0), mk(2, true, 40000), mk(2, true, 50000)]
    expect(taskStats(tests, 1).successRate.value).toBe(0.5)
    expect(taskStats(tests, 2).medianMs).toBe(45000)
    expect(delta(0.5, 1)).toEqual({ abs: 0.5, pct: 100 }); expect(delta(null, 1)).toBeNull()
  })
  it('auto-excused and false-flag rate', () => {
    const att: AttendanceDoc[] = [{ id: 'a', date: 'd', period: 3, teacherId: 't', records: { a: 'excused_bus_late', b: 'present', c: 'excused_bus_late' }, overrides: [{ studentId: 's', from: 'unverified', to: 'present', reason: '', by: 't', at: 0 }] }]
    expect(autoExcusedCount(att)).toBe(2)
    expect(falseFlagRate([ck({ verified: false })], att).value).toBe(1)
    expect(teacherMinutesSaved(2, 3)).toBe(6)
  })
  it('median check-in seconds from analytics events', () => {
    const ev = (type: string, createdAt: number, sessionId = 'x'): AnalyticsEvent => ({ id: '', type, role: 'student', sessionId, props: {}, createdAt, isPilot: true, isSimulated: false })
    expect(medianCheckinSeconds([ev('scan_attempt', 1000), ev('scan_success', 7000)])).toBe(6)
  })
  it('realOnly drops simulated rows', () => {
    expect(realOnly([{ isSimulated: true }, { isPilot: true }, { isPilot: false }])).toHaveLength(1)
  })
})
