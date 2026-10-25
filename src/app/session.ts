// Who is using this device? Stored locally (no accounts needed for the demo).
// The staff PIN is a client-side gate for hackathon use; real enforcement is firestore.rules (see DECISIONS.md).
import { useSyncExternalStore } from 'react'
import type { Role } from '@/types'
import { STAFF_PIN } from '@/firebase/config'

export interface Profile {
  role: Role | null
  studentId?: string
  teacherId?: string
  busId?: string
  stopId?: string
  name?: string
}

// Role/profile is stored per device. For testing several roles on ONE laptop, open each tab with ?slot=name
// (e.g. /start?slot=teacher): the slot is remembered for that tab and gets its own profile.
const slot = (() => {
  try {
    const q = new URLSearchParams(location.search).get('slot')
    if (q) sessionStorage.setItem('ss_slot', q)
    return sessionStorage.getItem('ss_slot')
  } catch { return null }
})()
const KEY = slot ? `ss_profile_${slot}` : 'ss_profile'
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())
const safe = {
  get: (k: string, area: Storage = localStorage) => { try { return area.getItem(k) } catch { return null } },
  set: (k: string, v: string, area: Storage = localStorage) => { try { area.setItem(k, v) } catch { /* private mode */ } },
  del: (k: string, area: Storage = localStorage) => { try { area.removeItem(k) } catch { /* ignore */ } },
}

let cached: Profile | null = null
function read(): Profile {
  if (cached) return cached
  try { cached = JSON.parse(safe.get(KEY) || '{"role":null}') } catch { cached = { role: null } }
  return cached!
}

export function setProfile(p: Profile) { cached = p; safe.set(KEY, JSON.stringify(p)); emit() }
export function patchProfile(p: Partial<Profile>) { setProfile({ ...read(), ...p }) }
export function signOut() { cached = { role: null }; safe.del(KEY); safe.del('ss_staff', sessionStorage); emit() }
export function useProfile(): Profile {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn) } }, read, read)
}

// ---- staff gate ----------------------------------------------------------------------------
export const isStaffUnlocked = () => safe.get('ss_staff', sessionStorage) === '1'
export function unlockStaff(pin: string): boolean {
  if (pin.trim().toLowerCase() === STAFF_PIN.toLowerCase()) { safe.set('ss_staff', '1', sessionStorage); emit(); return true }
  return false
}
export function useStaffUnlocked(): boolean {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn) } }, isStaffUnlocked, isStaffUnlocked)
}

// ---- anonymous session id for analytics (new per browser tab session; contains no identity) -----
export function sessionId(): string {
  let s = safe.get('ss_session', sessionStorage)
  if (!s) { s = 's' + Math.random().toString(36).slice(2, 10); safe.set('ss_session', s, sessionStorage) }
  return s
}

// ---- consent -------------------------------------------------------------------------------
export const CONSENT_VERSION = 1
export const hasConsent = () => safe.get('ss_consent') === String(CONSENT_VERSION)
export function giveConsent() { safe.set('ss_consent', String(CONSENT_VERSION)); emit() }
export function useConsent(): boolean {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn) } }, hasConsent, hasConsent)
}

// ---- first-run coach marks -------------------------------------------------------------------
export const coachSeen = (k: string) => safe.get('ss_coach_' + k) === '1'
export const markCoach = (k: string) => { safe.set('ss_coach_' + k, '1'); emit() }

// ---- preferences (theme, language, large text) ----------------------------------------------
export type Lang = 'en' | 'es'
export type Theme = 'system' | 'light' | 'dark'
export const prefs = {
  lang: (): Lang => (safe.get('ss_lang') === 'es' ? 'es' : 'en'),
  theme: (): Theme => (['light', 'dark'].includes(safe.get('ss_theme') ?? '') ? (safe.get('ss_theme') as Theme) : 'system'),
  large: (): boolean => safe.get('ss_large') === '1',
  setLang(l: Lang) { safe.set('ss_lang', l); document.documentElement.lang = l; emit() },
  setTheme(t: Theme) { t === 'system' ? safe.del('ss_theme') : safe.set('ss_theme', t); applyPrefs(); emit() },
  setLarge(on: boolean) { safe.set('ss_large', on ? '1' : '0'); applyPrefs(); emit() },
}
export function applyPrefs() {
  const r = document.documentElement
  const t = prefs.theme()
  if (t === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t)
  r.setAttribute('data-large-text', prefs.large() ? '1' : '0')
  r.lang = prefs.lang()
}
export function usePrefs() {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn) } }, () => `${prefs.lang()}|${prefs.theme()}|${prefs.large()}`, () => 'en|system|false')
}
