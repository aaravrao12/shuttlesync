import { Suspense, lazy, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { BuildingBadge, BusSign } from '@/components/ui/BuildingBadge'
import { StatusChip } from '@/components/ui/StatusChip'
import { useCampus, useCollection } from '@/firebase/hooks'
import { computeResults, PLACEHOLDER } from '@/evidence/results'
import { useT } from '@/i18n'
import type { AnalyticsEvent, AttendanceDoc, BaselineEntry, Checkin, ChangelogEntry, Feedback, SusResponse, UsabilityTest } from '@/types'

const CinematicHero = lazy(() => import('./cinematic/CinematicHero').then(m => ({ default: m.CinematicHero })))

/**
 * The scroll-scrubbed film (≈9 MB of frames, loaded progressively) only where it will run well: a desktop-width screen,
 * no reduced-motion preference, not a data-saver or low-end device. Everyone else gets the poster hero, which is one 100 KB image.
 */
function canCinema(): boolean {
  try {
    if (!matchMedia('(min-width: 900px)').matches) return false
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    if ((navigator as any).connection?.saveData) return false
    return (navigator.hardwareConcurrency ?? 8) >= 4
  } catch { return false }
}

// Fill in real names. Nothing is invented here: until you do, the page says so.
const TEAM = [
  { name: '', module: 'Student app, route planner, schedule photo AI' },
  { name: '', module: 'QR check-in, verification, stop kiosk' },
  { name: '', module: 'Bus mode, geofencing, ETA, real-time dashboard' },
  { name: '', module: 'Evidence, Results, Test Mode, AI note, pitch' },
]

function StatBlock({ label, value, n, hasData }: { label: string; value: string; n?: number; hasData: boolean }) {
  const t = useT()
  return (
    <div className="border-t-4 border-ink pt-3">
      <div className={`font-display font-extrabold leading-none num ${hasData ? 'text-7xl' : 'text-3xl text-warn'}`}>{hasData ? value : PLACEHOLDER}</div>
      <div className="mt-2 font-medium max-w-[16rem]">{label}</div>
      <div className="text-xs text-mute mt-0.5">{hasData ? `n=${n}` : t('No data yet')}</div>
    </div>
  )
}

export default function Landing() {
  const t = useT()
  const [cinema] = useState(canCinema)
  const campus = useCampus()

  const baseline = useCollection<BaselineEntry>('baseline').rows
  const analytics = useCollection<AnalyticsEvent>('analytics').rows
  const checkins = useCollection<Checkin>('checkins').rows
  const attendance = useCollection<AttendanceDoc>('attendance').rows
  const tests = useCollection<UsabilityTest>('usabilityTests').rows
  const sus = useCollection<SusResponse>('susResponses').rows
  const feedback = useCollection<Feedback>('feedback').rows
  const changelog = useCollection<ChangelogEntry>('changelog').rows
  const r = useMemo(() => computeResults({ baseline, analytics, checkins, attendance, runs: campus.runs, tests, sus, feedback }, false), [baseline, analytics, checkins, attendance, campus.runs, tests, sus, feedback])

  const steps = [
    { k: 'plan', h: t('If the bus is late, the student isn\'t.'), b: t('Buildings B and C are closed for construction, so students ride one shuttle loop between the main campus and the Annex. ShuttleSync shows who needs it, whether they will make it, and protects them when the shuttle runs slow.') },
    { k: 'scan', h: t('Scan once. The teacher sees you.'), b: t('A passenger phone on the shuttle shares its location. You scan the shuttle code and your name turns up on your teacher\'s live roster.') },
    { k: 'arrive', h: t('Slow shuttle? You\'re covered.'), b: t('If your ride takes longer than normal, or lands after the bell, you are excused automatically. Everyone else stays "not checked in" until your teacher decides.') },
  ]
  const heroCta = (
    <div className="flex flex-wrap gap-3 mt-7">
      <Link to="/start"><Button size="lg" variant="sign" icon="phone" data-testid="cta-open">{t('Try the demo')}</Button></Link>
      <Link to="/how-it-works"><Button size="lg" variant="outline">{t('How it works')}</Button></Link>
    </div>
  )

  return (
    <div>
      {cinema ? (
        <Suspense fallback={<div className="h-[calc(100dvh-3.5rem)] bg-[rgb(12_13_16)]" />}><CinematicHero /></Suspense>
      ) : (
        <>
          {/* phones, reduced motion, data saver: one poster image (≈100 KB) instead of the film */}
          <section className="relative isolate overflow-hidden bg-[rgb(12_13_16)] text-white">
            <img src="/cinematic/poster-aerial.jpg" alt="" width={960} height={536} fetchPriority="high" className="absolute inset-0 -z-10 h-full w-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(12,13,16,.55)_0%,rgba(12,13,16,.82)_60%,rgba(12,13,16,.95)_100%)]" />
            <div className="mx-auto max-w-6xl px-4 pt-14 pb-16">
              <div className="mb-4"><BusSign number="1" toCode="H" /></div>
              <h1 className="text-[clamp(3.4rem,13vw,7rem)] font-extrabold leading-[.86] max-w-3xl">{steps[0].h}</h1>
              <p className="text-lg mt-4 max-w-md text-white/85">{steps[0].b}</p>
              <div className="flex flex-wrap gap-3 mt-7">
                <Link to="/start"><Button size="lg" variant="sign" icon="phone" data-testid="cta-open">{t('Try the demo')}</Button></Link>
                <Link to="/how-it-works"><Button size="lg" variant="outline" className="!bg-transparent !text-white !border-white/60">{t('How it works')}</Button></Link>
              </div>
              <p className="mt-6 text-[11px] text-white/60">{t('AI-generated illustration, not footage of the real campus.')}</p>
            </div>
          </section>
          <section className="mx-auto max-w-6xl px-4 py-10 grid md:grid-cols-2 gap-4">
            {steps.slice(1).map(x => <div key={x.k} className="bg-panel border border-line rounded-sign p-5"><h2 className="text-4xl font-bold leading-none">{x.h}</h2><p className="mt-2 text-mute">{x.b}</p></div>)}
          </section>
        </>
      )}

      {/* ---- the problem, with real numbers or visible placeholders ---- */}
      <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="problem">
        <div className="grid md:grid-cols-[1fr_1.4fr] gap-10">
          <div>
            <h2 id="problem" className="text-6xl font-extrabold leading-[.9]">{t('A late bus becomes a student\'s tardy')}</h2>
            <p className="mt-4 text-mute max-w-md">{t('Students cannot tell whether they will make it across the road to the Annex, get marked tardy when the shuttle is slow, and cannot prove they were on it. Teachers lose class time sorting it out. The office fixes tardies after the fact.')}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-8">
            <StatBlock label={t('students surveyed')} value={String(Math.round(r.baseline.surveyN.value ?? 0))} n={r.baseline.surveyN.n} hasData={r.baseline.surveyN.value != null} />
            <StatBlock label={t('were marked tardy because of a late shuttle')} value={`${Math.round(r.baseline.tardyPct.value ?? 0)}%`} n={r.baseline.tardyPct.n} hasData={r.baseline.tardyPct.value != null} />
            <StatBlock label={t('average real shuttle ride (ride-along, minutes)')} value={(r.baseline.rideAlongDelay.value ?? 0).toFixed(1)} n={r.baseline.rideAlongDelay.n} hasData={r.baseline.rideAlongDelay.value != null} />
            <div className="border-t-4 border-ink pt-3">
              {r.baseline.quotes[0] ? <blockquote><p className="text-2xl leading-snug">“{r.baseline.quotes[0].value}”</p><footer className="text-sm text-mute mt-1">{r.baseline.quotes[0].notes}</footer></blockquote> : <p className="text-3xl font-display font-extrabold text-warn">{PLACEHOLDER}<span className="block text-sm font-sans font-normal text-mute mt-1">{t('teacher or attendance-office quote')}</span></p>}
            </div>
          </div>
        </div>
      </section>

      {/* ---- three experiences, built from the real components ---- */}
      <section className="bg-panel border-y border-line py-16" aria-labelledby="exp">
        <div className="mx-auto max-w-6xl px-4">
          <h2 id="exp" className="text-6xl font-extrabold leading-[.9] max-w-2xl">{t('Three screens, one idea')}</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            <article className="rounded-sign bg-[rgb(var(--sign))] text-[rgb(var(--sign-ink))] p-5 flex flex-col gap-3">
              <h3 className="text-3xl font-bold leading-none">{t('Students')}</h3>
              <span className="self-start inline-flex items-center gap-2 rounded-pill bg-ok text-[rgb(var(--brand-ink))] px-3 py-1 font-bold"><Icon name="check-circle" size={16} />{t('On track')}</span>
              <div className="font-display text-5xl font-extrabold leading-[.9]">{t('Will I make it?')}</div>
              <p className="text-sm font-medium">{t('The live shuttle tracker, always on top. One tap to check in when you board.')}</p>
            </article>
            <article className="rounded-sign bg-[rgb(21_23_27)] text-white p-5 flex flex-col gap-3">
              <h3 className="text-3xl font-bold leading-none">{t('Bus phone')}</h3>
              <div className="grid grid-cols-5 gap-1 w-24" aria-hidden>{Array.from({ length: 25 }, (_, i) => <span key={i} className={`aspect-square rounded-[2px] ${[0, 1, 2, 4, 5, 6, 10, 12, 14, 18, 20, 22, 23, 24, 8, 16].includes(i) ? 'bg-white' : 'bg-white/10'}`} />)}</div>
              <p className="text-sm opacity-90">{t('A passenger shares the shuttle location and shows a code that changes every minute. Never the driver.')}</p>
            </article>
            <article className="rounded-sign bg-ground border border-line p-5 flex flex-col gap-3">
              <h3 className="text-3xl font-bold leading-none">{t('Teachers')}</h3>
              <ul className="space-y-2 text-sm">
                {([['Maya R.', 'arrived'], ['Jordan L.', 'excused_bus_late'], ['Noah W.', 'not_checked_in']] as const).map(([n, st]) => <li key={n} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1"><span className="font-bold">{n}</span><StatusChip status={st} compact /></li>)}
              </ul>
              <p className="text-xs text-mute">{t('Example names. The live roster updates the moment a student scans.')}</p>
            </article>
          </div>
        </div>
      </section>

      {/* ---- how we tested it, straight from the Results data ---- */}
      <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="tested">
        <div className="grid md:grid-cols-[1fr_1.4fr] gap-10 items-start">
          <div>
            <h2 id="tested" className="text-6xl font-extrabold leading-[.9]">{t('How we tested it')}</h2>
            <p className="mt-4 text-mute max-w-md">{t('We asked students and teachers first, built second, then tested with people who had never seen it. Every number links to its sample size.')}</p>
            <Link to="/results" className="inline-block mt-5"><Button variant="outline" icon="chart">{t('See all results')}</Button></Link>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            <StatBlock label={t('students checked in during the pilot')} value={String(r.pilot.participants)} n={r.pilot.checkins} hasData={r.pilot.checkins > 0} />
            <StatBlock label={t('task success, round 1')} value={`${Math.round((r.usability.r1.successRate.value ?? 0) * 100)}%`} n={r.usability.r1.n} hasData={r.usability.r1.successRate.value != null} />
            <StatBlock label={t('task success, round 2')} value={`${Math.round((r.usability.r2.successRate.value ?? 0) * 100)}%`} n={r.usability.r2.n} hasData={r.usability.r2.successRate.value != null} />
          </div>
        </div>
        {changelog.length > 0 && <p className="mt-8 text-lg">{t('Latest change from testing:')} <b>{[...changelog].sort((a, b) => b.date.localeCompare(a.date))[0].change}</b></p>}
      </section>

      {/* ---- privacy promise ---- */}
      <section className="bg-ink text-ground py-16" aria-labelledby="privacy">
        <div className="mx-auto max-w-6xl px-4 grid md:grid-cols-[1fr_1.4fr] gap-10">
          <h2 id="privacy" className="text-6xl font-extrabold leading-[.9]">{t('We track shuttles, not people')}</h2>
          <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {[
              ['Your location is read once, only when you scan.', 'pin'],
              ['"Unverified" never means "guilty". Your teacher decides.', 'shield'],
              ['AI writes a sentence. It never decides attendance.', 'spark'],
              ['Check-ins are deleted after 30 days.', 'clock'],
            ].map(([x, ic]) => <li key={x} className="flex gap-3"><Icon name={ic} className="mt-1 shrink-0 text-[rgb(var(--sign))]" /><span className="text-lg">{t(x)}</span></li>)}
          </ul>
        </div>
      </section>

      {/* ---- team + scale ---- */}
      <section className="mx-auto max-w-6xl px-4 py-16 grid md:grid-cols-2 gap-10" aria-labelledby="team">
        <div>
          <h2 id="team" className="text-6xl font-extrabold leading-[.9]">{t('Built at Plano Senior, designed for any school')}</h2>
          <p className="mt-4 text-mute max-w-md">{t('Any school that moves students between buildings (construction, career centers, dual-credit runs) can set up its own buildings, stops and shuttle rules in minutes.')}</p>
        </div>
        <ul className="grid sm:grid-cols-2 gap-4">
          {TEAM.map((m, i) => (
            <li key={i} className="flex gap-3 items-start"><BuildingBadge code={'ABCD'[i]} size={36} /><div><div className="font-bold">{m.name || <span className="text-warn">[TEAMMATE NAME]</span>}</div><div className="text-sm text-mute">{t(m.module)}</div></div></li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-8">
        <div className="rounded-sign bg-brand text-brand-ink p-8 sm:p-12 flex flex-wrap items-center justify-between gap-6">
          <h2 className="text-5xl sm:text-6xl font-extrabold leading-[.9] max-w-xl">{t('See it with your own phone')}</h2>
          <Link to="/start"><Button size="lg" variant="sign">{t('Open the demo')}</Button></Link>
        </div>
      </section>
    </div>
  )
}
