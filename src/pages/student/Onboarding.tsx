import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Banner, Field, Logo, Select, Spinner, TextInput } from '@/components/ui/Primitives'
import { BuildingBadge } from '@/components/ui/BuildingBadge'
import { Icon } from '@/components/ui/Icon'
import { useCampus, usePeople, useRules } from '@/firebase/hooks'
import { getStore } from '@/firebase/store'
import { patchProfile, setProfile, useProfile } from '@/app/session'
import { planDay, zoneLabel } from '@/lib/shuttle'
import { callAI, fileToBase64 } from '@/ai/client'
import { ScheduleExtraction } from '@/ai/schemas'
import { track } from '@/evidence/track'
import { emptyRows, matchTeacher, rowsFromSchedule, rowsToSchedule, ScheduleEditor, type Row } from './ScheduleEditor'
import { useToast } from '@/app/Toast'
import { useT } from '@/i18n'
import type { Student } from '@/types'

type Step = 'who' | 'schedule' | 'confirm'

export default function Onboarding() {
  const t = useT()
  const nav = useNavigate()
  const toast = useToast()
  const profile = useProfile()
  const campus = useCampus()
  const { students, teachers } = usePeople()
  const existing = students.find(s => s.id === profile.studentId)
  const [step, setStep] = useState<Step>('who')
  const [name, setName] = useState(existing?.name ?? '')
  const [grade, setGrade] = useState(String(existing?.grade ?? '10'))
  const [lang, setLang] = useState<'en' | 'es' | 'other'>(existing?.preferredLanguage ?? 'en')
  const [number, setNumber] = useState(existing?.studentNumber ?? '')
  // If the school enrolled this student from a spreadsheet, claim that record and its schedule.
  const enrolled = number.trim() ? students.find(s => s.studentNumber === number.trim() && s.id !== existing?.id && !s.isSimulated) : undefined
  const periods = campus.bell.length ? campus.bell.map(b => b.period) : [0, 1, 2, 3, 4, 5, 6, 7]
  const [rows, setRows] = useState<Row[]>(() => (existing ? rowsFromSchedule(existing.schedule, periods) : emptyRows(periods)))
  const [reading, setReading] = useState(false)
  const [aiMsg, setAiMsg] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)
  const started = useRef(false)
  if (!started.current) { started.current = true; track('onboarding_started') }

  const schedule = useMemo(() => rowsToSchedule(rows), [rows])
  const rules = useRules()
  const plans = useMemo(() => planDay(schedule, campus.bell, campus.buildings, campus.stops, rules), [schedule, campus.bell, campus.buildings, campus.stops, rules])
  const classBuildings = useMemo(() => campus.buildings.filter(b => b.zone !== 'closed'), [campus.buildings]) // B and C are closed: no classes

  if (!campus.ready) return <Spinner />

  async function snap(file: File) {
    setReading(true); setAiMsg(null)
    try {
      const img = await fileToBase64(file)
      const r = await callAI('schedule', img, ScheduleExtraction, 25000)
      const next = emptyRows(periods)
      for (const e of r.entries) {
        const row = next.find(r => r.period === e.period); if (!row) continue
        const code = (e.building || e.room.charAt(0)).toUpperCase().charAt(0)
        const tc = matchTeacher(e.teacherName, teachers)
        Object.assign(row, { courseName: e.courseName, room: e.room, buildingId: campus.buildings.find(b => b.code === code)?.id ?? '', teacherId: tc?.id ?? '', teacherName: tc?.name ?? e.teacherName })
      }
      setRows(next)
      track('schedule_photo_used')
      setAiMsg({ tone: 'ok', text: t('We read {n} classes from your photo. Check each one, then fix anything that looks wrong.', { n: r.entries.length }) })
    } catch (e: any) {
      setAiMsg({ tone: 'warn', text: (e?.message ?? t('We could not read that photo.')) + ' ' + t('You can type your schedule instead. It takes about a minute.') })
    } finally { setReading(false) }
  }

  async function save() {
    const store = getStore()
    const id = enrolled?.id ?? existing?.id ?? store.uid()
    const student: Omit<Student, 'id'> = {
      name: name.trim(), grade: Number(grade) || undefined, preferredLanguage: lang, schedule, studentNumber: number.trim() || undefined, ownerUid: store.uid(),
      code: existing?.code ?? 'S' + Math.random().toString(36).slice(2, 6).toUpperCase(), isSimulated: existing?.isSimulated ?? false,
    }
    await store.set('students', id, student)
    if (existing) patchProfile({ name: student.name }); else setProfile({ role: 'student', studentId: id, name: student.name })
    if (!existing) track('onboarding_completed', { classes: schedule.length })
    toast(t('Schedule saved'))
    nav('/student', { replace: true })
  }

  const needsName = name.trim().length < 2
  return (
    <div className="min-h-dvh mx-auto max-w-xl px-4 py-6 pb-32">
      <Logo />
      <ol className="flex gap-2 my-5" aria-label="Steps">
        {(['who', 'schedule', 'confirm'] as Step[]).map((s, i) => <li key={s} className={`h-1.5 flex-1 rounded-full ${i <= ['who', 'schedule', 'confirm'].indexOf(step) ? 'bg-brand' : 'bg-line'}`} aria-current={s === step ? 'step' : undefined} />)}
      </ol>

      <AnimatePresence mode="wait">
        {step === 'who' && (
          <motion.div key="who" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-4">
            <h1 className="text-5xl font-extrabold leading-[.95]">{t('Let\'s find your shuttles')}</h1>
            <p className="text-mute">{t('This takes about two minutes. You only do it once.')}</p>
            <Field label={t('Your name')} hint={t('Only your teachers and the office can see this.')}><TextInput value={name} onChange={e => setName(e.target.value)} autoComplete="name" data-testid="ob-name" /></Field>
            <Field label={t('Student number (optional)')} hint={enrolled ? t('Found you: we will use the schedule your school entered.') : t('Only if your school gave you one.')}><TextInput value={number} onChange={e => setNumber(e.target.value)} inputMode="numeric" data-testid="ob-number" /></Field>
            <Field label={t('Grade')}><Select value={grade} onChange={e => setGrade(e.target.value)}>{[9, 10, 11, 12].map(g => <option key={g} value={g}>{g}</option>)}</Select></Field>
            <Field label={t('Language you prefer')}><Select value={lang} onChange={e => setLang(e.target.value as any)}><option value="en">English</option><option value="es">Español</option><option value="other">{t('Other')}</option></Select></Field>
            <Button full size="lg" disabled={needsName} onClick={() => { if (enrolled && !rows.some(r => r.buildingId)) setRows(rowsFromSchedule(enrolled.schedule, periods)); setStep('schedule') }} data-testid="ob-next">{t('Continue')}</Button>
          </motion.div>
        )}

        {step === 'schedule' && (
          <motion.div key="schedule" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="space-y-4">
            <h1 className="text-5xl font-extrabold leading-[.95]">{t('Your schedule')}</h1>
            <div className="grid grid-cols-2 gap-3">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => e.target.files?.[0] && snap(e.target.files[0])} data-testid="ob-photo" />
                <span className="flex flex-col items-start gap-2 rounded-sign border-2 border-dashed border-brand p-4 min-h-[96px] hover:bg-brand/5"><Icon name="camera" /><b>{t('Snap my schedule')}</b><span className="text-xs text-mute">{t('Take a photo of your printed schedule')}</span></span>
              </label>
              <button className="flex flex-col items-start gap-2 rounded-sign border border-line bg-panel p-4 min-h-[96px] text-left" onClick={() => { track('schedule_manual'); document.getElementById('rows')?.scrollIntoView({ behavior: 'smooth' }) }}>
                <Icon name="edit" /><b>{t('Type it in')}</b><span className="text-xs text-mute">{t('Fill in the list below')}</span>
              </button>
            </div>
            {reading && <Spinner label={t('Reading your schedule')} />}
            {aiMsg && <Banner tone={aiMsg.tone}>{aiMsg.text}</Banner>}
            <div id="rows"><ScheduleEditor rows={rows} onChange={setRows} buildings={classBuildings} teachers={teachers} /></div>
            <div className="fixed bottom-0 inset-x-0 bg-ground/95 backdrop-blur border-t border-line p-3 safe-bottom"><div className="mx-auto max-w-xl flex gap-2"><Button variant="outline" onClick={() => setStep('who')}>{t('Back')}</Button><Button full size="lg" disabled={!schedule.length} onClick={() => setStep('confirm')} data-testid="ob-review">{t('See my shuttles')}</Button></div></div>
          </motion.div>
        )}

        {step === 'confirm' && (
          <motion.div key="confirm" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <h1 className="text-5xl font-extrabold leading-[.95]">{t('When you will need the shuttle')}</h1>
            <p className="text-mute">{t('There is no timetable: one shuttle loop runs between the main campus and the Annex. Any shuttle at your stop goes to the other end.')}</p>
            {plans.filter(p => p.needsShuttle).length === 0 && <Banner tone="info">{t('You do not need the shuttle between any of these classes.')}</Banner>}
            <ul className="space-y-3">
              {plans.map((p, i) => (
                <motion.li key={p.toPeriod} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }} className="bg-panel border border-line rounded-sign p-3 flex items-center gap-3">
                  <BuildingBadge code={campus.buildingById.get(p.fromBuildingId)?.code} size={36} />
                  <Icon name="arrow" />
                  <BuildingBadge code={campus.buildingById.get(p.toBuildingId)?.code} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold">{p.needsShuttle ? t('Shuttle: {a} to {b}', { a: t(zoneLabel(p.fromZone!)), b: t(zoneLabel(p.toZone!)) }) : t('No shuttle needed')}</div>
                    <div className="text-sm text-mute mt-0.5">{p.needsShuttle ? t('Board at {s}', { s: campus.stopById.get(p.boardStopId ?? '')?.name ?? '' }) : t.dyn(p.message)}</div>
                  </div>
                  <span className="text-xs text-mute font-bold">{t('Period {p}', { p: p.toPeriod })}</span>
                </motion.li>
              ))}
            </ul>
            <div className="flex gap-2"><Button variant="outline" onClick={() => setStep('schedule')}>{t('Fix something')}</Button><Button full size="lg" onClick={save} data-testid="ob-save">{t('Looks right, save')}</Button></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
