import { describe, it, expect } from 'vitest'
import { buildRoster, recordsFromRows, attendanceDocId, checkinForTransition } from '@/lib/roster'
import { BUILDINGS, STOPS, makeBell, makeBuses, makeStudents } from '@/demo/seedData'
import { DEFAULT_RULES } from '@/lib/shuttle'
import type { Bus, Checkin, Run } from '@/types'

const bell = makeBell()
const END2 = bell.find(b => b.period === 2)!.end // 10:51, the passing period before P3 starts here
const START3 = bell.find(b => b.period === 3)!.start // 11:03 bell
const H = STOPS[1]
const bus: Bus = { ...makeBuses()[0], lastLocation: { lat: H.lat, lng: H.lng, speedMps: 3, heading: 0, accuracyM: 5, updatedAt: 0 } }
const r1: Run = { id: 'r1', busId: 'shuttle1', date: 'd', fromZone: 'main', toZone: 'annex', fromStopId: 'stop-a', status: 'in_transit', boardingAt: END2 + 1, departedAt: END2 + 3 }
const toMain: Run = { ...r1, id: 'r2', fromZone: 'annex', toZone: 'main', fromStopId: 'stop-h' }
const ck = (studentId: string, o: Partial<Checkin> = {}): Checkin => ({ id: 'c' + studentId, studentId, busId: 'shuttle1', runId: 'r1', scannedAt: 1, scannedAtSchoolMin: END2 + 2, method: 'qr', verified: true, verifyReason: '', ...o })
const base = { teacherId: 't-rivera', period: 3, students: makeStudents(), bell, buildings: BUILDINGS, stops: STOPS, buses: [bus], runs: [r1, toMain], checkins: [] as Checkin[], attendance: null, nowMin: END2 + 6, rules: DEFAULT_RULES }
const row = (res: ReturnType<typeof buildRoster>, code: string) => res.rows.find(r => r.student.code === code)!

describe('buildRoster (period 3, Ms. Rivera in Building H; bell 11:03)', () => {
  it('lists the students whose period-3 teacher is Rivera; only those coming from the main campus need the shuttle', () => {
    const res = buildRoster(base)
    expect(res.rows.map(r => r.student.code).sort()).toEqual(['S01', 'S02', 'S03', 'S05', 'S06', 'S10', 'S11', 'S12'])
    expect(row(res, 'S10').status).toBe('no_shuttle') // H → H
    expect(res.rows.filter(r => r.need.needs)).toHaveLength(7)
  })
  it('before the bell: not checked in yet is just "waiting"; after the bell it becomes "not checked in"', () => {
    expect(buildRoster({ ...base, nowMin: END2 + 6 }).counts).toMatchObject({ waiting: 7, notCheckedIn: 0 })
    expect(buildRoster({ ...base, nowMin: START3 + 1 }).counts).toMatchObject({ waiting: 0, notCheckedIn: 7 })
  })
  it('a verified check-in on a normal ride → on the way, then arrived when the run completes', () => {
    let res = buildRoster({ ...base, checkins: [ck('demo-s01')], nowMin: END2 + 5 })
    expect(row(res, 'S01').status).toBe('on_the_way')
    expect(res.counts.onTheWay).toBe(1)
    const done: Run = { ...r1, status: 'completed', arrivedAt: END2 + 7, arrivedStopId: 'stop-h' }
    res = buildRoster({ ...base, runs: [done], checkins: [ck('demo-s01')], nowMin: END2 + 11 })
    expect(row(res, 'S01').status).toBe('arrived')
  })
  it('a slow ride excuses the rider automatically, and the shuttle is named with how far over normal it ran', () => {
    const slowBus: Bus = { ...bus, reportedDelayMin: 9 }
    const res = buildRoster({ ...base, buses: [slowBus], checkins: [ck('demo-s01'), ck('demo-s02')], nowMin: END2 + 5 })
    expect(row(res, 'S01').status).toBe('excused_bus_late')
    expect(res.counts.excused).toBe(2)
    expect(res.lateBuses[0].bus).toBe('1'); expect(res.lateBuses[0].minutes).toBeGreaterThanOrEqual(1)
    expect(row(res, 'S03').status).toBe('waiting') // did not check in: not excused
  })
  it('a ride that lands after the bell is excused even if each minute looked normal', () => {
    const done: Run = { ...r1, status: 'completed', arrivedAt: START3 + 1, arrivedStopId: 'stop-h' }
    const res = buildRoster({ ...base, runs: [done], checkins: [ck('demo-s01', { scannedAtSchoolMin: START3 - 4 })], nowMin: START3 + 2 })
    expect(row(res, 'S01').assessment).toMatchObject({ excused: true, reason: 'misses_bell' })
    expect(row(res, 'S01').status).toBe('excused_bus_late')
  })
  it('unverified stays unverified, even on a slow ride', () => {
    const res = buildRoster({ ...base, buses: [{ ...bus, reportedDelayMin: 9 }], checkins: [ck('demo-s01', { verified: false })], nowMin: END2 + 5 })
    expect(row(res, 'S01').status).toBe('unverified'); expect(res.counts.unverified).toBe(1)
  })
  it('a check-in on a run heading the other way does not count for a class at the annex', () => {
    const res = buildRoster({ ...base, checkins: [ck('demo-s01', { runId: 'r2' })], nowMin: END2 + 6 })
    expect(row(res, 'S01').status).toBe('waiting')
  })
  it('teacher decisions win and are tallied', () => {
    const att = { id: 'a', date: 'd', period: 3, teacherId: 't-rivera', records: {}, overrides: [
      { studentId: 'demo-s01', from: 'waiting', to: 'present' as const, reason: 'saw them', by: 't', at: 0 },
      { studentId: 'demo-s02', from: 'waiting', to: 'absent' as const, reason: 'x', by: 't', at: 0 }] }
    const res = buildRoster({ ...base, attendance: att, nowMin: END2 + 6 })
    expect(row(res, 'S01').status).toBe('arrived')
    expect(res.counts.markedAbsent).toBe(1)
    expect(recordsFromRows(res.rows)['demo-s02']).toBe('absent')
  })
  it('records: waiting riders are in transit, unverified are unknown, same-zone are present', () => {
    const rec = recordsFromRows(buildRoster({ ...base, checkins: [ck('demo-s01', { verified: false })], nowMin: END2 + 6 }).rows)
    expect(rec['demo-s01']).toBe('unknown'); expect(rec['demo-s02']).toBe('in_transit'); expect(rec['demo-s10']).toBe('present')
  })
  it('doc id format', () => expect(attendanceDocId('2026-01-15', 3, 't')).toBe('2026-01-15_p3_t'))
})

describe('matching a check-in to a passing period', () => {
  it('only counts scans near that passing period, heading to the right zone', () => {
    const runs = [r1, toMain]
    expect(checkinForTransition('demo-s01', [ck('demo-s01')], runs, 'annex', END2, START3)?.runId).toBe('r1')
    expect(checkinForTransition('demo-s01', [ck('demo-s01', { scannedAtSchoolMin: END2 - 40 })], runs, 'annex', END2, START3)).toBeNull() // way too early
    expect(checkinForTransition('demo-s01', [ck('demo-s01')], runs, 'main', END2, START3)).toBeNull() // wrong direction
  })
})
