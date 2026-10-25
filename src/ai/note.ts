// The AI attendance note. The model only writes words; every number comes from lib/ code and is CHECKED here.
// If the sentence contains a number we did not give it, we throw it away and use the template. Teachers approve either way.
import { NoteResult } from './schemas'
import { callAI } from './client'

export interface NoteFacts {
  period: number
  total: number
  arrived: number
  onTheWay: number
  excused: number
  unverified: number
  notCheckedIn: number
  /** buses that ran late for this class: number + delay in minutes */
  lateBuses: { bus: string; minutes: number }[]
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Deterministic fallback sentence. Also what runs when AI is off. */
export function templateNote(f: NoteFacts): string {
  const parts: string[] = []
  if (f.excused) {
    const delay = f.lateBuses.length ? ` for ${f.lateBuses.map(b => `Shuttle ${b.bus}'s ride, ${b.minutes} min over normal,`).join(' and ')}` : ''
    parts.push(`${plural(f.excused, 'student', 'students')} excused${delay}`)
  }
  if (f.unverified) parts.push(`${plural(f.unverified, 'check-in', 'check-ins')} unverified and waiting for your decision`)
  if (f.notCheckedIn) parts.push(`${plural(f.notCheckedIn, 'student', 'students')} not checked in`)
  if (!parts.length) return `Period ${f.period}: all ${f.total} expected students are accounted for.`
  return `Period ${f.period}: ${parts.join('; ')}.${f.notCheckedIn ? ' Consider following up.' : ''}`
}

/** Every integer in the note must be one we supplied, and every attention-worthy count must be mentioned. */
export function validateNote(note: string, f: NoteFacts): boolean {
  const allowed = new Set<number>([f.period, f.total, f.arrived, f.onTheWay, f.excused, f.unverified, f.notCheckedIn, ...f.lateBuses.flatMap(b => [Number(b.bus), b.minutes])])
  const nums = (note.match(/\d+/g) ?? []).map(Number)
  if (nums.some(n => !allowed.has(n))) return false
  const must = [f.excused, f.unverified, f.notCheckedIn].filter(n => n > 0)
  if (must.some(n => !nums.includes(n))) return false
  return true
}

export async function generateNote(f: NoteFacts): Promise<{ note: string; source: 'ai' | 'template'; why?: string }> {
  try {
    const r = await callAI('note', { text: JSON.stringify(f) }, NoteResult, 12000)
    if (validateNote(r.note, f)) return { note: r.note, source: 'ai' }
    return { note: templateNote(f), source: 'template', why: 'The AI sentence did not match the computed numbers, so we used a plain template.' }
  } catch (e: any) {
    return { note: templateNote(f), source: 'template', why: e?.message }
  }
}
