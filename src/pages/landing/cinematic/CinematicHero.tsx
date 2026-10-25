import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from 'framer-motion'
import Lenis from 'lenis'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { StatusChip } from '@/components/ui/StatusChip'
import { CountdownRing } from '@/components/ui/Primitives'
import { FrameCanvas } from './FrameCanvas'
import { useT } from '@/i18n'

// Two rendered clips (generated with Higgsfield from one keyframe each), exported at 16 fps. AI-generated illustration, not footage of the real campus.
const CHAPTERS = [
  { id: 'aerial', count: 73, path: (i: number) => `/cinematic/aerial/f_${String(i + 1).padStart(3, '0')}.webp`, height: 'h-[460vh]' },
  { id: 'boarding', count: 73, path: (i: number) => `/cinematic/boarding/f_${String(i + 1).padStart(3, '0')}.webp`, height: 'h-[420vh]' },
] as const

/** Fades/slides an overlay in and out over a window of the chapter's scroll progress: [in-start, in-end, out-start, out-end]. */
function Beat({ p, at, children, className = '' }: { p: MotionValue<number>; at: [number, number, number, number]; children: ReactNode; className?: string }) {
  const opacity = useTransform(p, at, [0, 1, 1, 0])
  const y = useTransform(p, at, [28, 0, 0, -28])
  const pe = useTransform(opacity, o => (o > 0.5 ? 'auto' : 'none'))
  return <motion.div style={{ opacity, y, pointerEvents: pe as any }} className={`absolute inset-0 flex items-center ${className}`}>{children}</motion.div>
}

/** A value that follows scroll but only re-renders when its rounded value changes. */
function useStep(p: MotionValue<number>, f: (v: number) => number) {
  const [s, setS] = useState(() => f(p.get()))
  useMotionValueEvent(p, 'change', v => { const n = f(v); setS(prev => (prev === n ? prev : n)) })
  return s
}

/** Chapter 1 HUD: the "Will I make it?" verdict ticking as the shuttle approaches. Real components, scripted by scroll. */
function MakeItHud({ p }: { p: MotionValue<number> }) {
  const t = useT()
  const minutes = useStep(p, v => Math.max(0, Math.round(6 - ((v - 0.28) / 0.22) * 6)))
  const verdict = minutes > 3 ? 'close' : 'on_track'
  return (
    <div className="w-full max-w-sm rounded-sign bg-[rgb(21_23_27)] text-white border border-white/15 p-5 shadow-2xl">
      <div className="flex items-center gap-2 text-sm font-bold text-[rgb(var(--sign))]"><span className="font-display text-xl">{t('Main campus')}</span><span aria-hidden>→</span><span className="font-display text-xl">{t('Annex (H)')}</span></div>
      <div className="mt-3 flex items-center gap-4">
        <div className="text-[rgb(var(--sign))]"><CountdownRing minutes={minutes} fraction={minutes / 6} size={96} label={t('Shuttle at your stop in')} /></div>
        <div>
          <span className={`inline-flex items-center gap-2 rounded-pill px-3 py-1 font-bold ${verdict === 'close' ? 'bg-[rgb(240_176_64)] text-[rgb(21_23_27)]' : 'bg-[rgb(74_201_142)] text-[rgb(21_23_27)]'}`}>
            <Icon name={verdict === 'close' ? 'clock' : 'check-circle'} size={16} />{verdict === 'close' ? t('Cutting it close') : t('On track')}
          </span>
          <p className="mt-2 text-sm text-white/80">{t('A shuttle can pick you up in about {m} min.', { m: Math.max(1, minutes) })}</p>
        </div>
      </div>
    </div>
  )
}

