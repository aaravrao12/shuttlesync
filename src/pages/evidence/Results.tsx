import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Banner, Panel, Spinner, Toggle } from '@/components/ui/Primitives'
import { Pill } from '@/components/ui/StatusChip'
import { CompareBars } from '@/components/charts/CompareBars'
import { useCollection, useCampus, useRules } from '@/firebase/hooks'
import { computeResults, keywordThemes, PLACEHOLDER, type Stat } from '@/evidence/results'
import { callAI } from '@/ai/client'
import { ThemeResult } from '@/ai/schemas'
import { delta } from '@/lib/metrics'
import { useT } from '@/i18n'
import type { AnalyticsEvent, AttendanceDoc, BaselineEntry, Checkin, ChangelogEntry, Feedback, SusResponse, UsabilityTest } from '@/types'
import { useStaffUnlocked } from '@/app/session'

const pct = (v: number) => `${Math.round(v * 100)}%`

/** A single headline number that always shows where it came from (n and source), or a visible placeholder. */
function Big({ label, stat, fmt = (v: number) => String(Math.round(v)), note }: { label: string; stat: { value: number | null; n: number; source?: string }; fmt?: (v: number) => string; note?: string }) {
  const t = useT()
  const has = stat.value != null
  return (
    <Panel className="p-4" data-testid={`big-${label}`}>
      <div className={`font-display font-extrabold leading-none num ${has ? 'text-6xl' : 'text-3xl text-warn'}`}>{has ? fmt(stat.value as number) : PLACEHOLDER}</div>
      <div className="mt-2 font-medium">{label}</div>
      <div className="text-xs text-mute mt-0.5">{has ? `n=${stat.n}${stat.source ? ` · ${stat.source.replace('_', '-')}` : ''}` : t('No data yet')}{note ? ` · ${note}` : ''}</div>
    </Panel>
  )
}
const asStat = (value: number | null, n: number, source?: string): Stat => ({ value, n, source: source ?? '' })

