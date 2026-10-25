// Tiny i18n. The English sentence IS the key: t('Scan the code on the bus'). Spanish lives in es.json
// (English → Spanish). Why: copy stays readable in the component, a missing translation falls back to
// English instead of showing a raw key, and tests/unit/i18n.test.ts fails the build if any string lacks Spanish.
import es from './es.json'
import { usePrefs, prefs } from '@/app/session'

const ES = es as Record<string, string>

export function translate(lang: 'en' | 'es', key: string, vars?: Record<string, string | number>): string {
  let s = lang === 'es' ? ES[key] ?? key : key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}

export const t = (key: string, vars?: Record<string, string | number>) => translate(prefs.lang(), key, vars)

/**
 * Messages built inside lib/ code (for example: Shuttle 1 left stop A.) are English strings with values baked in.
 * Instead of threading translation through the pure logic, we recognise their shape here and translate at display time.
 * Each entry is [regex over the English message, translation key]; named groups become {placeholders}.
 */
export const DYNAMIC: [RegExp, string][] = [
  [/^You were (?<m>\d+) m from the shuttle when you scanned, so your teacher will confirm\.$/, 'You were {m} m from the shuttle when you scanned, so your teacher will confirm.'],
  [/^Shuttle (?<n>\S+) arrived at (?<s>.+)\.$/, 'Shuttle {n} arrived at {s}.'],
  [/^Shuttle (?<n>\S+) left (?<s>.+)\.$/, 'Shuttle {n} left {s}.'],
  [/^Shuttle (?<n>\S+) is running about (?<m>\d+) min slow\. Riders who checked in are excused automatically\.$/, 'Shuttle {n} is running about {m} min slow. Riders who checked in are excused automatically.'],
  [/^Shuttle (?<n>\S+) is back to normal\.$/, 'Shuttle {n} is back to normal.'],
  [/^(?<w>.+) checked in on Shuttle (?<n>\S+) \(unverified — teacher decides\)\.$/, '{w} checked in on Shuttle {n} (unverified — teacher decides).'],
  [/^(?<w>.+) checked in on Shuttle (?<n>\S+)\.$/, '{w} checked in on Shuttle {n}.'],
  [/^(?<w>.+) marked (?<s>.+?) (?<d>present|excused bus late|tardy|absent|unknown|in transit)\.$/, '{w} marked {s} {d}.'],
  [/^(?<w>.+) approved the period (?<p>\d+) attendance note\.$/, '{w} approved the period {p} attendance note.'],
]
/** Words used inside DYNAMIC messages that also need translating. */
export const DYNAMIC_WORDS = ['present', 'excused bus late', 'tardy', 'absent', 'unknown', 'in transit']

export function translateDynamic(lang: 'en' | 'es', text: string): string {
  if (lang === 'en' || !text) return text
  if (ES[text]) return ES[text]
  for (const [re, key] of DYNAMIC) {
    const m = text.match(re)
    if (m?.groups) {
      const vars: Record<string, string> = { ...m.groups }
      if (vars.d) vars.d = ES[vars.d] ?? vars.d
      return translate(lang, key, vars)
    }
  }
  return text
}

/** Hook form: re-renders when the language changes. `t.dyn(text)` translates lib-generated messages. */
export function useT() {
  const p = usePrefs()
  const lang = p.startsWith('es') ? 'es' : 'en'
  return Object.assign((key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), { dyn: (text: string) => translateDynamic(lang, text) })
}