/** Chapter 2 HUD: a roster that updates as students scan. */
function RosterHud({ p }: { p: MotionValue<number> }) {
  const t = useT()
  const n = useStep(p, v => (v > 0.4 ? 3 : v > 0.32 ? 2 : v > 0.24 ? 1 : 0))
  const rows = [['Maya R.', 0], ['Jordan L.', 1], ['Priya P.', 2], ['Noah W.', 9]] as const
  return (
    <div data-theme="dark" className="w-full max-w-sm rounded-sign bg-panel text-ink border border-line p-4 shadow-2xl">
      <div className="flex items-center gap-2 font-display text-2xl font-bold"><Icon name="scan" size={18} />{t('Scan once. The teacher sees you.')}</div>
      <ul className="mt-3 space-y-2">
        {rows.map(([name, k]) => (
          <li key={name} className="flex items-center justify-between gap-2"><span className="font-bold">{name}</span><StatusChip status={k < n ? 'on_the_way' : 'waiting'} compact /></li>
        ))}
      </ul>
    </div>
  )
}

/** Chapter 2 HUD: the fairness rule, with the ride counting up. */
function SlowHud({ p }: { p: MotionValue<number> }) {
  const t = useT()
  const ride = useStep(p, v => Math.max(5, Math.min(11, Math.round(5 + ((v - 0.62) / 0.16) * 6))))
  const excused = ride > 8
  return (
    <div data-theme="dark" className="w-full max-w-sm rounded-sign bg-panel text-ink border border-line p-5 shadow-2xl">
      <div className="font-display text-5xl font-extrabold leading-none num">{ride} <span className="text-2xl">min</span></div>
      <p className="mt-1 text-sm text-mute">{t('The ride takes about {m} min, then a {w} min walk.', { m: 5, w: 2 })}</p>
      <div className="mt-3"><StatusChip status={excused ? 'excused_bus_late' : 'on_the_way'} /></div>
    </div>
  )
}