export default function Results() {
  const t = useT()
  const staff = useStaffUnlocked()
  const campus = useCampus()
  const [includeSim, setIncludeSim] = useState(false)
  const baseline = useCollection<BaselineEntry>('baseline').rows
  const analytics = useCollection<AnalyticsEvent>('analytics').rows
  const checkins = useCollection<Checkin>('checkins').rows
  const attendance = useCollection<AttendanceDoc>('attendance').rows
  const tests = useCollection<UsabilityTest>('usabilityTests').rows
  const sus = useCollection<SusResponse>('susResponses').rows
  const feedback = useCollection<Feedback>('feedback').rows
  const changelog = useCollection<ChangelogEntry>('changelog').rows
  const [themes, setThemes] = useState<{ title: string; count: number; example: string }[] | null>(null)
  const [themeSrc, setThemeSrc] = useState<'ai' | 'keywords'>('keywords')
  const [busy, setBusy] = useState(false)

  const rules = useRules()
  const r = useMemo(() => computeResults({ baseline, analytics, checkins, attendance, runs: campus.runs, tests, sus, feedback, rides: rules }, includeSim), [baseline, analytics, checkins, attendance, campus.runs, tests, sus, feedback, includeSim, rules])
  if (!campus.ready) return <Spinner />

  async function summarize() {
    setBusy(true)
    try {
      const res = await callAI('themes', { text: JSON.stringify(r.feedbackTexts.slice(0, 80)) }, ThemeResult, 20000)
      setThemes(res.themes); setThemeSrc('ai')
    } catch { setThemes(keywordThemes(r.feedbackTexts)); setThemeSrc('keywords') }
    setBusy(false)
  }

  const successDelta = delta(r.usability.r1.successRate.value, r.usability.r2.successRate.value)
  const topChanges = [...changelog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  const noPilot = r.pilot.checkins === 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-6xl sm:text-7xl font-extrabold leading-[.9]">{t('Results')}</h1>
          <p className="text-mute mt-2 max-w-prose">{t('Every number here is computed from logged data. Each shows its sample size (n) and source. Anything we have not measured yet says so.')}</p>
        </div>
        <div className="no-print flex items-center gap-3 flex-wrap">
          <div className="w-72"><Toggle checked={includeSim} onChange={setIncludeSim} label={t('Include simulated demo data')} /></div>
          <Button variant="outline" icon="print" onClick={() => window.print()}>{t('Print handout')}</Button>
        </div>
      </header>
      {includeSim && <Banner tone="warn" icon="flask">{t('Simulated demo data is included below. Switch it off for real results.')}</Banner>}

      <section aria-labelledby="h-problem" className="space-y-4">
        <h2 id="h-problem" className="text-4xl font-bold">{t('The problem we measured')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Big label={t('students surveyed')} stat={r.baseline.surveyN} />
          <Big label={t('marked tardy because of a late shuttle')} stat={r.baseline.tardyPct} fmt={v => `${Math.round(v)}%`} />
          <Big label={t('late-bus tardies per month (reported)')} stat={r.baseline.latePerMonth} fmt={v => v.toFixed(1)} />
          <Big label={t('average real shuttle ride, ride-along (min)')} stat={r.baseline.rideAlongDelay} fmt={v => v.toFixed(1)} />
        </div>
        {r.baseline.quotes.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">{r.baseline.quotes.map(q => <blockquote key={q.id} className="border-l-4 border-brand pl-4 py-1"><p className="text-xl">“{q.value}”</p><footer className="text-sm text-mute mt-1">{q.notes || q.source.replace('_', '-')} · {q.date}</footer></blockquote>)}</div>
        ) : <p className="text-warn font-medium">{PLACEHOLDER} {t('(add interview quotes on the Baseline page)')}</p>}
      </section>

      <section aria-labelledby="h-pilot" className="space-y-4">
        <h2 id="h-pilot" className="text-4xl font-bold">{t('What happened in the pilot')}</h2>
        {noPilot && <Banner tone="info">{t('No real pilot check-ins yet. Switch the app to "Real pilot" mode in Demo control before the pilot starts.')}</Banner>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Big label={t('students who checked in')} stat={asStat(noPilot ? null : r.pilot.participants, r.pilot.participants, 'pilot')} />
          <Big label={t('school days')} stat={asStat(noPilot ? null : r.pilot.days, r.pilot.days, 'pilot')} />
          <Big label={t('total check-ins')} stat={asStat(noPilot ? null : r.pilot.checkins, r.pilot.checkins, 'pilot')} />
          <Big label={t('scans verified by location')} stat={asStat(r.pilot.scans.verificationRate.value == null ? null : r.pilot.scans.verificationRate.value * 100, r.pilot.scans.verificationRate.n, 'pilot')} fmt={v => `${Math.round(v)}%`} />
          <Big label={t('unverified scans a teacher cleared (false flags)')} stat={asStat(r.pilot.falseFlag.value == null ? null : r.pilot.falseFlag.value * 100, r.pilot.falseFlag.n, 'pilot')} fmt={v => `${Math.round(v)}%`} />
          <Big label={t('tardies excused for a slow shuttle')} stat={asStat(noPilot ? null : r.pilot.autoExcused, r.pilot.autoExcused, 'pilot')} />
          <Big label={t('teacher overrides')} stat={asStat(noPilot ? null : r.pilot.overrides, r.pilot.overrides, 'pilot')} />
          <Big label={t('median seconds to check in')} stat={asStat(r.pilot.medianCheckinSeconds, r.pilot.medianCheckinSeconds == null ? 0 : 1, 'pilot')} fmt={v => v.toFixed(0)} />
          <Big label={t('average shuttle ride during pilot (min)')} stat={asStat(r.pilot.delay.averageRideMin, r.pilot.delay.n, 'pilot')} fmt={v => v.toFixed(1)} />
          <Big label={t('shuttle runs slower than normal')} stat={asStat(r.pilot.delay.n ? r.pilot.delay.slowRuns : null, r.pilot.delay.n, 'pilot')} />
          <Big label={t('teacher minutes saved (estimate)')} stat={asStat(noPilot ? null : r.pilot.minutesSaved, r.pilot.autoExcused, 'estimate')} note={t('see Reports for the formula')} />
        </div>
      </section>

      <section aria-labelledby="h-usab" className="space-y-4">
        <h2 id="h-usab" className="text-4xl font-bold">{t('Round 1 vs round 2 testing')}</h2>
        <Panel className="p-4">
          <CompareBars aName={t('Round 1')} bName={t('Round 2')} rows={[
            { label: t('Task success'), a: { value: r.usability.r1.successRate.value, n: r.usability.r1.n }, b: { value: r.usability.r2.successRate.value, n: r.usability.r2.n }, max: 1, fmt: pct },
            { label: t('Median time to finish a task'), a: { value: r.usability.r1.medianMs == null ? null : r.usability.r1.medianMs / 1000, n: r.usability.r1.n }, b: { value: r.usability.r2.medianMs == null ? null : r.usability.r2.medianMs / 1000, n: r.usability.r2.n }, max: Math.max(60, (r.usability.r1.medianMs ?? 0) / 1000, (r.usability.r2.medianMs ?? 0) / 1000), fmt: v => `${Math.round(v)} s` },
            { label: t('System Usability Scale (0–100)'), a: { value: r.usability.sus1.value, n: r.usability.sus1.n }, b: { value: r.usability.sus2.value, n: r.usability.sus2.n }, max: 100, fmt: v => v.toFixed(0) },
          ]} />
          {successDelta && <p className="mt-4 font-medium">{t('Task success changed by {d} percentage points between rounds.', { d: (successDelta.abs * 100).toFixed(0) })}</p>}
        </Panel>
        <p className="text-sm text-mute">{t('Ease of use (1–5): {e}. Would use (1–5): {w}. From {n} feedback responses.', { e: r.feedback.ease?.toFixed(1) ?? '–', w: r.feedback.wouldUse?.toFixed(1) ?? '–', n: r.feedback.n })}</p>
      </section>

      <section aria-labelledby="h-change" className="space-y-4">
        <div className="flex items-center justify-between"><h2 id="h-change" className="text-4xl font-bold">{t('Users said, we changed')}</h2><Link to="/changelog" className="underline text-sm">{t('Full changelog')}</Link></div>
        {topChanges.length === 0 ? <p className="text-warn font-medium">{PLACEHOLDER} {t('(log changes on the Changelog page)')}</p> : (
          <ol className="grid gap-3 md:grid-cols-3">{topChanges.map(c => <li key={c.id}><Panel className="p-4"><div className="text-xs text-mute num">{c.date}</div><p className="mt-1"><b>{t('Users said:')}</b> {c.observation}</p><p className="mt-1"><b>{t('We changed:')}</b> {c.change}</p><p className="mt-1"><b>{t('Result:')}</b> {c.resultAfter || '–'}</p></Panel></li>)}</ol>
        )}
      </section>

      <section aria-labelledby="h-fb" className="space-y-3">
        <h2 id="h-fb" className="text-4xl font-bold">{t('What people told us')}</h2>
        {staff && <Button variant="outline" icon="spark" disabled={busy || !r.feedbackTexts.length} onClick={summarize} className="no-print">{t('Group feedback into themes')}</Button>}
        {themes && <div><Pill tone="mute" icon={themeSrc === 'ai' ? 'spark' : 'file'}>{themeSrc === 'ai' ? t('Grouped by AI') : t('Grouped by common words (AI off)')}</Pill>
          <ul className="mt-2 grid gap-2 md:grid-cols-2">{themes.map(x => <li key={x.title} className="bg-panel border border-line rounded-sign p-3"><b>{x.title}</b> <span className="text-mute num">×{x.count}</span><p className="text-sm text-mute mt-1">“{x.example}”</p></li>)}</ul></div>}
        {!themes && r.feedbackTexts.length === 0 && <p className="text-mute">{t('No written feedback yet.')}</p>}
      </section>
    </div>
  )
}
