import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Banner, Panel, Spinner, TextInput } from '@/components/ui/Primitives'
import { Pill } from '@/components/ui/StatusChip'
import { useStudentPlan } from './useStudentPlan'
import { fmtClock } from '@/lib/time'
import { callAI } from '@/ai/client'
import { AskResult } from '@/ai/schemas'
import { useT } from '@/i18n'

/**
 * Ask ShuttleSync. Grounded ONLY in this student's own plan (sent with a short code, never their name).
 * Quick answers are computed locally, so the screen is useful even with AI off.
 */
export default function Ask() {
  const t = useT()
  const { student, campus, plans, plan, now, makeIt, boardStop, shuttles, rules } = useStudentPlan()
  const [q, setQ] = useState('')
  const [answer, setAnswer] = useState<{ text: string; source: 'local' | 'ai' } | null>(null)
  const [busy, setBusy] = useState(false)
  const b = (id: string) => campus.buildingById.get(id)?.name ?? id

  // Everything the assistant may use. There is no timetable, so the context is the rules, the plan and the live ETAs.
  const context = useMemo(() => [
    `The shuttle is one loop between the Building A loop (main campus: Buildings A, D, E, connected indoors) and the Building H loop (the Annex). There is no timetable and no choice of shuttle; any shuttle at your stop goes to the other end.`,
    `Normal ride about ${rules.normalRideMin} min. A rider is excused if the ride takes more than ${rules.normalRideMin + rules.delayThresholdMin} min or the shuttle arrives after the class bell.`,
    ...plans.map(p => p.needsShuttle ? `Before period ${p.toPeriod}: shuttle from ${b(p.fromBuildingId)} to ${b(p.toBuildingId)}; bell ${fmtClock(p.nextBell)}.` : `Before period ${p.toPeriod}: no shuttle needed (${b(p.toBuildingId)}).`),
    ...(makeIt && makeIt.verdict !== 'unknown' ? [`Right now: ${makeIt.verdict.replace('_', ' ')}, ${Math.round(makeIt.slackMin ?? 0)} min to spare.`] : []),
  ], [plans, makeIt, rules, campus.buildingById])

  if (!student) return <Spinner />

  const nextEta = shuttles.map(s => s.etaToMeMin).filter((x): x is number => x != null).sort((a, c) => a - c)[0]
  const quick = [
    { q: t('Do I need the shuttle next?'), a: () => plan?.needsShuttle ? t('Yes. Board at {s}. Any shuttle there goes to the other end.', { s: boardStop?.name ?? '' }) : plan ? t('No. Your next class is in the same area. If it is in A, D or E you can walk indoors.') : t('There is no next class right now.') },
    { q: t('Will I make it?'), a: () => !plan?.needsShuttle ? t('You do not need the shuttle for your next class.') : makeIt?.verdict === 'unknown' ? t('No shuttle is sharing its location yet, so I cannot tell.') : t('{v}. You would have about {s} min to spare.', { v: t(makeIt?.verdict === 'on_track' ? 'On track' : makeIt?.verdict === 'close' ? 'Cutting it close' : 'Likely late'), s: Math.round(makeIt?.slackMin ?? 0) }) },
    { q: t('When is the next shuttle?'), a: () => nextEta == null ? t('No shuttle is sharing its location yet.') : nextEta <= 0.5 ? t('A shuttle is at your stop now.') : t('A shuttle can reach your stop in about {m} min.', { m: Math.max(1, Math.round(nextEta)) }) },
    { q: t('What if the shuttle is slow?'), a: () => t('Check in on the shuttle. If your ride takes more than {m} minutes, or it arrives after the bell, you are excused automatically and your teacher sees why.', { m: rules.normalRideMin + rules.delayThresholdMin }) },
  ]

  async function ask(text: string) {
    setBusy(true); setAnswer(null)
    try {
      const r = await callAI('ask', { text: JSON.stringify({ question: text.slice(0, 200), studentCode: student!.code, nowIs: fmtClock(now.minutes), plan: context }) }, AskResult, 15000)
      setAnswer({ text: r.grounded ? r.answer : t('I can only help with shuttle and schedule questions.'), source: 'ai' })
    } catch { setAnswer({ text: t('The assistant is not available right now. Try one of the quick questions above, or check the Today screen.'), source: 'local' }) }
    setBusy(false)
  }

  return (
    <div className="space-y-5">
      <h1 className="text-5xl font-extrabold leading-[.95]">{t('Ask ShuttleSync')}</h1>
      <p className="text-mute">{t('Quick answers about your buses. It only knows your own schedule.')}</p>
      <div className="flex flex-wrap gap-2">{quick.map(x => <Button key={x.q} variant="outline" size="sm" onClick={() => setAnswer({ text: x.a(), source: 'local' })}>{x.q}</Button>)}</div>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (q.trim()) ask(q.trim()) }}>
        <TextInput value={q} onChange={e => setQ(e.target.value)} placeholder={t('Ask about your shuttle…')} aria-label={t('Your question')} maxLength={200} data-testid="ask-input" />
        <Button type="submit" disabled={busy || !q.trim()}>{t('Ask')}</Button>
      </form>
      {busy && <Spinner label={t('Thinking')} />}
      {answer && <Panel className="p-4 space-y-2" aria-live="polite"><p className="text-xl">{answer.text}</p><Pill tone={answer.source === 'ai' ? 'info' : 'mute'} icon={answer.source === 'ai' ? 'spark' : 'file'}>{answer.source === 'ai' ? t('AI, using only your schedule') : t('From your schedule')}</Pill></Panel>}
      <Banner tone="info" icon="shield">{t('Your name is never sent. AI answers can be wrong, so the Today screen is always the source of truth.')}</Banner>
    </div>
  )
}
