// Everything on the Results page is computed here from the Evidence store, via lib/metrics.ts.
// No number is typed in by hand anywhere: if the data is missing, the page shows [REPLACE WITH SURVEY DATA].
import type { AnalyticsEvent, AttendanceDoc, BaselineEntry, Checkin, Feedback, Run, SusResponse, UsabilityTest } from '@/types'
import { autoExcusedCount, delayStats, falseFlagRate, feedbackStats, medianCheckinSeconds, overrideCount, realOnly, scanStats, susAverage, taskStats, teacherMinutesSaved } from '@/lib/metrics'
import { schoolDate } from '@/lib/time'

export const PLACEHOLDER = '[REPLACE WITH SURVEY DATA]'

export interface ResultsInput {
  baseline: BaselineEntry[]; analytics: AnalyticsEvent[]; checkins: Checkin[]; attendance: AttendanceDoc[]
  /** shuttle runs (detected from GPS); there is no timetable to compare against */
  runs: Run[]; tests: UsabilityTest[]; sus: SusResponse[]; feedback: Feedback[]
  /** the ride-time rules in force (admin-configurable); defaults 5 min normal, 3 min threshold */
  rides?: { normalRideMin: number; delayThresholdMin: number }
}

export interface Stat { value: number | null; n: number; source: string }

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** Baseline lookup: the survey/ride-along/interview rows the evidence lead typed in on /baseline. */
export function baselineStat(rows: BaselineEntry[], metric: string, source?: BaselineEntry['source']): Stat {
  const m = rows.filter(r => r.metric === metric && (!source || r.source === source) && typeof r.value === 'number')
  if (!m.length) return { value: null, n: 0, source: source ?? 'baseline' }
  const totalN = m.reduce((a, r) => a + (r.n || 1), 0)
  // weight by sample size when several rows report the same metric
  const weighted = m.reduce((a, r) => a + (r.value as number) * (r.n || 1), 0) / totalN
  return { value: weighted, n: totalN, source: m[0].source }
}

export function computeResults(i: ResultsInput, includeSim: boolean) {
  const checkins = realOnly(i.checkins, includeSim)
  const attendance = includeSim ? i.attendance : i.attendance.filter(a => !a.isSimulated)
  const analytics = realOnly(i.analytics, includeSim)
  const feedback = realOnly(i.feedback, includeSim)

  const days = new Set(checkins.map(c => schoolDate(new Date(c.scannedAt))))
  const pilotRuns = includeSim ? i.runs : i.runs.filter(r => !r.isSimulated && days.has(r.date))
  const scans = scanStats(checkins)
  const delay = delayStats(pilotRuns, i.rides?.normalRideMin, i.rides?.delayThresholdMin)
  const excused = autoExcusedCount(attendance)

  // Ride-along rows are real ride durations in minutes (leaving one loop → reaching the other); there is no timetable to compare against.
  const rideDelays = i.baseline.filter(b => b.source === 'ride_along' && b.metric === 'ride_min' && typeof b.value === 'number')
  return {
    baseline: {
      surveyN: baselineStat(i.baseline, 'survey_responses', 'survey'),
      tardyPct: baselineStat(i.baseline, 'tardy_from_shuttle_pct', 'survey'),
      latePerMonth: baselineStat(i.baseline, 'late_bus_per_month', 'survey'),
      wouldScanPct: baselineStat(i.baseline, 'would_scan_pct', 'survey'),
      spanishPct: baselineStat(i.baseline, 'prefers_spanish_pct', 'survey'),
      rideAlongDelay: { value: mean(rideDelays.map(r => r.value as number)), n: rideDelays.length, source: 'ride_along' } as Stat,
      quotes: i.baseline.filter(b => b.metric === 'quote' && typeof b.value === 'string'),
    },
    pilot: {
      participants: new Set(checkins.map(c => c.studentId)).size,
      days: days.size,
      checkins: scans.total,
      scans,
      falseFlag: falseFlagRate(checkins, attendance),
      autoExcused: excused,
      overrides: overrideCount(attendance),
      minutesSaved: teacherMinutesSaved(excused),
      delay,
      medianCheckinSeconds: medianCheckinSeconds(analytics),
    },
    usability: {
      r1: taskStats(i.tests, 1), r2: taskStats(i.tests, 2),
      sus1: susAverage(i.sus, 1), sus2: susAverage(i.sus, 2),
    },
    feedback: feedbackStats(feedback),
    feedbackTexts: feedback.filter(f => f.text).map(f => f.text),
  }
}
export type ResultsData = ReturnType<typeof computeResults>

/** Offline fallback for the feedback summarizer: count the most common meaningful words. Honest and explainable. */
export function keywordThemes(texts: string[]): { title: string; count: number; example: string }[] {
  const stop = new Set('the a an and or but to of in on it is was were be been i my me we you your for with at this that too very so not no just really can could would should app have has had are as if when what which'.split(' '))
  const counts = new Map<string, { n: number; ex: string }>()
  for (const t of texts) {
    for (const w of new Set(t.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !stop.has(w)))) {
      const c = counts.get(w) ?? { n: 0, ex: t }
      counts.set(w, { n: c.n + 1, ex: c.ex })
    }
  }
  return [...counts].filter(([, c]) => c.n >= 2).sort((a, b) => b[1].n - a[1].n).slice(0, 6).map(([title, c]) => ({ title, count: c.n, example: c.ex }))
}
