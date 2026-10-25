import { describe, it, expect } from 'vitest'
import { templateNote, validateNote, type NoteFacts } from '@/ai/note'
import { ScheduleExtraction, TimetableExtraction, NoteResult } from '@/ai/schemas'
import { PROMPTS } from '@/ai/prompts'
import { SYSTEM } from '../../api/gemini'

const facts: NoteFacts = { period: 3, total: 12, arrived: 5, onTheWay: 2, excused: 4, unverified: 1, notCheckedIn: 1, lateBuses: [{ bus: '2', minutes: 9 }] }

describe('AI note guardrails', () => {
  it('template mentions every attention count', () => {
    const n = templateNote(facts)
    expect(validateNote(n, facts)).toBe(true)
    expect(n).toMatch(/4 students excused/)
    expect(n).toMatch(/Shuttle 2/)
    expect(n).toMatch(/9 min over normal/)
  })
  it('accepts a faithful AI sentence', () => {
    expect(validateNote("4 students excused because Shuttle 2's ride ran 9 minutes over normal; 1 unverified; 1 not checked in.", facts)).toBe(true)
  })
  it('rejects invented numbers', () => {
    expect(validateNote('7 students excused; 1 unverified; 1 not checked in.', facts)).toBe(false)
  })
  it('rejects a note that omits a non-zero attention count', () => {
    expect(validateNote('4 students excused for Shuttle 2.', facts)).toBe(false)
  })
  it('all-clear template', () => {
    expect(templateNote({ ...facts, excused: 0, unverified: 0, notCheckedIn: 0 })).toMatch(/all 12 expected students/)
  })
})

describe('AI schemas', () => {
  it('accepts a good schedule and rejects garbage', () => {
    expect(ScheduleExtraction.safeParse({ entries: [{ period: 1, courseName: 'English III' }] }).success).toBe(true)
    expect(ScheduleExtraction.safeParse({ entries: [{ period: 99, courseName: 'x' }] }).success).toBe(false)
    expect(ScheduleExtraction.safeParse('hello').success).toBe(false)
  })
  it('validates timetable times', () => {
    expect(TimetableExtraction.safeParse({ trips: [{ busNumber: '14', fromStop: 'A', toStop: 'C', depart: '9:04 AM', arrive: '9:12 AM' }] }).success).toBe(true)
    expect(TimetableExtraction.safeParse({ trips: [{ busNumber: '14', fromStop: 'A', toStop: 'C', depart: 'soon', arrive: '9:12' }] }).success).toBe(false)
  })
  it('note must be a sensible length', () => { expect(NoteResult.safeParse({ note: 'ok' }).success).toBe(false) })
})

describe('prompt copies stay in sync', () => {
  it('client prompts equal server prompts', () => {
    for (const k of Object.keys(PROMPTS) as (keyof typeof PROMPTS)[]) expect(SYSTEM[k]).toBe(PROMPTS[k].system)
  })
})
