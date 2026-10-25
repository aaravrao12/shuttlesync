import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { type ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Logo } from '@/components/ui/Primitives'
import { Button } from '@/components/ui/Button'
import { prefs, signOut, usePrefs, useProfile, useStaffUnlocked } from './session'
import { useT } from '@/i18n'
import { StaffGate } from '@/pages/auth/StaffGate'

/** Light/dark + EN/ES toggles, shared by every layout. */
export function PrefsMenu() {
  const t = useT()
  usePrefs()
  const dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches)
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" className="!px-2" aria-label={t('Switch theme')} onClick={() => prefs.setTheme(dark ? 'light' : 'dark')}><Icon name={dark ? 'sun' : 'moon'} /></Button>
      <Button variant="ghost" size="sm" className="!px-2" aria-label={`${prefs.lang() === 'en' ? 'ES' : 'EN'}: ${t('Switch language')}`} onClick={() => prefs.setLang(prefs.lang() === 'en' ? 'es' : 'en')}>
        <Icon name="lang" /><span className="font-bold">{prefs.lang() === 'en' ? 'ES' : 'EN'}</span>
      </Button>
    </div>
  )
}

export function PublicLayout() {
  const t = useT()
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur bg-ground/85 border-b border-line safe-top">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-2">
          <Link to="/" aria-label="ShuttleSync home"><Logo className="max-sm:!text-xl" /></Link>
          <nav className="hidden md:flex items-center gap-1 text-sm font-bold" aria-label="Main">
            <NavLink to="/how-it-works" className="px-3 py-2 rounded-sign hover:bg-raised">{t('How it works')}</NavLink>
            <NavLink to="/results" className="px-3 py-2 rounded-sign hover:bg-raised">{t('Results')}</NavLink>
            <NavLink to="/privacy" className="px-3 py-2 rounded-sign hover:bg-raised">{t('Privacy')}</NavLink>
          </nav>
          <div className="flex items-center gap-1">
            <PrefsMenu />
            <Link to="/start" aria-label={t('Open the app')}><Button size="sm" aria-label={t('Open the app')}><span className="max-sm:hidden">{t('Open the app')}</span><Icon name="arrow" className="sm:hidden" /></Button></Link>
          </div>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-line mt-16 py-8 text-sm text-mute">
        <div className="mx-auto max-w-6xl px-4 flex flex-wrap gap-x-6 gap-y-2 justify-between">
          <span>{t('Built at Plano Senior High School, designed for any school.')}</span>
          <span className="flex gap-4"><Link to="/privacy" className="underline">{t('Privacy')}</Link><Link to="/how-it-works" className="underline">{t('How it works')}</Link><Link to="/changelog" className="underline">{t('Changelog')}</Link></span>
        </div>
      </footer>
    </div>
  )
}

interface NavItem { to: string; label: string; icon: string }

export const STAFF_NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Teacher', items: [{ to: '/teacher', label: 'Live dashboard', icon: 'map' }, { to: '/teacher/classes', label: 'My classes', icon: 'users' }, { to: '/teacher/reports', label: 'Reports', icon: 'chart' }] },
  { group: 'Setup', items: [{ to: '/admin', label: 'School setup', icon: 'settings' }, { to: '/demo', label: 'Demo control', icon: 'flask' }] },
  { group: 'Evidence', items: [{ to: '/test', label: 'Test mode', icon: 'clipboard' }, { to: '/baseline', label: 'Baseline data', icon: 'file' }, { to: '/results', label: 'Results', icon: 'chart' }, { to: '/changelog', label: 'Changelog', icon: 'layers' }] },
]

/** Desktop-first shell for teachers, admins and the team. Locked behind the staff PIN. */
export function StaffLayout(): ReactNode {
  const t = useT()
  const unlocked = useStaffUnlocked()
  const profile = useProfile()
  const nav = useNavigate()
  if (!unlocked) return <StaffGate />
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="no-print lg:sticky lg:top-0 lg:h-dvh border-b lg:border-b-0 lg:border-r border-line bg-panel p-3 lg:p-4 flex lg:flex-col gap-3 lg:gap-6 overflow-x-auto">
        <Link to="/" className="shrink-0 self-center lg:self-start"><Logo /></Link>
        <nav aria-label="Staff" className="flex lg:flex-col gap-1 lg:gap-4 lg:flex-1">
          {STAFF_NAV.map(g => (
            <div key={g.group} className="flex lg:flex-col gap-1">
              <div className="hidden lg:block text-xs font-bold text-mute px-2 mb-1">{t(g.group)}</div>
              {g.items.map(i => (
                <NavLink key={i.to} to={i.to} end className={({ isActive }) => `flex items-center gap-2 px-3 min-h-[40px] rounded-sign text-sm font-bold whitespace-nowrap ${isActive ? 'bg-brand text-brand-ink' : 'hover:bg-raised'}`}>
                  <Icon name={i.icon} size={16} className="shrink-0" /><span className="leading-tight">{t(i.label)}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="hidden lg:flex flex-col gap-2">
          <PrefsMenu />
          <Link to="/pitch" className="text-sm font-bold flex items-center gap-2 px-3 min-h-[40px] rounded-sign hover:bg-raised"><Icon name="slides" size={16} />{t('Pitch mode')}</Link>
          <Button variant="outline" size="sm" icon="log-out" onClick={() => { signOut(); nav('/') }}>{profile.name ? t('Sign out {name}', { name: profile.name }) : t('Sign out')}</Button>
        </div>
      </aside>
      <main className="min-w-0 p-4 lg:p-6"><Outlet /></main>
    </div>
  )
}
