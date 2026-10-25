import { useMemo } from 'react'
import { useCampus, useCollection, useRules } from '@/firebase/hooks'
import { computeResults } from './results'
import type { AnalyticsEvent, AttendanceDoc, BaselineEntry, Checkin, ChangelogEntry, Feedback, SusResponse, UsabilityTest } from '@/types'

/** All evidence collections → computed results, in one hook (used by the pitch page). */
export function useResultsData(includeSim = false) {
  const campus = useCampus()
  const rules = useRules()
  const baseline = useCollection<BaselineEntry>('baseline').rows
  const analytics = useCollection<AnalyticsEvent>('analytics').rows
  const checkins = useCollection<Checkin>('checkins').rows
  const attendance = useCollection<AttendanceDoc>('attendance').rows
  const tests = useCollection<UsabilityTest>('usabilityTests').rows
  const sus = useCollection<SusResponse>('susResponses').rows
  const feedback = useCollection<Feedback>('feedback').rows
  const changelog = useCollection<ChangelogEntry>('changelog').rows
  const results = useMemo(() => computeResults({ baseline, analytics, checkins, attendance, runs: campus.runs, tests, sus, feedback, rides: rules }, includeSim), [baseline, analytics, checkins, attendance, campus.runs, tests, sus, feedback, includeSim, rules])
  return { results, changelog, baseline }
}
