import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Banner, Field, Panel, Select, Spinner, TextInput } from '@/components/ui/Primitives'
import { BuildingBadge } from '@/components/ui/BuildingBadge'
import { useCampus, usePeople } from '@/firebase/hooks'
import { getStore } from '@/firebase/store'
import { useProfile } from '@/app/session'
import { useToast } from '@/app/Toast'
import { useT } from '@/i18n'
import type { TeacherPeriod } from '@/types'

/** Teachers say which periods they teach and where; students then pick them by name when they add a schedule. */
export default function Classes() {
  const t = useT()
  const toast = useToast()
  const profile = useProfile()
  const campus = useCampus()
  const { teachers, students } = usePeople()
  const teacher = teachers.find(x => x.id === profile.teacherId)
  const [draft, setDraft] = useState<TeacherPeriod[] | null>(null)
  if (!campus.ready) return <Spinner />
  if (!teacher) return <Banner tone="info">{t('Pick who you are on the Live dashboard first.')}</Banner>
  const rows = draft ?? [...teacher.periods].sort((a, b) => a.period - b.period)
  const set = (i: number, patch: Partial<TeacherPeriod>) => setDraft(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)))
  const used = new Set(rows.map(r => r.period))
  const nextFree = campus.bell.find(b => !used.has(b.period))?.period

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-5xl font-extrabold leading-[.95]">{t('My classes')}</h1>
      <p className="text-mute">{t('{n} students have added you to their schedule.', { n: students.filter(s => s.schedule.some(e => e.teacherId === teacher.id)).length })}</p>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <Panel key={i} className="p-3 grid grid-cols-2 sm:grid-cols-[80px_1fr_1fr_100px_auto] gap-2 items-end">
            <Field label={t('Period')}><Select value={r.period} onChange={e => set(i, { period: Number(e.target.value) })}>{campus.bell.map(b => <option key={b.id} value={b.period}>{b.period}</option>)}</Select></Field>
            <Field label={t('Class name')}><TextInput value={r.courseName} onChange={e => set(i, { courseName: e.target.value })} /></Field>
            <Field label={t('Building')}><Select value={r.buildingId} onChange={e => set(i, { buildingId: e.target.value })}>{campus.buildings.filter(b => b.zone !== 'closed').map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
            <Field label={t('Room')}><TextInput value={r.room} onChange={e => set(i, { room: e.target.value })} /></Field>
            <Button variant="ghost" onClick={() => setDraft(rows.filter((_, k) => k !== i))} aria-label={t('Remove class')} icon="trash" />
          </Panel>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" icon="plus" disabled={nextFree == null} onClick={() => setDraft([...rows, { period: nextFree!, buildingId: campus.buildings.find(b => b.zone !== 'closed')?.id ?? '', room: '', courseName: '' }])}>{t('Add a class')}</Button>
        <Button disabled={!draft} onClick={async () => { await getStore().update('teachers', teacher.id, { periods: rows }); setDraft(null); toast(t('Saved')) }}>{t('Save changes')}</Button>
      </div>
      <div className="flex items-center gap-2 text-sm text-mute">{rows.slice(0, 4).map((r, i) => <BuildingBadge key={i} code={campus.buildingById.get(r.buildingId)?.code} size={20} />)}</div>
    </div>
  )
}
