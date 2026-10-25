// Firebase config comes from Vite env vars. If they are missing the app runs fully offline
// on the local store (demo mode) — that is a feature, not an error: the pitch must never depend on Wi-Fi.
const env = (import.meta as any).env ?? {}

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId)
export const SCHOOL_ID: string = env.VITE_SCHOOL_ID || 'plano-senior'
export const STAFF_PIN: string = env.VITE_STAFF_PIN || 'plano'

const FORCE_KEY = 'ss_force_offline'
export const forcedOffline = (): boolean => { try { return localStorage.getItem(FORCE_KEY) === '1' } catch { return false } }
export const setForcedOffline = (on: boolean) => { try { on ? localStorage.setItem(FORCE_KEY, '1') : localStorage.removeItem(FORCE_KEY) } catch { /* ignore */ } }
