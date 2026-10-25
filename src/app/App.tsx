import { Suspense, lazy, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { initStore } from '@/firebase/store'
import { useCampus, useClockSync, useSettings, useStoreMode } from '@/firebase/hooks'
import { isLegacyCampus, seedDemo } from '@/firebase/seed'
import { clock } from '@/lib/clock'
import { setTrackContext, track } from '@/evidence/track'
import { useProfile, useStaffUnlocked } from './session'
import { purgeExpiredCheckins } from '@/lib/retention'
import { ToastProvider } from './Toast'
import { Spinner } from '@/components/ui/Primitives'
import { FeedbackWidget } from '@/components/evidence/FeedbackWidget'
import { StaffLayout, PublicLayout } from './Layouts'
import { useT } from '@/i18n'
import Landing from '@/pages/landing/Landing' // eager: it is the first screen, so no extra round trip before first paint
import { ErrorBoundary } from './ErrorBoundary'
import { useSimulatorHost } from '@/demo/useSimulator'

const RolePicker = lazy(() => import('@/pages/auth/RolePicker'))
const StudentApp = lazy(() => import('@/pages/student/StudentApp'))
const BusDevice = lazy(() => import('@/pages/bus/BusDevice'))
const Kiosk = lazy(() => import('@/pages/kiosk/Kiosk'))
const Dashboard = lazy(() => import('@/pages/teacher/Dashboard'))
const BusDetail = lazy(() => import('@/pages/teacher/BusDetail'))
const Reports = lazy(() => import('@/pages/teacher/Reports'))
const Classes = lazy(() => import('@/pages/teacher/Classes'))
const Setup = lazy(() => import('@/pages/admin/Setup'))
const DemoPanel = lazy(() => import('@/pages/demo/DemoPanel'))
const TestMode = lazy(() => import('@/pages/evidence/TestMode'))
const Results = lazy(() => import('@/pages/evidence/Results'))
const Changelog = lazy(() => import('@/pages/evidence/Changelog'))
const Baseline = lazy(() => import('@/pages/evidence/Baseline'))
const HowItWorks = lazy(() => import('@/pages/evidence/HowItWorks'))
const Privacy = lazy(() => import('@/pages/evidence/Privacy'))
const Pitch = lazy(() => import('@/pages/pitch/Pitch'))

/** Runs once the store is ready: syncs the demo clock + analytics context, runs the simulator host, upgrades old local demo data. */
function AppEffects() {
  const t = useT()
  useClockSync()
  useSimulatorHost()
  const settings = useSettings()
  const profile = useProfile()
  const campus = useCampus()
  const loc = useLocation()
  const staff = useStaffUnlocked()
  // Retention: whenever staff open the app, quietly delete check-ins older than 30 days.
  useEffect(() => { if (staff) import('@/firebase/store').then(({ getStore }) => purgeExpiredCheckins(getStore())).catch(() => {}) }, [staff])
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); addEventListener('online', on); addEventListener('offline', off); return () => { removeEventListener('online', on); removeEventListener('offline', off) } }, [])

  useEffect(() => { setTrackContext({ mode: settings.mode, off: settings.analyticsOff, role: profile.role ?? 'visitor' }) }, [settings.mode, settings.analyticsOff, profile.role])
  useEffect(() => { track('screen_view', { path: loc.pathname }) }, [loc.pathname])

  // A browser that still holds the first (timetable) version of the demo data would break the new loop model.
  // On the local store that data is only demo data, so replace it automatically. (On Firestore an admin reloads the demo campus.)
  const legacy = campus.ready && isLegacyCampus(campus.buildings)
  useEffect(() => {
    if (!legacy) return
    import('@/firebase/store').then(({ getStore }) => { const s = getStore(); if (s.mode === 'memory') void seedDemo(s) })
  }, [legacy])
  return !online ? <div role="alert" className="bg-bad/15 text-ink text-sm px-4 py-1.5 text-center font-medium">{t('You are offline. Check-ins are saved on this phone and will send when you reconnect.')}</div> : null
}

function ModeBanners() {
  const t = useT()
  const s = useSettings()
  const { mode, fallbackReason } = useStoreMode()
  return (
    <>
      {fallbackReason && <div className="bg-warn/15 text-ink text-sm px-4 py-1.5 text-center" role="status">{t('Offline demo mode: data stays on this device.')} <span className="opacity-70">{fallbackReason}</span></div>}
      {!fallbackReason && mode === 'memory' && <div className="bg-info/10 text-ink text-sm px-4 py-1 text-center" role="status">{t('Running without a server: data is shared between tabs on this device only.')}</div>}
      {s.mode === 'demo' && <div className="bg-warn/10 text-ink text-xs px-4 py-1 text-center font-medium">{t('Demo mode: everything you see is simulated and excluded from real results.')}</div>}
      {!clock.isReal() && <div className="bg-info/10 text-ink text-xs px-4 py-1 text-center font-medium num">{t('Demo clock is on: the app thinks it is a different time.')}</div>}
    </>
  )
}

export function App() {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => { initStore().then(() => setReady(true)).catch(e => setFailed(String(e))) }, [])
  if (failed) return <div className="p-6">Could not start: {failed}</div>
  if (!ready) return <div className="min-h-dvh grid place-items-center"><Spinner label="Starting ShuttleSync" /></div>
  return (
    <ToastProvider>
      <AppEffects />
      <ModeBanners />
      <ErrorBoundary>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/start" element={<RolePicker />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/results" element={<Results />} />
            <Route path="/changelog" element={<Changelog />} />
          </Route>
          <Route path="/student/*" element={<StudentApp />} />
          <Route path="/bus" element={<BusDevice />} />
          <Route path="/kiosk" element={<Kiosk />} />
          <Route element={<StaffLayout />}>
            <Route path="/teacher" element={<Dashboard />} />
            <Route path="/teacher/classes" element={<Classes />} />
            <Route path="/teacher/bus/:busId" element={<BusDetail />} />
            <Route path="/teacher/reports" element={<Reports />} />
            <Route path="/admin" element={<Setup />} />
            <Route path="/demo" element={<DemoPanel />} />
            <Route path="/test" element={<TestMode />} />
            <Route path="/baseline" element={<Baseline />} />
          </Route>
          <Route path="/pitch" element={<Pitch />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
      <FeedbackWidget />
    </ToastProvider>
  )
}
