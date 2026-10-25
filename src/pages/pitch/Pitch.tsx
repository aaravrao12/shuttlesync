import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '@/components/ui/Icon'
import { BuildingBadge, BusSign } from '@/components/ui/BuildingBadge'
import { StatusChip } from '@/components/ui/StatusChip'
import { CompareBars } from '@/components/charts/CompareBars'
import { useResultsData } from '@/evidence/useResults'
import { PLACEHOLDER } from '@/evidence/results'
import { Logo } from '@/components/ui/Primitives'
import { useT } from '@/i18n'

/** Presenter mode: arrow keys to move, F fullscreen, N notes+timer. ~5 minutes. Numbers come from the Evidence store. */
const SECONDS = [10, 20, 40, 20, 120, 60, 20, 10]

function Big({ v, label, n }: { v: string | null; label: string; n?: number }) {
  return <div className="border-t-8 border-ink pt-3"><div className={`font-display font-extrabold leading-none num ${v ? 'text-[clamp(4rem,10vw,9rem)]' : 'text-[clamp(1.5rem,3vw,2.5rem)] text-warn'}`}>{v ?? PLACEHOLDER}</div><div className="mt-2 text-xl font-medium">{label}</div>{v && n != null && <div className="text-sm text-mute">n={n}</div>}</div>
}

