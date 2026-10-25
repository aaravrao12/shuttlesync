// CSV enrollment: one row per student per class. Columns (header row required):
//   name, studentNumber, grade, period, building, room, teacher, course
// Long format keeps the file easy to export from a spreadsheet or the school's student information system.
import type { ScheduleEntry, Student, Teacher, Building } from '@/types'

export interface CsvResult { students: Student[]; errors: string[] }

/** Minimal CSV line parser that understands "quoted, values". */
export function parseCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ''; let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') q = false; else cur += ch }
    else if (ch === '"') q = true
    else if (ch === ',') { out.push(cur.trim()); cur = '' }
    else cur += ch
  }
  out.push(cur.trim())
  return out
}

export function parseEnrollment(csv: string, buildings: Building[], teachers: Teacher[]): CsvResult {
  const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const errors: string[] = []
  if (lines.length < 2) return { students: [], errors: ['Add a header row and at least one data row.'] }
  const head = parseCsvLine(lines[0]).map(h => h.toLowerCase())
  const idx = (n: string) => head.indexOf(n)
  for (const need of ['name', 'studentnumber', 'period', 'building']) if (idx(need) < 0) errors.push(`Missing column: ${need}`)
  if (errors.length) return { students: [], errors }

  const byNumber = new Map<string, Student>()
  lines.slice(1).forEach((line, k) => {
    const c = parseCsvLine(line)
    const get = (n: string) => (idx(n) >= 0 ? c[idx(n)] ?? '' : '')
    const num = get('studentnumber'), name = get('name')
    const period = parseInt(get('period'), 10)
    const b = buildings.find(x => x.code.toLowerCase() === get('building').toLowerCase() || x.id.toLowerCase() === get('building').toLowerCase())
    if (!num || !name) return void errors.push(`Row ${k + 2}: name and studentNumber are required.`)
    if (!(period >= 1 && period <= 12)) return void errors.push(`Row ${k + 2}: period must be 1–12.`)
    if (!b) return void errors.push(`Row ${k + 2}: unknown building "${get('building')}".`)
    const tname = get('teacher').toLowerCase()
    const tc = tname ? teachers.find(t => t.name.toLowerCase().includes(tname) || tname.includes(t.name.toLowerCase().replace(/^(mr|ms|mrs|dr)\.?\s*/, ''))) : undefined
    const entry: ScheduleEntry = { period, buildingId: b.id, room: get('room'), courseName: get('course') || `Period ${period}`, teacherId: tc?.id ?? null, teacherName: tc?.name ?? (get('teacher') || undefined) }
    const s = byNumber.get(num) ?? { id: `enrolled-${num}`, name, studentNumber: num, grade: parseInt(get('grade'), 10) || undefined, preferredLanguage: 'en' as const, schedule: [], code: 'E' + num.slice(-4), isSimulated: false }
    s.schedule = [...s.schedule.filter(e => e.period !== period), entry]
    byNumber.set(num, s)
  })
  return { students: [...byNumber.values()], errors }
}
