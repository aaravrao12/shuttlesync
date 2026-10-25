import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Banner, EmptyState, Field, Panel, RollingNumber, Select, Sheet, Spinner, TextInput } from '@/components/ui/Primitives'
import { BuildingBadge, BusSign } from '@/components/ui/BuildingBadge'
import { SimulatedTag, StatusChip, Pill } from '@/components/ui/StatusChip'
import { MapView } from '@/components/map/MapView'
import { useCollection, usePeople, useSettings } from '@/firebase/hooks'
import { getStore } from '@/firebase/store'
import { patchProfile, useProfile } from '@/app/session'
import { useToast } from '@/app/Toast'
import { fmtClock } from '@/lib/time'
import { recordsFromRows, type RosterRow } from '@/lib/roster'
import { generateNote, type NoteFacts } from '@/ai/note'
import { track } from '@/evidence/track'
import { useTeacherRoster } from './useTeacherRoster'
import { useT } from '@/i18n'
import type { AttendanceDoc, AttendanceStatus, ShuttleEvent, Teacher } from '@/types'

const REASONS = ['I saw them arrive', 'Bus was late', 'Office confirmed', 'Student told me', 'Other']
const DECISIONS: { to: AttendanceStatus; label: string; icon: string }[] = [
  { to: 'present', label: 'Present', icon: 'check-circle' },
  { to: 'excused_bus_late', label: 'Excused: bus late', icon: 'clock' },
  { to: 'tardy', label: 'Tardy', icon: 'timer' },
  { to: 'absent', label: 'Absent', icon: 'circle-slash' },
]

export default function Dashboard() {
  const t = useT()
  const profile = useProfile()
  const { teachers, ready } = usePeople()
  const teacher = teachers.find(x => x.id === profile.teacherId) ?? null
  if (!ready) return <Spinner />
  if (!teacher) return <TeacherPicker teachers={teachers} />
  return <DashboardFor teacher={teacher} key={teacher.id} />
  void t
}

function TeacherPicker({ teachers }: { teachers: Teacher[] }) {
  const t = useT()
  const [name, setName] = useState('')
  async function create() {
    const id = await getStore().add('teachers', { name: name.trim(), periods: [], isSimulated: false })
    patchProfile({ role: 'teacher', teacherId: id, name: name.trim() })
  }
  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-5xl font-extrabold leading-[.95]">{t('Who are you?')}</h1>
      <div className="grid gap-2">
        {teachers.map(x => (
          <button key={x.id} onClick={() => patchProfile({ role: 'teacher', teacherId: x.id, name: x.name })} data-testid={`teacher-${x.id}`}
            className="flex items-center justify-between bg-panel border border-line rounded-sign px-4 min-h-[56px] hover:border-brand text-left">
            <span className="text-xl font-bold">{x.name}</span>{x.isSimulated && <SimulatedTag />}
          </button>
        ))}
      </div>
      <Panel className="p-4 space-y-3">
        <h2 className="text-3xl font-bold">{t('Not on the list?')}</h2>
        <Field label={t('Your name as students know it')}><TextInput value={name} onChange={e => setName(e.target.value)} placeholder="Ms. Alvarez" /></Field>
        <Button disabled={name.trim().length < 3} onClick={create}>{t('Add me')}</Button>
        <p className="text-sm text-mute">{t('After adding yourself, go to My classes to set which periods you teach and where.')}</p>
      </Panel>
    </div>
  )
}

const iconForEvent: Record<string, string> = { bus_arrived: 'pin', bus_departed: 'bus', bus_delayed: 'clock', bus_recovered: 'check-circle', checkin: 'check', checkin_unverified: 'help-circle', override: 'edit', note_approved: 'file', system: 'info' }