export default function Pitch() {
  const t = useT()
  const { results: r, changelog, baseline } = useResultsData(false)
  const [i, setI] = useState(0)
  const [notes, setNotes] = useState(false)
  const [started, setStarted] = useState<number | null>(null)
  const [, tick] = useState(0)
  const story = baseline.find(b => b.metric === 'story' && typeof b.value === 'string')
  const top3 = [...changelog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  const pct = (x: number | null) => (x == null ? null : `${Math.round(x)}%`)

  const slides: { notes: string; body: ReactNode }[] = [
    { notes: t('Say the name and the line. Pause.'), body: (
      <div className="h-full grid place-items-center text-center"><div><Logo className="!text-4xl" /><h1 className="mt-8 text-[clamp(4rem,11vw,10rem)] font-extrabold leading-[.85]">{t('If the bus is late, the student isn\'t.')}</h1></div></div>) },
    { notes: t('One real moment, anonymized, with permission. Do not read it, tell it.'), body: (
      <div className="h-full grid place-items-center"><blockquote className="max-w-4xl"><p className={`font-display font-extrabold leading-[.95] ${story ? 'text-[clamp(2.5rem,6vw,5rem)]' : 'text-4xl text-warn'}`}>{story ? `“${story.value}”` : `${PLACEHOLDER} ${t('(add a student moment on the Baseline page)')}`}</p>{story && <footer className="mt-4 text-xl text-mute">{story.notes}</footer>}</blockquote></div>) },
    { notes: t('Survey percent, real delay, one teacher or office quote. Say who is affected: students, teachers, the attendance office.'), body: (
      <div className="h-full flex flex-col justify-center gap-10"><h2 className="text-6xl font-extrabold">{t('We measured it first')}</h2>
        <div className="grid grid-cols-3 gap-10">
          <Big v={pct(r.baseline.tardyPct.value)} label={t('were marked tardy because of a late shuttle')} n={r.baseline.tardyPct.n} />
          <Big v={r.baseline.rideAlongDelay.value == null ? null : `${r.baseline.rideAlongDelay.value.toFixed(1)} min`} label={t('average real shuttle ride (ride-along)')} n={r.baseline.rideAlongDelay.n} />
          <div className="border-t-8 border-ink pt-3">{r.baseline.quotes[0] ? <blockquote className="text-3xl leading-snug">“{r.baseline.quotes[0].value}”<footer className="text-base text-mute mt-2">{r.baseline.quotes[0].notes}</footer></blockquote> : <p className="text-3xl font-display font-extrabold text-warn">{PLACEHOLDER}</p>}</div>
        </div></div>) },
    { notes: t('One sentence. Then the three experiences. Do not explain features yet; the demo will.'), body: (
      <div className="h-full flex flex-col justify-center gap-8"><h2 className="text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold leading-[.95] max-w-4xl">{t('ShuttleSync shows students whether they will make it across to the Annex, shows teachers who is on the shuttle, and protects students when it runs slow.')}</h2>
        <div className="grid grid-cols-3 gap-6 text-2xl">{[['phone', 'Students scan once'], ['bus', 'A passenger phone shares the shuttle'], ['teacher', 'Teachers see a live roster']].map(([ic, x]) => <div key={x} className="flex items-center gap-4 bg-panel border border-line rounded-sign p-5"><Icon name={ic} size={32} className="text-brand" /><span className="font-bold">{t(x)}</span></div>)}</div></div>) },
    { notes: t('Run the demo in order. Control tab: Demo control (jump to the passing period, start the simulator). Judge scans too.'), body: (
      <div className="h-full flex flex-col justify-center"><h2 className="text-6xl font-extrabold mb-6">{t('Live demo')}</h2>
        <ol className="space-y-3 text-3xl max-w-4xl">{['Student sets up a schedule (photo → which classes need the shuttle)', 'Home screen says "On track". Everyone, including a judge, scans the Shuttle 1 QR: names update live', 'One person does not scan: "Not checked in" once the class bell rings', 'Make Shuttle 1 slow: riders flip to "Excused: shuttle delay"', 'Shuttle phone enters the H loop: the run completes and riders show Arrived', 'Write the attendance note, approve it'].map((x, k) => <li key={x} className="flex gap-4"><span className="font-display text-5xl font-extrabold text-brand w-10 shrink-0">{k + 1}</span><span className="pt-1">{t(x)}</span></li>)}</ol>
        <div className="mt-6 flex gap-3 text-base"><Link className="underline" to="/demo">{t('Demo control')}</Link><Link className="underline" to="/teacher">{t('Teacher dashboard')}</Link></div></div>) },
    { notes: t('Say plainly which kind of test it was (real buses, or a walk-through). Then round 1 to round 2, then the top changes.'), body: (
      <div className="h-full grid grid-cols-2 gap-10 items-center"><div><h2 className="text-6xl font-extrabold mb-4">{t('We tested it, then changed it')}</h2><div className="grid grid-cols-2 gap-6"><Big v={r.pilot.checkins ? String(r.pilot.participants) : null} label={t('students checked in')} n={r.pilot.checkins} /><Big v={r.pilot.checkins ? String(r.pilot.autoExcused) : null} label={t('tardies auto-excused')} n={r.pilot.autoExcused} /></div>
        <ul className="mt-6 space-y-2 text-lg">{top3.length ? top3.map(c => <li key={c.id}><b>{t('Users said:')}</b> {c.observation} <b>→</b> {c.change}</li>) : <li className="text-warn font-bold">{PLACEHOLDER}</li>}</ul></div>
        <CompareBars aName={t('Round 1')} bName={t('Round 2')} rows={[
          { label: t('Task success'), a: { value: r.usability.r1.successRate.value, n: r.usability.r1.n }, b: { value: r.usability.r2.successRate.value, n: r.usability.r2.n }, max: 1, fmt: v => `${Math.round(v * 100)}%` },
          { label: t('SUS score'), a: { value: r.usability.sus1.value, n: r.usability.sus1.n }, b: { value: r.usability.sus2.value, n: r.usability.sus2.n }, max: 100, fmt: v => v.toFixed(0) },
        ]} /></div>) },
    { notes: t('Four design decisions, one breath each.'), body: (
      <div className="h-full flex flex-col justify-center"><h2 className="text-6xl font-extrabold mb-8">{t('Four decisions we are proud of')}</h2>
        <ul className="grid grid-cols-2 gap-6 text-2xl">{[['shield', 'Fairness first', 'The system protects students; it does not catch them.'], ['help-circle', 'Unverified is not guilty', 'A failed check says "teacher decides".'], ['spark', 'AI assists, teachers decide', 'Plain code does the math. AI only writes the sentence.'], ['pin', 'Location minimalism', 'Shuttles are tracked. Students are located once, at the scan.']].map(([ic, h, b]) => <li key={h} className="bg-panel border border-line rounded-sign p-6"><Icon name={ic} size={32} className="text-brand" /><div className="font-display text-4xl font-extrabold mt-2">{t(h)}</div><div className="text-lg text-mute mt-1">{t(b)}</div></li>)}</ul></div>) },
    { notes: t('Close on the line. Offer the handoff plan to the admin.'), body: (
      <div className="h-full grid place-items-center text-center"><div><div className="flex justify-center gap-3 mb-6">{'ABCD'.split('').map(c => <BuildingBadge key={c} code={c} size={64} />)}</div><h2 className="text-[clamp(3.5rem,9vw,8rem)] font-extrabold leading-[.88]">{t('If the bus is late, the student isn\'t.')}</h2><p className="mt-6 text-2xl text-mute max-w-3xl mx-auto">{t('Next semester: a named teacher and a student team run it, using the setup wizard and the handoff guide.')}</p><div className="mt-6 flex justify-center items-center gap-3"><BusSign number="14" toCode="C" /><StatusChip status="arrived" /></div></div></div>) },
  ]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); setI(x => Math.min(slides.length - 1, x + 1)); setStarted(s => s ?? Date.now()) }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) setI(x => Math.max(0, x - 1))
      if (e.key.toLowerCase() === 'n') setNotes(x => !x)
      if (e.key.toLowerCase() === 'f') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()
    }
    window.addEventListener('keydown', onKey)
    const id = setInterval(() => tick(x => x + 1), 1000)
    return () => { window.removeEventListener('keydown', onKey); clearInterval(id) }
  }, [slides.length])

  const elapsed = started ? Math.floor((Date.now() - started) / 1000) : 0
  const target = SECONDS.slice(0, i + 1).reduce((a, b) => a + b, 0)
  const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  return (
    <div className="fixed inset-0 bg-ground text-ink overflow-hidden" data-testid="pitch">
      <AnimatePresence mode="wait">
        <motion.div key={i} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.28 }} className="absolute inset-0 px-[6vw] pt-[6vh] pb-[12vh]">{slides[i].body}</motion.div>
      </AnimatePresence>
      <div className="absolute bottom-0 inset-x-0 px-[6vw] pb-4 flex items-center justify-between gap-4 no-print">
        <div className="flex gap-1.5" role="tablist" aria-label="Slides">{slides.map((_, k) => <button key={k} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} aria-selected={k === i} role="tab" className={`h-2.5 rounded-full transition-all ${k === i ? 'w-10 bg-brand' : 'w-2.5 bg-line'}`} />)}</div>
        <div className="flex items-center gap-4 text-sm text-mute"><span className="num">{i + 1}/{slides.length}</span>{started && <span className={`num font-bold ${elapsed > target + 10 ? 'text-bad' : ''}`}>{mm(elapsed)} / target {mm(target)}</span>}<span>← → · N notes · F fullscreen</span><Link to="/demo" className="underline">{t('Exit')}</Link></div>
      </div>
      {notes && <aside className="absolute right-4 top-4 w-80 bg-ink text-ground rounded-sign p-4 shadow-xl"><div className="text-xs font-bold opacity-70 mb-1">{t('Presenter notes · about {s}s', { s: SECONDS[i] })}</div><p>{slides[i].notes}</p></aside>}
    </div>
  )
}
