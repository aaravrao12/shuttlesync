import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
// @ts-ignore plain JS helper shared with `node scripts/extract-i18n.mjs`
import { extract } from '../../scripts/extract-i18n.mjs'
import { translate } from '@/i18n'

const es: Record<string, string> = JSON.parse(fs.readFileSync('src/i18n/es.json', 'utf8'))
const vars = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort().join(',')

describe('i18n', () => {
  it('every user-facing string on student/teacher/public screens has a Spanish translation', () => {
    const missing = (extract('src') as string[]).filter(k => !(k in es))
    expect(missing).toEqual([])
  })
  it('translations keep the same {placeholders} as the English', () => {
    const bad = Object.entries(es).filter(([k, v]) => vars(k) !== vars(v)).map(([k]) => k)
    expect(bad).toEqual([])
  })
  it('falls back to English for unknown keys and fills variables', () => {
    expect(translate('es', 'Not a real key {n}', { n: 3 })).toBe('Not a real key 3')
    expect(translate('es', 'Bus {n}', { n: 14 })).toBe('Autobús 14')
    expect(translate('en', 'Bus {n}', { n: 14 })).toBe('Bus 14')
  })
})

import { translateDynamic, DYNAMIC } from '@/i18n'
describe('dynamic (lib-generated) messages', () => {
  it('every dynamic pattern key exists in Spanish with matching placeholders', () => {
    for (const [, key] of DYNAMIC) { expect(es[key], key).toBeTruthy(); expect(vars(es[key])).toBe(vars(key)) }
  })
  it('translates messages whose values are baked in', () => {
    expect(translateDynamic('es', 'Shuttle 1 left Building A loop.')).toBe('El autobús 1 salió de Building A loop.')
    expect(translateDynamic('es', 'Maya R. checked in on Shuttle 1.')).toBe('Maya R. se registró en el autobús 1.')
    expect(translateDynamic('es', 'You were 120 m from the shuttle when you scanned, so your teacher will confirm.')).toMatch(/120 m/)
    expect(translateDynamic('es', 'Ms. Rivera marked Maya present.')).toBe('Ms. Rivera marcó a Maya como presente.')
  })
  it('leaves English and unknown text untouched', () => {
    expect(translateDynamic('en', 'Shuttle 1 left X.')).toBe('Shuttle 1 left X.')
    expect(translateDynamic('es', 'Totally new sentence')).toBe('Totally new sentence')
  })
  it('static lib copy (status labels, plan messages, verification reasons) is translated', () => {
    for (const k of ["Hasn't boarded yet", 'Excused: shuttle delay', 'On the shuttle: location matches.', 'No shuttle needed: walk indoors.', 'Shuttle phone offline, so your teacher will confirm.']) expect(es[k], k).toBeTruthy()
  })
})
