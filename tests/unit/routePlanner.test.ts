// (File name kept from the timetable era; these now test lib/shuttle.ts: who needs the shuttle, and which stop they use.)
import { describe, it, expect } from 'vitest'
import { shuttleNeed, planDay, stopFor, activeStops, DEFAULT_RULES, currentTransition, otherZone } from '@/lib/shuttle'
import { BUILDINGS, STOPS, makeBell, makeStudents } from '@/demo/seedData'

const b = (id: string) => BUILDINGS.find(x => x.id === id)!
const bell = makeBell()
const rain = { ...DEFAULT_RULES, rainStopActive: true }

describe('which classes need the shuttle', () => {
  it('A, D and E are one zone: walk indoors', () => {
    expect(shuttleNeed(b('A'), b('D')).needs).toBe(false)
    expect(shuttleNeed(b('D'), b('E')).needs).toBe(false)
    expect(shuttleNeed(b('E'), b('A')).needs).toBe(false)
  })
  it('main <-> annex needs the shuttle, in both directions', () => {
    expect(shuttleNeed(b('A'), b('H'))).toEqual({ needs: true, fromZone: 'main', toZone: 'annex' })
    expect(shuttleNeed(b('H'), b('D'))).toEqual({ needs: true, fromZone: 'annex', toZone: 'main' })
  })
  it('H to H and anything involving a closed building needs nothing', () => {
    expect(shuttleNeed(b('H'), b('H')).needs).toBe(false)
    expect(shuttleNeed(b('B'), b('H')).needs).toBe(false)
    expect(shuttleNeed(b('A'), b('C')).needs).toBe(false)
  })
  it('zones flip', () => { expect(otherZone('main')).toBe('annex'); expect(otherZone('annex')).toBe('main') })
})

describe('which stop a student uses', () => {
  it('D and E have no stop of their own: they use the A loop', () => {
    expect(stopFor(b('D'), STOPS, DEFAULT_RULES)?.id).toBe('stop-a')
    expect(stopFor(b('E'), STOPS, DEFAULT_RULES)?.id).toBe('stop-a')
    expect(stopFor(b('H'), STOPS, DEFAULT_RULES)?.id).toBe('stop-h')
  })
  it('the rain stop is ignored until the admin turns it on', () => {
    expect(activeStops(STOPS, DEFAULT_RULES).map(s => s.id)).toEqual(['stop-a', 'stop-h'])
    expect(activeStops(STOPS, rain).map(s => s.id)).toContain('stop-rain')
  })
  it('in rain, D and E students use the rain stop; A students still use the A loop', () => {
    expect(stopFor(b('D'), STOPS, rain)?.id).toBe('stop-rain')
    expect(stopFor(b('E'), STOPS, rain)?.id).toBe('stop-rain')
    expect(stopFor(b('A'), STOPS, rain)?.id).toBe('stop-a')
  })
  it('closed buildings have no stop', () => { expect(stopFor(b('B'), STOPS, DEFAULT_RULES)).toBeUndefined() })
})

describe('planDay', () => {
  it('Maya (periods 0–7: A A A H H D D E): shuttle before P3 (A→H) and P5 (H→D); walking indoors otherwise', () => {
    const maya = makeStudents()[0]
    const plans = planDay(maya.schedule, bell, BUILDINGS, STOPS, DEFAULT_RULES)
    expect(plans.map(p => p.toPeriod)).toEqual([1, 2, 3, 4, 5, 6, 7]) // period 0 has no passing period before it
    expect(plans.map(p => p.needsShuttle)).toEqual([false, false, true, false, true, false, false])
    expect(plans[2]).toMatchObject({ toPeriod: 3, fromZone: 'main', toZone: 'annex', boardStopId: 'stop-a', destStopId: 'stop-h' })
    expect(plans[4]).toMatchObject({ toPeriod: 5, fromZone: 'annex', toZone: 'main', boardStopId: 'stop-h', destStopId: 'stop-a' })
    expect(plans[6].message).toMatch(/walk indoors/i)
  })
  it('uses the real bell: P3 ends 11:49, lunch until 12:49, P4 bell 12:49', () => {
    const p3 = bell.find(b => b.period === 3)!, p4 = bell.find(b => b.period === 4)!
    expect(p3.end).toBe(11 * 60 + 49); expect(p4.start).toBe(12 * 60 + 49)
    expect(p4.lunchBefore).toEqual({ start: 11 * 60 + 49, end: 12 * 60 + 49, splitAt: 12 * 60 + 18 })
    expect(bell.map(b => b.period)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
  it('the 11:49–12:49 lunch hour is part of the P3→P4 transition (the bell for P4 is 12:49)', () => {
    const isabella = makeStudents().find(s => s.code === 'S09')! // DDDDHHAA: D at P3, H at P4
    const t = planDay(isabella.schedule, bell, BUILDINGS, STOPS, DEFAULT_RULES).find(p => p.toPeriod === 4)!
    expect(t).toMatchObject({ needsShuttle: true, prevEnd: 11 * 60 + 49, nextBell: 12 * 60 + 49 })
  })
  it('never schedules a shuttle for students who stay in one zone', () => {
    const mason = makeStudents().find(s => s.code === 'S10')!
    expect(planDay(mason.schedule, bell, BUILDINGS, STOPS, DEFAULT_RULES).some(p => p.needsShuttle)).toBe(false)
  })
  it('in rain the destination for a D class is the rain stop', () => {
    const maya = makeStudents()[0]
    expect(planDay(maya.schedule, bell, BUILDINGS, STOPS, rain)[4].destStopId).toBe('stop-rain')
  })
  it('currentTransition is the first passing period whose bell has not rung', () => {
    const plans = planDay(makeStudents()[0].schedule, bell, BUILDINGS, STOPS, DEFAULT_RULES)
    const end2 = bell.find(b => b.period === 2)!.end, start3 = bell.find(b => b.period === 3)!.start
    expect(currentTransition(plans, end2 + 1)?.toPeriod).toBe(3)
    expect(currentTransition(plans, start3 - 1)?.toPeriod).toBe(3)
    expect(currentTransition(plans, start3 + 5)?.toPeriod).toBe(4)
  })
})
