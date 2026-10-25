import { describe, it, expect } from 'vitest'
import { computeResults, baselineStat, keywordThemes } from '@/evidence/results'
import type { BaselineEntry, Checkin } from '@/types'

const empty = { baseline: [], analytics: [], checkins: [], attendance: [], runs: [], tests: [], sus: [], feedback: [] }
const ck = (o: Partial<Checkin>): Checkin => ({ id: Math.random() + '', studentId: 's1', busId: 'b', runId: 'r', scannedAt: Date.parse('2026-02-03T16:00:00Z'), scannedAtSchoolMin: 0, method: 'qr', verified: true, verifyReason: '', ...o })

describe('results', () => {
  it('shows nothing (null) when there is no data — never invents numbers', () => {
    const r = computeResults(empty, false)
    expect(r.baseline.tardyPct.value).toBeNull(); expect(r.pilot.checkins).toBe(0); expect(r.usability.r1.successRate.value).toBeNull()
  })
  it('excludes simulated rows unless asked', () => {
    const i = { ...empty, checkins: [ck({ isPilot: true }), ck({ isSimulated: true, isPilot: false }), ck({ studentId: 's2', isPilot: true })] }
    expect(computeResults(i, false).pilot.checkins).toBe(2)
    expect(computeResults(i, true).pilot.checkins).toBe(3)
    expect(computeResults(i, false).pilot.participants).toBe(2)
  })
  it('ride-along rows are real ride times (ride_min), averaged', () => {
    const rows: BaselineEntry[] = [{ id: '1', source: 'ride_along', metric: 'ride_min', value: 5, n: 1, date: '' }, { id: '2', source: 'ride_along', metric: 'ride_min', value: 7, n: 1, date: '' }, { id: '3', source: 'ride_along', metric: 'delay_min', value: 99, n: 1, date: '' }]
    expect(computeResults({ ...empty, baseline: rows }, false).baseline.rideAlongDelay).toMatchObject({ value: 6, n: 2 })
  })
  it('weights baseline rows by sample size', () => {
    const rows: BaselineEntry[] = [
      { id: '1', source: 'survey', metric: 'x', value: 10, n: 10, date: '' }, { id: '2', source: 'survey', metric: 'x', value: 40, n: 30, date: '' }]
    expect(baselineStat(rows, 'x').value).toBe(32.5)
    expect(baselineStat(rows, 'x').n).toBe(40)
  })
  it('keyword themes need 2+ mentions', () => {
    const t = keywordThemes(['Scanner is slow indoors', 'slow scanner again', 'love the map'])
    expect(t.map(x => x.title)).toContain('scanner')
  })
})

import { expiredCheckins } from '@/lib/retention'
describe('retention', () => {
  it('flags check-ins older than 30 days only', () => {
    const now = Date.parse('2026-03-01T12:00:00Z')
    const rows = [{ id: 'old', scannedAt: now - 31 * 86_400_000 }, { id: 'new', scannedAt: now - 29 * 86_400_000 }]
    expect(expiredCheckins(rows, now).map(r => r.id)).toEqual(['old'])
  })
})
