import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Banner, Field, Panel, Segmented, Select, TextInput } from '@/components/ui/Primitives'
import { Pill } from '@/components/ui/StatusChip'
import { useCollection } from '@/firebase/hooks'
import { getStore } from '@/firebase/store'
import { susScore } from '@/lib/metrics'
import { useToast } from '@/app/Toast'
import { useT } from '@/i18n'
import type { UsabilityTest } from '@/types'

const TASKS = {
  student: [
    'Open the link and set up your schedule',
    'Find out whether you need the shuttle after period 3, and whether you will make it',
    'Check in on the shuttle',
  ],
  teacher: [
    'Open the dashboard and find which students are on their way',
    'Find who has not boarded',
    'Approve the attendance note',
  ],
} as const

const STUCK = ['Nowhere: finished smoothly', 'Could not find the button', 'Did not understand the wording', 'Scanner or camera problem', 'Location or permission prompt', 'App was slow or froze', 'Other (write in notes)']

const SUS_ITEMS = [
  'I think that I would like to use this system frequently.', 'I found the system unnecessarily complex.', 'I thought the system was easy to use.',
  'I think that I would need the support of a technical person to use this system.', 'I found the various functions in this system were well integrated.',
  'I thought there was too much inconsistency in this system.', 'I would imagine that most people would learn to use this system very quickly.',
  'I found the system very cumbersome to use.', 'I felt very confident using the system.', 'I needed to learn a lot of things before I could get going with this system.',
]

