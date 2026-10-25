import { useMemo } from 'react'
import type { AttendanceDoc, Checkin, Teacher } from '@/types'
import { useCampus, useCollection, useNow, usePeople, useRules } from '@/firebase/hooks'
import { attendanceDocId, buildRoster } from '@/lib/roster'

export function useTeacherRoster(teacher: Teacher | null | undefined, period: number | null) {
  const campus = useCampus()
  const rules = useRules()
  const now = useNow(1000)
  const { students } = usePeople()
  const { rows: checkins } = useCollection<Checkin>('checkins')
  const { rows: attendance } = useCollection<AttendanceDoc>('attendance')
  const docId = teacher && period ? attendanceDocId(now.date, period, teacher.id) : null
  const att = docId ? attendance.find(a => a.id === docId) ?? null : null
  const today = useMemo(() => campus.runs.filter(r => r.date === now.date), [campus.runs, now.date])
  const result = useMemo(() => {
    if (!teacher || !period) return null
    return buildRoster({ teacherId: teacher.id, period, students, bell: campus.bell, buildings: campus.buildings, stops: campus.stops, buses: campus.buses, runs: today, checkins, attendance: att, nowMin: now.minutes, rules })
  }, [teacher, period, students, campus.bell, campus.buildings, campus.stops, campus.buses, today, checkins, att, now.minutes, rules])
  return { campus, now, rules, roster: result, attendance: att, docId, today }
}