function DashboardFor({ teacher }: { teacher: Teacher }) {
  const t = useT()
  const toast = useToast()
  const nav = useNavigate()
  const settings = useSettings()
  const { rows: allEvents } = useCollection<ShuttleEvent>('events')
  const periods = [...teacher.periods].sort((a, b) => a.period - b.period)

  // Default to the next class that has not started, so the teacher lands on what matters now.
  const [period, setPeriod] = useState<number | null>(null)
  const { campus, now, rules, roster, attendance, docId } = useTeacherRoster(teacher, period)
  useEffect(() => {
    if (period != null || !campus.bell.length || !periods.length) return
    const upcoming = periods.find(p => { const b = campus.bell.find(x => x.period === p.period); return b && now.minutes < b.start + 5 })
    setPeriod((upcoming ?? periods[periods.length - 1]).period)
  }, [campus.bell.length, periods.length])
  useEffect(() => { track('dashboard_open') }, [])

  const [markFor, setMarkFor] = useState<RosterRow | null>(null)
  const [decision, setDecision] = useState<AttendanceStatus>('present')
  const [reason, setReason] = useState(REASONS[0])
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [noteSource, setNoteSource] = useState<'ai' | 'template'>('template')
  const [noteWhy, setNoteWhy] = useState<string | undefined>()
  const [writing, setWriting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'attention'>('all')

  const events = useMemo(() => [...allEvents].sort((a, b) => b.createdAt - a.createdAt).slice(0, 14), [allEvents])
  const cls = periods.find(p => p.period === period)
  const bellFor = campus.bell.find(b => b.period === period)
  if (!campus.ready) return <Spinner />
  if (!periods.length) return <EmptyState icon="users" title={t('Set up your classes first')} body={t('Tell ShuttleSync which periods you teach and where, so your roster can appear.')} action={<Button onClick={() => nav('/teacher/classes')}>{t('Go to My classes')}</Button>} />
  if (!roster) return <Spinner />

  const { counts, rows, lateBuses } = roster
  const visible = rows
    .filter(r => r.status !== 'no_shuttle' || filter === 'all')
    .filter(r => filter === 'all' || ['unverified', 'not_checked_in', 'excused_bus_late'].includes(r.status) || (r.decision && !['present'].includes(r.decision.to)))
    .sort((a, b) => priority(a) - priority(b) || a.student.name.localeCompare(b.student.name))

  async function saveDecision() {
    if (!markFor || !docId || !period) return
    const store = getStore()
    const prior = attendance?.overrides ?? []
    const override = { studentId: markFor.student.id, from: markFor.status, to: decision, reason, by: teacher.name, at: Date.now() }
    const next: Partial<AttendanceDoc> = {
      date: now.date, period, teacherId: teacher.id, overrides: [...prior.filter(o => o.studentId !== markFor.student.id), override],
      records: { ...(attendance?.records ?? {}), [markFor.student.id]: decision }, isSimulated: markFor.student.isSimulated ?? false,
    }
    await store.update('attendance', docId, next)
    await store.add('events', { type: 'override', studentId: markFor.student.id, message: `${teacher.name} marked ${markFor.student.name.split(' ')[0]} ${decision.replace(/_/g, ' ')}.`, createdAt: now.nowMs, isSimulated: markFor.student.isSimulated ?? false })
    track('teacher_override', { from: markFor.status, to: decision })
    toast(t('Saved'))
    setMarkFor(null)
  }

  async function writeNote() {
    setNoteOpen(true); setWriting(true)
    const facts: NoteFacts = { period: period!, total: counts.total, arrived: counts.arrived + counts.noShuttle, onTheWay: counts.onTheWay + counts.waiting, excused: counts.excused, unverified: counts.unverified, notCheckedIn: counts.notCheckedIn, lateBuses }
    const r = await generateNote(facts)
    setNote(r.note); setNoteSource(r.source); setNoteWhy(r.why); setWriting(false)
    track('ai_note_generated', { source: r.source })
  }

  async function approve() {
    if (!docId || !period) return
    const store = getStore()
    await store.update('attendance', docId, {
      date: now.date, period, teacherId: teacher.id, records: recordsFromRows(rows), overrides: attendance?.overrides ?? [], aiNote: note, aiNoteSource: noteSource,
      approvedAt: Date.now(), isSimulated: rows.every(r => r.student.isSimulated),
    })
    await store.add('events', { type: 'note_approved', message: `${teacher.name} approved the period ${period} attendance note.`, createdAt: now.nowMs, isSimulated: rows.every(r => r.student.isSimulated) })
    track('ai_note_approved', { source: noteSource })
    toast(t('Approved'))
    setNoteOpen(false)
  }

  const tiles = [
    { key: 'arrived', label: t('Arrived'), n: counts.arrived + counts.noShuttle, icon: 'check-circle', tone: 'text-ok' },
    { key: 'way', label: t('On the way'), n: counts.onTheWay, icon: 'bus', tone: 'text-info' },
    { key: 'waiting', label: t('Waiting'), n: counts.waiting, icon: 'hourglass', tone: 'text-mute' },
    { key: 'excused', label: t('Excused'), n: counts.excused, icon: 'clock', tone: 'text-warn' },
    { key: 'unv', label: t('Unverified'), n: counts.unverified, icon: 'help-circle', tone: 'text-warn' },
    { key: 'nci', label: t('Not checked in'), n: counts.notCheckedIn, icon: 'circle-slash', tone: 'text-bad' },
  ]

  return (
    <div className="space-y-5 max-w-[1500px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-5xl font-extrabold leading-[.95]">{t('Period {p}', { p: period ?? '' })}{cls ? ` · ${cls.courseName}` : ''}</h1>
          <p className="text-mute num mt-1">{cls && campus.buildingById.get(cls.buildingId)?.name} · {t('Room')} {cls?.room} · {bellFor ? `${t('Bell')} ${fmtClock(bellFor.start)}` : ''} · {t('Now')} {fmtClock(now.minutes)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {periods.map(p => (
            <button key={p.period} onClick={() => setPeriod(p.period)} aria-pressed={p.period === period} data-testid={`period-${p.period}`}
              className={`h-10 min-w-10 px-3 rounded-sign font-display text-2xl font-bold border ${p.period === period ? 'bg-brand text-brand-ink border-brand' : 'bg-panel border-line'}`}>{p.period}</button>
          ))}
          <Button icon="spark" onClick={writeNote} data-testid="write-note">{t('Write attendance note')}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3" role="list" aria-label={t('Counts')}>
        {tiles.map(x => (
          <Panel key={x.key} className="p-3" role="listitem" data-testid={`tile-${x.key}`}>
            <div className={`flex items-center gap-1.5 text-sm font-bold ${x.tone}`}><Icon name={x.icon} size={16} />{x.label}</div>
            <div className="font-display text-6xl font-extrabold leading-none mt-1"><RollingNumber value={x.n} /></div>
          </Panel>
        ))}
      </div>

      {(counts.notCheckedIn > 0 || counts.unverified > 0) && <Banner tone="info" icon="shield">{t('"Not checked in" and "Unverified" are not accusations. A student may have a dead phone or bad GPS. You decide.')}</Banner>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-line">
            <h2 className="text-3xl font-bold">{t('Roster')} <span className="text-mute num text-xl">{counts.total}</span></h2>
            <div role="radiogroup" aria-label={t('Filter')} className="inline-flex rounded-sign border border-line p-0.5 bg-raised text-sm font-bold">
              {(['all', 'attention'] as const).map(f => <button key={f} role="radio" aria-checked={filter === f} onClick={() => setFilter(f)} className={`px-3 min-h-[34px] rounded-[4px] ${filter === f ? 'bg-panel' : 'text-mute'}`}>{f === 'all' ? t('Everyone') : t('Needs attention')}</button>)}
            </div>
          </div>
          {rows.length === 0 ? <div className="p-6 text-mute">{t('No students have joined this class yet. Students pick you as their teacher when they add their schedule.')}</div> : (
            <LayoutGroup>
              <ul className="divide-y divide-line" data-testid="roster">
                <AnimatePresence initial={false}>
                  {visible.map(r => (
                    <motion.li key={r.student.id} layout transition={{ type: 'spring', stiffness: 420, damping: 36 }} className="p-3 flex flex-wrap items-center gap-x-4 gap-y-2" data-testid={`row-${r.student.code ?? r.student.id}`} data-status={r.status}>
                      <div className="min-w-[10rem] flex-1">
                        <div className="font-bold text-lg leading-tight flex items-center gap-2">{r.student.name}{r.student.isSimulated && <Pill tone="warn" icon="flask">{t('Sim')}</Pill>}</div>
                        <div className="text-sm text-mute flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          {r.need.needs ? (<>
                            <BuildingBadge code={campus.buildingById.get(r.fromBuildingId ?? '')?.code} size={18} />→<BuildingBadge code={campus.buildingById.get(r.entry.buildingId)?.code} size={18} />
                            {r.run && <span>{t('Shuttle {n}', { n: campus.busById.get(r.run.busId)?.number ?? '' })}{r.status === 'on_the_way' && r.projectedArrive != null ? ` · ${t('arrives in')} ${Math.max(1, Math.round(r.projectedArrive - now.minutes))} min` : ''}{r.status === 'excused_bus_late' && r.assessment && r.assessment.extraMin > 0 ? ` · ${t('+{m} min over a normal ride', { m: r.assessment.extraMin })}` : ''}</span>}
                          </>) : <span>{t('No shuttle needed')}</span>}
                        </div>
                        {r.status === 'unverified' && r.checkin && <div className="text-sm text-warn mt-0.5">{t.dyn(r.checkin.verifyReason)}</div>}
                        {r.decision && <div className="text-sm text-mute mt-0.5">{t('You marked: {d} ({why})', { d: t.dyn(r.decision.to.replace(/_/g, ' ')) === r.decision.to.replace(/_/g, ' ') ? t(r.decision.to.replace(/_/g, ' ')) : r.decision.to, why: t(r.decision.reason) })}</div>}
                      </div>
                      <StatusChip status={r.status} />
                      <Button variant="outline" size="sm" onClick={() => { setMarkFor(r); setDecision(r.decision?.to ?? (r.status === 'excused_bus_late' ? 'excused_bus_late' : 'present')); setReason(REASONS[0]) }} data-testid={`mark-${r.student.code ?? r.student.id}`}>{t('Mark')}</Button>
                    </motion.li>
                  ))}
                </AnimatePresence>
                {visible.length === 0 && <li className="p-6 text-mute">{t('Nobody needs attention right now.')}</li>}
              </ul>
            </LayoutGroup>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel className="p-3 space-y-2">
            <div className="flex items-center justify-between"><h2 className="text-3xl font-bold">{t('Live map')}</h2>{campus.buses.some(b => b.isSimulated && b.lastLocation) && <SimulatedTag />}</div>
            <MapView buildings={campus.buildings} stops={campus.stops} buses={campus.buses} rainActive={rules.rainStopActive} height={320} onBusClick={b => nav(`/teacher/bus/${b.id}`)} />
            <div className="flex flex-wrap gap-2">{campus.buses.filter(b => b.status !== 'idle').map(b => <button key={b.id} onClick={() => nav(`/teacher/bus/${b.id}`)}><BusSign number={b.number} className={b.status === 'delayed' ? 'ring-2 ring-warn' : ''} /></button>)}</div>
          </Panel>
          <Panel className="p-3">
            <h2 className="text-3xl font-bold mb-2">{t('Event feed')}</h2>
            <ul className="space-y-1.5" data-testid="feed" aria-live="polite">
              <AnimatePresence initial={false}>
                {events.map(e => (
                  <motion.li key={e.id} layout initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2 text-sm"><Icon name={iconForEvent[e.type] ?? 'info'} size={16} className="mt-0.5 shrink-0 text-mute" /><span>{t.dyn(e.message)}</span></motion.li>
                ))}
              </AnimatePresence>
              {events.length === 0 && <li className="text-mute text-sm">{t('Events appear here as buses move and students check in.')}</li>}
            </ul>
          </Panel>
        </div>
      </div>

      <Sheet open={!!markFor} onClose={() => setMarkFor(null)} title={markFor ? t('Mark {n}', { n: markFor.student.name }) : ''}>
        <div className="space-y-4">
          <p className="text-sm text-mute">{t('You have the final say. This is saved with your name and the reason.')}</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('Decision')}>
            {DECISIONS.map(d => <button key={d.to} role="radio" aria-checked={decision === d.to} onClick={() => setDecision(d.to)} data-testid={`decision-${d.to}`}
              className={`flex items-center gap-2 rounded-sign border px-3 min-h-[52px] font-bold text-left ${decision === d.to ? 'border-brand bg-brand/10' : 'border-line bg-panel'}`}><Icon name={d.icon} size={18} />{t(d.label)}</button>)}
          </div>
          <Field label={t('Reason')}><Select value={reason} onChange={e => setReason(e.target.value)}>{REASONS.map(r => <option key={r} value={r}>{t(r)}</option>)}</Select></Field>
          <Button full onClick={saveDecision} data-testid="decision-save">{t('Save decision')}</Button>
        </div>
      </Sheet>

      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} title={t('Attendance note')}>
        {writing ? <Spinner label={t('Writing')} /> : (
          <div className="space-y-3">
            <div className="flex items-center gap-2"><Pill tone={noteSource === 'ai' ? 'info' : 'mute'} icon={noteSource === 'ai' ? 'spark' : 'file'}>{noteSource === 'ai' ? t('Written by AI, numbers checked') : t('Plain template (AI off or did not match)')}</Pill></div>
            <textarea value={note} onChange={e => { setNote(e.target.value); track('ai_note_edited') }} rows={4} className="w-full rounded-sign border border-line bg-panel p-3 text-base" aria-label={t('Attendance note')} data-testid="note-text" />
            {noteWhy && noteSource === 'template' && <p className="text-xs text-mute">{noteWhy}</p>}
            <p className="text-xs text-mute">{t('Every number comes from the live roster. You can edit the words before approving.')}</p>
            <Button full onClick={approve} data-testid="note-approve">{t('Approve and save')}</Button>
          </div>
        )}
      </Sheet>
      {settings.mode === 'demo' && null}
    </div>
  )
}

/** What a teacher should look at first. */
function priority(r: RosterRow): number {
  const order = { unverified: 0, not_checked_in: 1, excused_bus_late: 2, waiting: 3, on_the_way: 4, arrived: 5, no_shuttle: 6 } as const
  return order[r.status]
}
