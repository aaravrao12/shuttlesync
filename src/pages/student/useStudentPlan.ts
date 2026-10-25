// One hook that answers "what should THIS student do now, and what is their status?" — used by Today, Shuttles, Scan.
// There is no timetable: the answer is built from the student's next class, where each shuttle is right now,
// and (once they check in) the shuttle run they are riding.
import { useMemo } from 'react'
import type { Checkin, LiveStatus, Run, Student } from '@/types'
import { useCampus, useCollection, useDocument, useNow, useRules } from '@/firebase/hooks'
import { activeStops, currentTransition, etaToBoard, planDay, projectedArrival, rideAssessment, shuttleWhere, willIMakeIt, type ShuttleWhere } from '@/lib/shuttle'
import { checkinForTransition } from '@/lib/roster'
import { resolveStatus } from '@/lib/studentStatus'
import { useProfile } from '@/app/session'

export interface ShuttleLive { busId: string; where: ShuttleWhere; etaToMeMin: number | null; riders: number; run: Run | null; delayMinutes: number }

export function useStudentPlan() {
  const profile = useProfile()
  const campus = useCampus()
  const rules = useRules()
  const now = useNow(1000)
  const student = useDocument<Student>('students', profile.studentId)
  const { rows: checkins } = useCollection<Checkin>('checkins')

  return useMemo(() => {
    const todayRuns = campus.runs.filter(r => r.date === now.date)
    const runById = new Map(todayRuns.map(r => [r.id, r]))
    const stops = activeStops(campus.stops, rules)
    const plans = student ? planDay(student.schedule, campus.bell, campus.buildings, campus.stops, rules) : []
    const plan = currentTransition(plans, now.minutes)
    const boardStop = plan?.boardStopId ? campus.stopById.get(plan.boardStopId) : undefined
    const nowReal = Date.now()

    // Where is every shuttle, how long until I can board it, and how many riders are on its current run?
    const shuttles: ShuttleLive[] = campus.buses.map(bus => {
      const run = bus.activeRunId ? runById.get(bus.activeRunId) ?? null : null
      const where = shuttleWhere(bus, run, stops, nowReal)
      const etaToMeMin = boardStop && plan?.needsShuttle ? etaToBoard({ bus, run, board: boardStop, stops, rules, nowMin: now.minutes, nowRealMs: nowReal }) : null
      return { busId: bus.id, where, etaToMeMin, riders: run ? checkins.filter(c => c.runId === run.id).length : 0, run, delayMinutes: bus.delayMinutes ?? 0 }
    })
    const etas = shuttles.map(s => s.etaToMeMin).filter((x): x is number => x != null)
    const bestEta = etas.length ? Math.min(...etas) : null
    const makeIt = plan?.needsShuttle ? willIMakeIt({ nowMin: now.minutes, nextBell: plan.nextBell, etaBoardMin: bestEta, rules }) : null

    const mine = student ? checkins.filter(c => c.studentId === student.id) : []
    const checkin = plan?.needsShuttle && student ? checkinForTransition(student.id, mine, todayRuns, plan.toZone, plan.prevEnd, plan.nextBell) : null
    const run = checkin ? runById.get(checkin.runId) ?? null : null
    const bus = run ? campus.busById.get(run.busId) : undefined

    let projected: number | null = null
    let status: LiveStatus | null = null
    let assessment = null as ReturnType<typeof rideAssessment> | null
    if (plan) {
      if (run && checkin) {
        projected = projectedArrival({ run, bus, stops, rules, nowMin: now.minutes })
        assessment = rideAssessment({ scanMin: checkin.scannedAtSchoolMin, arriveMin: projected, nextBell: plan.nextBell, rules })
      }
      status = resolveStatus({ needsShuttle: plan.needsShuttle, checkin, runCompleted: run?.status === 'completed', rideExcused: assessment?.excused, nextBell: plan.nextBell, nowMin: now.minutes })
    }
    return { student, campus, rules, now, plans, plan, boardStop, shuttles, bestEta, makeIt, checkin, run, bus, status, projected, assessment, todayRuns, checkins: mine }
  }, [student, campus.runs, campus.buses, campus.bell, campus.stops, campus.buildings, rules, checkins, now.minutes, now.date])
}