function Chapter({ index, chapter }: { index: number; chapter: (typeof CHAPTERS)[number] }) {
  const t = useT()
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const sec = useStep(p, v => Math.min(6, Math.round(v * 6)))
  const rail = useTransform(p, [0.1, 0.9], ['0%', '100%'])
  const dim = 'absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,rgba(12,13,16,.86)_0%,rgba(12,13,16,.55)_38%,rgba(12,13,16,.08)_70%,transparent_100%)]'
  const copy = 'max-w-xl text-white'
  return (
    <section ref={ref} className={`relative ${chapter.height} bg-[rgb(12_13_16)]`} aria-label={index === 0 ? t('How ShuttleSync works, step by step') : undefined} data-testid={`chapter-${chapter.id}`}>
      <div className="sticky top-14 h-[calc(100dvh-3.5rem)] overflow-hidden">
        <FrameCanvas count={chapter.count} path={chapter.path} progress={p} className="absolute inset-0 h-full w-full" />
        <div className={dim} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[rgb(12_13_16)]/70 to-transparent" />

        {/* wayfinding rail: the route line motif, with the shuttle riding it */}
        <div className="absolute left-4 top-[18%] bottom-[18%] hidden xl:flex flex-col items-center text-white" aria-hidden>
          <span className="font-display text-lg font-bold tracking-wide">A</span>
          <div className="relative my-2 w-[3px] flex-1 route-track opacity-70">{index === 0 && <motion.span style={{ top: rail }} className="absolute -left-[7px] h-[17px] w-[17px] rounded-full bg-[rgb(var(--sign))] border-[3px] border-[rgb(21_23_27)]" />}</div>
          <span className="font-display text-lg font-bold tracking-wide">H</span>
        </div>

        {/* film timecode */}
        <div className="absolute right-5 top-5 hidden md:flex items-center gap-3 rounded-pill bg-[rgb(12_13_16)]/70 px-4 py-1 font-display text-lg tracking-wide text-white num" aria-hidden>
          <span>{t('Scene {i} of 2', { i: index + 1 })}</span><span className="text-[rgb(var(--sign))]">00:0{sec}</span>
        </div>

        <div className="relative h-full mx-auto max-w-6xl px-4 xl:pl-16">
          {index === 0 ? (
            <>
              <Beat p={p} at={[-0.02, 0, 0.14, 0.24]}>
                <div className={copy}>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.8 }} className="font-display text-xl tracking-wide text-[rgb(var(--sign))]">{t('Plano Senior High School · the shuttle loop')}</motion.p>
                  <h1 className="mt-3 text-[clamp(3.4rem,8.6vw,7.6rem)] font-extrabold leading-[.86]" aria-label={t('If the bus is late, the student isn\'t.')}>
                    {t('If the bus is late, the student isn\'t.').split(' ').map((w, i) => (
                      <span key={i}><span className="inline-block overflow-hidden align-bottom"><motion.span className="inline-block" initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ delay: 0.25 + i * 0.07, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}>{w}</motion.span></span>{' '}</span>
                    ))}
                  </h1>
                  <p className="mt-5 text-lg max-w-md text-white/85">{t('Buildings B and C are closed for construction, so students ride one shuttle loop between the main campus and the Annex. ShuttleSync shows who needs it, whether they will make it, and protects them when the shuttle runs slow.')}</p>
                  <div className="mt-7 flex flex-wrap gap-3 pointer-events-auto">
                    <Link to="/start"><Button size="lg" variant="sign" icon="phone" data-testid="cta-open">{t('Try the demo')}</Button></Link>
                    <Link to="/how-it-works"><Button size="lg" variant="outline" className="!bg-transparent !text-white !border-white/60 hover:!bg-white/10">{t('How it works')}</Button></Link>
                  </div>
                  <p className="mt-6 text-sm text-white/70 flex items-center gap-2"><Icon name="arrow" size={14} className="rotate-90" />{t('Scroll to follow Shuttle 1 from the A loop to the H loop')}</p>
                </div>
              </Beat>
              <Beat p={p} at={[0.26, 0.34, 0.5, 0.58]}><MakeItHud p={p} /></Beat>
              <Beat p={p} at={[0.62, 0.72, 0.9, 0.97]}>
                <div className={copy}><h2 className="text-[clamp(3rem,6.4vw,5.6rem)] font-extrabold leading-[.9]">{t('One loop. No timetable.')}</h2><p className="mt-4 text-lg max-w-md text-white/85">{t('Any shuttle at your stop goes to the other end. What you need to know is whether you will make it.')}</p></div>
              </Beat>
            </>
          ) : (
            <>
              <Beat p={p} at={[0.06, 0.14, 0.5, 0.58]}><RosterHud p={p} /></Beat>
              <Beat p={p} at={[0.6, 0.68, 0.84, 0.9]}>
                <div className="grid gap-6 md:grid-cols-[1fr_auto] items-center w-full"><div className={copy}><h2 className="text-[clamp(3rem,6.4vw,5.6rem)] font-extrabold leading-[.9]">{t('Slow shuttle? You\'re covered.')}</h2><p className="mt-4 text-lg max-w-md text-white/85">{t('If your ride takes longer than normal, or lands after the bell, you are excused automatically. Everyone else stays "not checked in" until your teacher decides.')}</p></div><SlowHud p={p} /></div>
              </Beat>
              <Beat p={p} at={[0.9, 0.95, 1.01, 1.02]}>
                <div className={copy}><h2 className="text-[clamp(3rem,6.4vw,5.6rem)] font-extrabold leading-[.9]">{t('See it with your own phone')}</h2><div className="mt-6 flex gap-3 pointer-events-auto"><Link to="/start"><Button size="lg" variant="sign" data-testid="cta-open-2">{t('Open the demo')}</Button></Link><Link to="/privacy"><Button size="lg" variant="outline" className="!bg-transparent !text-white !border-white/60 hover:!bg-white/10">{t('Privacy')}</Button></Link></div></div>
              </Beat>
            </>
          )}
        </div>
        <p className="absolute bottom-3 left-4 text-[11px] text-white/75 drop-shadow">{t('AI-generated illustration, not footage of the real campus.')}</p>
      </div>
    </section>
  )
}

/** The cinematic landing hero: smooth scroll (Lenis, this page only) + two scrubbed chapters. Desktop; phones get the poster version. */
export function CinematicHero() {
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true })
    let raf = 0
    const loop = (time: number) => { lenis.raf(time); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); lenis.destroy() }
  }, [])
  return <div data-testid="cinema">{CHAPTERS.map((c, i) => <Chapter key={c.id} index={i} chapter={c} />)}</div>
}
