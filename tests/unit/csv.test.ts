import { describe, it, expect } from 'vitest'
import { parseCsvLine, parseEnrollment } from '@/lib/csvImport'
import { BUILDINGS, makeTeachers } from '@/demo/seedData'

describe('CSV enrollment', () => {
  it('parses quoted values', () => { expect(parseCsvLine('a,"b, c",d')).toEqual(['a', 'b, c', 'd']) })
  const csv = `name,studentNumber,grade,period,building,room,teacher,course
Ana Soto,1001,10,1,A,A101,Okafor,English
Ana Soto,1001,10,2,C,C204,Rivera,Algebra
Ben Ray,1002,11,1,B,B110,Chen,Chem`
  it('groups rows into students with schedules and matches teachers', () => {
    const r = parseEnrollment(csv, BUILDINGS, makeTeachers())
    expect(r.errors).toEqual([]); expect(r.students).toHaveLength(2)
    const ana = r.students.find(s => s.studentNumber === '1001')!
    expect(ana.schedule.map(e => e.buildingId)).toEqual(['A', 'C']); expect(ana.schedule[1].teacherId).toBe('t-rivera')
  })
  it('reports row-level errors instead of failing silently', () => {
    const r = parseEnrollment(csv + '\nCy Lee,1003,9,3,Z,Z1,x,y', BUILDINGS, makeTeachers())
    expect(r.errors[0]).toMatch(/Row 5: unknown building "Z"/)
  })
  it('requires the header columns', () => { expect(parseEnrollment('foo\nbar', BUILDINGS, []).errors.length).toBeGreaterThan(0) })
})
