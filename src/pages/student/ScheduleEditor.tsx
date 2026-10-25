import type { Building, ScheduleEntry, Teacher } from '@/types'
import { Select, TextInput } from '@/components/ui/Primitives'
import { BuildingBadge } from '@/components/ui/BuildingBadge'
import { useT } from '@/i18n'

export interface Row { period: number; courseName: string; buildingId: string; room: string; teacherId: string; teacherName: string }

/** One row per real period number (Plano Senior has periods 0–7). */
export const emptyRows = (periods: number[]): Row[] => periods.map(period => ({ period, courseName: '', buildingId: '', room: '', teacherId: '', teacherName: '' }))

export function rowsFromSchedule(sched: ScheduleEntry[], periods: number[]): Row[] {
  const base = emptyRows(periods)
  for (const e of sched) {
    const r = base.find(x => x.period === e.period)
    if (r) Object.assign(r, { courseName: e.courseName, buildingId: e.buildingId, room: e.room, teacherId: e.teacherId ?? '', teacherName: e.teacherName ?? '' })
  }
  return base
}

/** Rows with a building are real classes; blank rows are free periods and are dropped. */
export const rowsToSchedule = (rows: Row[]): ScheduleEntry[] =>
  rows.filter(r => r.buildingId).map(r => ({ period: r.period, buildingId: r.buildingId, room: r.room.trim(), courseName: r.courseName.trim() || `Period ${r.period}`, teacherId: r.teacherId || null, teacherName: r.teacherName || undefined }))

/** Match a teacher name read from a photo ("Okafor", "Mr. Okafor") to a known teacher by last name. */
export function matchTeacher(name: string, teachers: Teacher[]): Teacher | undefined {
  const last = name.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !['mrs', 'miss', 'mr', 'dr'].includes(w)).pop()
  return last ? teachers.find(t => t.name.toLowerCase().includes(last)) : undefined
}

export function ScheduleEditor({ rows, onChange, buildings, teachers }: { rows: Row[]; onChange: (r: Row[]) => void; buildings: Building[]; teachers: Teacher[] }) {
  const t = useT()
  const set = (i: number, patch: Partial<Row>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)))
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.period} className="bg-panel border border-line rounded-sign p-3 space-y-2">
          <div className="flex items-center gap-2">
            <BuildingBadge code={buildings.find(b => b.id === r.buildingId)?.code ?? '–'} size={32} />
            <span className="font-display text-2xl font-bold">{t('Period {p}', { p: r.period })}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TextInput aria-label={t('Class name')} placeholder={t('Class name')} value={r.courseName} onChange={e => set(i, { courseName: e.target.value })} className="col-span-2" />
            <Select aria-label={t('Building')} value={r.buildingId} onChange={e => set(i, { buildingId: e.target.value })} data-testid={`row-building-${r.period}`}>
              <option value="">{t('No class (free period)')}</option>
              {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <TextInput aria-label={t('Room')} placeholder={t('Room')} value={r.room} onChange={e => set(i, { room: e.target.value })} />
            <Select aria-label={t('Teacher')} className="col-span-2" value={r.teacherId || (r.teacherName ? '__other' : '')}
              onChange={e => { const v = e.target.value; const tc = teachers.find(x => x.id === v); set(i, { teacherId: tc ? tc.id : '', teacherName: tc ? tc.name : v === '__other' ? r.teacherName : '' }) }}>
              <option value="">{t('Teacher (optional)')}</option>
              {teachers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              <option value="__other">{t('Someone else')}</option>
            </Select>
          </div>
        </li>
      ))}
    </ul>
  )
}
