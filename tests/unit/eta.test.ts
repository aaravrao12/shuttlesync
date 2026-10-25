import { describe, it, expect } from 'vitest'
import { etaMinutes, rollingAvgSpeed, MIN_SPEED_MPS, MAX_SPEED_MPS } from '@/lib/eta'
import { DEFAULT_RULES, etaToBoard, projectedArrival, rideAssessment, shuttleWhere, willIMakeIt } from '@/lib/shuttle'
import { STOPS, makeBuses } from '@/demo/seedData'
import type { Bus, Run } from '@/types'

const A = STOPS[0], H = STOPS[1]
const NOW_REAL = 1_800_000_000_000
const stops = [A, H]
const loc = (lat: number, lng: number) => ({ lat, lng, speedMps: 3, heading: 0, accuracyM: 5, updatedAt: NOW_REAL - 2000 })
const bus = (over: Partial<Bus> = {}): Bus => ({ ...makeBuses()[0], ...over })
const run = (over: Partial<Run> = {}): Run => ({ id: 'r1', busId: 'shuttle1', date: 'd', fromZone: 'main', toZone: 'annex', fromStopId: 'stop-a', status: 'boarding', boardingAt: 600, ...over })
const mid = { lat: (A.lat + H.lat) / 2, lng: (A.lng + H.lng) / 2 }

describe('speed and ETA primitives', () => {
  it('distance / speed', () => { expect(etaMinutes(600, 5)).toBeCloseTo(2, 5) })
  it('clamps speed so a stopped shuttle gives a finite ETA', () => {
    expect(etaMinutes(600, 0)).toBeCloseTo(600 / MIN_SPEED_MPS / 60, 5)
    expect(etaMinutes(600, 99)).toBeCloseTo(600 / MAX_SPEED_MPS / 60, 5)
  })
  it('ignores near-zero samples (dwelling at a stop)', () => { expect(rollingAvgSpeed(4, 0)).toBe(4) })
  it('moves toward new samples', () => { expect(rollingAvgSpeed(4, 8)).toBeGreaterThan(4) })
})

describe('where is the shuttle', () => {
  it('offline when its phone has not reported for a minute (or ever)', () => {
    expect(shuttleWhere(bus(), null, stops, NOW_REAL).kind).toBe('offline')
    expect(shuttleWhere(bus({ lastLocation: { ...loc(A.lat, A.lng), updatedAt: NOW_REAL - 90_000 } }), null, stops, NOW_REAL).kind).toBe('offline')
  })
  it('at a stop / en route', () => {
    expect(shuttleWhere(bus({ lastLocation: loc(A.lat, A.lng), currentStopId: 'stop-a' }), run(), stops, NOW_REAL)).toMatchObject({ kind: 'at_stop' })
    expect(shuttleWhere(bus({ lastLocation: loc(mid.lat, mid.lng) }), run({ status: 'in_transit', departedAt: 601 }), stops, NOW_REAL)).toMatchObject({ kind: 'en_route', toZone: 'annex' })
  })
})

describe('time until I can board', () => {
  it('0 when a shuttle is boarding at my stop', () => {
    const b = bus({ lastLocation: loc(A.lat, A.lng), currentStopId: 'stop-a' })
    expect(etaToBoard({ bus: b, run: run(), board: A, stops, rules: DEFAULT_RULES, nowMin: 600.5, nowRealMs: NOW_REAL })).toBe(0)
  })
  it('if it is waiting at the OTHER end: rest of its wait + a normal ride', () => {
    const b = bus({ lastLocation: loc(H.lat, H.lng), currentStopId: 'stop-h' })
    const r = run({ fromZone: 'annex', toZone: 'main', fromStopId: 'stop-h', boardingAt: 600 })
    // waited 1 of 2 min → 1 min left + 5 min ride
    expect(etaToBoard({ bus: b, run: r, board: A, stops, rules: DEFAULT_RULES, nowMin: 601, nowRealMs: NOW_REAL })).toBeCloseTo(6, 5)
  })
  it('heading toward my end: just the rest of the ride', () => {
    const b = bus({ lastLocation: loc(A.lat + 0.0005, A.lng), avgSpeedMps: 3 })
    const r = run({ fromZone: 'annex', toZone: 'main', status: 'in_transit', departedAt: 603 })
    const eta = etaToBoard({ bus: b, run: r, board: A, stops, rules: DEFAULT_RULES, nowMin: 604, nowRealMs: NOW_REAL })!
    expect(eta).toBeGreaterThan(0.2); expect(eta).toBeLessThan(DEFAULT_RULES.normalRideMin)
  })
  it('heading AWAY from my end: reach the far stop, wait, ride back', () => {
    const b = bus({ lastLocation: loc(mid.lat, mid.lng), avgSpeedMps: 3 })
    const r = run({ status: 'in_transit', departedAt: 603 })
    const eta = etaToBoard({ bus: b, run: r, board: A, stops, rules: DEFAULT_RULES, nowMin: 604, nowRealMs: NOW_REAL })!
    expect(eta).toBeGreaterThan(DEFAULT_RULES.dwellMin + DEFAULT_RULES.normalRideMin)
  })
  it('null when there is no live signal', () => {
    expect(etaToBoard({ bus: bus(), run: null, board: A, stops, rules: DEFAULT_RULES, nowMin: 600, nowRealMs: NOW_REAL })).toBeNull()
  })
})