/** Moderated usability test runner (team only). No names stored: participants are P01, P02… */
export default function TestMode() {
  const t = useT()
  const toast = useToast()
  const { rows: tests } = useCollection<UsabilityTest>('usabilityTests')
  const [code, setCode] = useState('P01')
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [round, setRound] = useState<'1' | '2'>('1')
  const [taskIdx, setTaskIdx] = useState(0)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useRef(0)
  const [stuck, setStuck] = useState(STUCK[0])
  const [notes, setNotes] = useState('')
  const [sus, setSus] = useState<number[]>(Array(10).fill(0))
  const [ease, setEase] = useState(0)
  const [use, setUse] = useState(0)
  const [change, setChange] = useState('')

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setElapsed(Date.now() - startedAt.current), 100)
    return () => clearInterval(id)
  }, [running])

  const tasks = TASKS[role]
  const mine = tests.filter(x => x.participantCode === code && x.round === Number(round) && x.role === role)

  function start() { startedAt.current = Date.now(); setElapsed(0); setRunning(true) }
  async function finish(success: boolean) {
    const durationMs = Date.now() - startedAt.current
    setRunning(false)
    await getStore().add('usabilityTests', { participantCode: code, role, round: Number(round), task: tasks[taskIdx], success, durationMs, stuckAt: success ? undefined : stuck, notes, createdAt: Date.now() })
    toast(success ? t('Saved: success') : t('Saved: not completed'))
    setNotes(''); setStuck(STUCK[0])
    if (taskIdx < tasks.length - 1) setTaskIdx(taskIdx + 1)
  }
  async function saveExit() {
    const store = getStore()
    await store.add('feedback', { role, rating: ease, easeScore: ease, wouldUse: use, text: change, screen: `test:${code}:r${round}`, createdAt: Date.now(), isPilot: true, isSimulated: false })
    if (sus.every(a => a > 0)) await store.add('susResponses', { participantCode: code, round: Number(round), answers: sus, score: susScore(sus), createdAt: Date.now() })
    toast(t('Exit survey saved'))
    setEase(0); setUse(0); setChange(''); setSus(Array(10).fill(0)); setTaskIdx(0)
    const n = parseInt(code.slice(1), 10)
    if (!isNaN(n)) setCode('P' + String(n + 1).padStart(2, '0'))
  }

  const s = (ms: number) => (ms / 1000).toFixed(1)
  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-5xl font-extrabold leading-[.95]">{t('Test mode')}</h1>
      <Banner tone="info" icon="clipboard">{t('Read the task out loud. Do not help. Start the timer when they touch the screen. Open the app for them at /start?slot={c} so each tester gets a clean profile.', { c: code })}</Banner>

      <Panel className="p-4 grid sm:grid-cols-3 gap-3 items-end">
        <Field label={t('Participant code')} hint={t('P01, P02… never a name')}><TextInput value={code} onChange={e => setCode(e.target.value.toUpperCase())} data-testid="tm-code" /></Field>
        <Field label={t('Role')}><Segmented label={t('Role')} value={role} onChange={v => { setRole(v); setTaskIdx(0) }} options={[{ value: 'student', label: t('Student') }, { value: 'teacher', label: t('Teacher') }]} /></Field>
        <Field label={t('Round')}><Segmented label={t('Round')} value={round} onChange={setRound} options={[{ value: '1', label: t('Round 1') }, { value: '2', label: t('Round 2 (after fixes)') }]} /></Field>
      </Panel>

      <Panel className="p-5 space-y-4" aria-live="polite">
        <div className="flex items-center justify-between"><Pill tone="info">{t('Task {i} of {n}', { i: taskIdx + 1, n: tasks.length })}</Pill><span className="font-display text-6xl font-extrabold num" data-testid="tm-timer">{s(running ? elapsed : 0)}s</span></div>
        <h2 className="text-4xl font-bold leading-tight">{t(tasks[taskIdx])}</h2>
        {!running ? <Button size="lg" icon="play" onClick={start} data-testid="tm-start">{t('Start timer')}</Button> : (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap"><Button size="lg" icon="check" onClick={() => finish(true)} data-testid="tm-success">{t('Finished without help')}</Button><Button size="lg" variant="danger" icon="x" onClick={() => finish(false)} data-testid="tm-fail">{t('Could not finish')}</Button></div>
            <Field label={t('Where did they get stuck?')}><Select value={stuck} onChange={e => setStuck(e.target.value)}>{STUCK.map(x => <option key={x}>{x}</option>)}</Select></Field>
            <Field label={t('Notes')}><TextInput value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('What they said or did')} /></Field>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">{tasks.map((x, i) => <button key={x} onClick={() => setTaskIdx(i)} className={`text-xs rounded-pill border px-3 min-h-[32px] ${i === taskIdx ? 'border-brand bg-brand/10' : 'border-line'}`}>{i + 1}</button>)}</div>
        {mine.length > 0 && <ul className="text-sm divide-y divide-line">{mine.map(m => <li key={m.id} className="py-1 flex justify-between gap-3"><span>{m.task}</span><span className="num">{m.success ? '✓' : '✗'} {s(m.durationMs)}s{m.stuckAt ? ` · ${m.stuckAt}` : ''}</span></li>)}</ul>}
      </Panel>

      <Panel className="p-5 space-y-4">
        <h2 className="text-3xl font-bold">{t('Exit survey for {c}', { c: code })}</h2>
        {[[t('How easy was it? (1–5)'), ease, setEase], [t('Would you use it? (1–5)'), use, setUse]].map(([label, v, set]: any) => (
          <fieldset key={label}><legend className="text-sm font-bold mb-1">{label}</legend><div className="flex gap-2">{[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => set(n)} aria-pressed={v === n} className={`h-11 flex-1 rounded-sign border font-display text-2xl font-bold ${v === n ? 'bg-brand text-brand-ink border-brand' : 'border-line bg-panel'}`}>{n}</button>)}</div></fieldset>
        ))}
        <Field label={t('One thing to change')}><TextInput value={change} onChange={e => setChange(e.target.value)} /></Field>
        <details className="border border-line rounded-sign p-3"><summary className="font-bold cursor-pointer min-h-[44px] flex items-center">{t('Optional: System Usability Scale (10 questions)')}</summary>
          <ol className="space-y-3 mt-2">{SUS_ITEMS.map((q, i) => <li key={q}><div className="text-sm mb-1">{i + 1}. {q}</div><div className="flex gap-1">{[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setSus(sus.map((a, k) => (k === i ? n : a)))} aria-pressed={sus[i] === n} className={`h-10 flex-1 rounded-sign border ${sus[i] === n ? 'bg-brand text-brand-ink border-brand' : 'border-line bg-panel'}`}>{n}</button>)}</div></li>)}</ol>
          <p className="text-xs text-mute mt-2">{t('1 = strongly disagree, 5 = strongly agree.')}</p>
        </details>
        <Button disabled={!ease || !use} onClick={saveExit} data-testid="tm-save-exit">{t('Save exit survey')}</Button>
      </Panel>
    </div>
  )
}
