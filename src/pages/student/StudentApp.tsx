import { NavLink, Navigate, Route, Routes, Outlet, Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { Logo } from '@/components/ui/Primitives'
import { SimulatedTag } from '@/components/ui/StatusChip'
import { useConsent, useProfile } from '@/app/session'
import { useCampus, useDocument } from '@/firebase/hooks'
import type { Student } from '@/types'
import { useT } from '@/i18n'
import { PrefsMenu } from '@/app/Layouts'
import Consent from './Consent'
import Today from './Today'
import Scan from './Scan'
import MyBus from './MyBus'
import Onboarding from './Onboarding'
import StudentSettings from './StudentSettings'
import Ask from './Ask'

function StudentShell() {
  const t = useT()
  const profile = useProfile()
  const student = useDocument<Student>('students', profile.studentId)
  const tabs = [
    { to: '/student', label: t('Today'), icon: 'home', end: true },
    { to: '/student/scan', label: t('Check in'), icon: 'scan' },
    { to: '/student/bus', label: t('Shuttles'), icon: 'bus' },
    { to: '/student/ask', label: t('Ask'), icon: 'spark' },
    { to: '/student/settings', label: t('Settings'), icon: 'settings' },
  ]
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="safe-top sticky top-0 z-30 bg-ground/90 backdrop-blur border-b border-line">
        <div className="mx-auto max-w-xl px-4 h-14 flex items-center justify-between">
          <Link to="/" aria-label="ShuttleSync home"><Logo className="text-xl" /></Link>
          <div className="flex items-center gap-0.5">{student?.isSimulated && <SimulatedTag />}<PrefsMenu /></div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-xl px-4 py-5 pb-28"><Outlet /></main>
      <nav aria-label={t('Student')} className="no-print fixed bottom-0 inset-x-0 z-30 bg-panel border-t border-line safe-bottom">
        <ul className="mx-auto max-w-xl grid grid-cols-5">
          {tabs.map(tb => (
            <li key={tb.to}>
              <NavLink to={tb.to} end={tb.end} className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-xs font-bold ${isActive ? 'text-brand' : 'text-mute'}`}>
                <Icon name={tb.icon} size={22} />{tb.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export default function StudentApp() {
  const consent = useConsent()
  const profile = useProfile()
  const campus = useCampus()
  if (!consent) return <Consent />
  const needsOnboarding = !profile.studentId
  return (
    <Routes>
      <Route path="onboarding" element={<Onboarding />} />
      <Route element={needsOnboarding && campus.ready ? <Navigate to="/student/onboarding" replace /> : <StudentShell />}>
        <Route index element={<Today />} />
        <Route path="scan" element={<Scan />} />
        <Route path="bus" element={<MyBus />} />
        <Route path="ask" element={<Ask />} />
        <Route path="settings" element={<StudentSettings />} />
      </Route>
    </Routes>
  )
}