describe('"Will I make it?"', () => {
  const r = DEFAULT_RULES // walk to stop 3, ride 5, walk from stop 2 → 10 minutes if a shuttle is already there
  it('on track with 3+ minutes to spare', () => expect(willIMakeIt({ nowMin: 600, nextBell: 620, etaBoardMin: 0, rules: r })).toMatchObject({ verdict: 'on_track', slackMin: 10 }))
  it('cutting it close with 0–3 minutes to spare', () => expect(willIMakeIt({ nowMin: 600, nextBell: 611, etaBoardMin: 0, rules: r })).toMatchObject({ verdict: 'close', slackMin: 1 }))
  it('likely late when the numbers do not fit', () => expect(willIMakeIt({ nowMin: 600, nextBell: 607, etaBoardMin: 0, rules: r })).toMatchObject({ verdict: 'late', slackMin: -3 }))
  it('a far-off shuttle makes you wait: ETA beats the walk', () => expect(willIMakeIt({ nowMin: 600, nextBell: 620, etaBoardMin: 8, rules: r }).boardInMin).toBe(8))
  it('you cannot board before you have walked there', () => expect(willIMakeIt({ nowMin: 600, nextBell: 620, etaBoardMin: 0, rules: r }).boardInMin).toBe(3))
  it('unknown without a shuttle signal (never guesses)', () => expect(willIMakeIt({ nowMin: 600, nextBell: 620, etaBoardMin: null, rules: r }).verdict).toBe('unknown'))
})

describe('excused for a slow ride', () => {
  const rules = DEFAULT_RULES // normal 5, threshold 3 → excused above 8
  it('a normal ride is not excused', () => expect(rideAssessment({ scanMin: 600, arriveMin: 605, nextBell: 620, rules })).toMatchObject({ excused: false, reason: 'ok', rideMin: 5 }))
  it('8 minutes is still fine; more than 8 is excused', () => {
    expect(rideAssessment({ scanMin: 600, arriveMin: 608, nextBell: 620, rules }).excused).toBe(false)
    expect(rideAssessment({ scanMin: 600, arriveMin: 608.5, nextBell: 620, rules })).toMatchObject({ excused: true, reason: 'slow_ride' })
  })
  it('a normal ride that still lands after the bell is excused', () => {
    expect(rideAssessment({ scanMin: 600, arriveMin: 606, nextBell: 605, rules })).toMatchObject({ excused: true, reason: 'misses_bell' })
  })
  it('reports minutes over a normal ride', () => expect(rideAssessment({ scanMin: 600, arriveMin: 611, nextBell: 620, rules }).extraMin).toBe(6))
  it('respects admin-configured numbers', () => {
    expect(rideAssessment({ scanMin: 600, arriveMin: 609, nextBell: 620, rules: { ...rules, normalRideMin: 7, delayThresholdMin: 3 } }).excused).toBe(false)
  })
})

describe('projected arrival', () => {
  it('an arrived run reports its real arrival', () => expect(projectedArrival({ run: run({ status: 'completed', arrivedAt: 606 }), stops, rules: DEFAULT_RULES, nowMin: 650 })).toBe(606))
  it('a boarding run: rest of the wait + a normal ride', () => {
    expect(projectedArrival({ run: run({ boardingAt: 600 }), stops, rules: DEFAULT_RULES, nowMin: 601 })).toBeCloseTo(601 + 1 + 5, 5)
  })
  it('a dispatch heads-up pushes the projection (boarding or moving)', () => {
    const b = bus({ reportedDelayMin: 9, lastLocation: loc(H.lat, H.lng) })
    expect(projectedArrival({ run: run({ boardingAt: 600 }), bus: b, stops, rules: DEFAULT_RULES, nowMin: 601 })).toBeCloseTo(601 + 1 + 5 + 9, 5)
    expect(projectedArrival({ run: run({ status: 'in_transit', departedAt: 602 }), bus: b, stops, rules: DEFAULT_RULES, nowMin: 603 })).toBeCloseTo(603 + 0.2 + 9, 5)
  })
})
