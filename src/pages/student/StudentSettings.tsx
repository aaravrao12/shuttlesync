import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Panel, Segmented, Toggle, Banner } from '@/components/ui/Primitives'
import { prefs, signOut, usePrefs, useProfile } from '@/app/session'
import { getStore } from '@/firebase/store'
import { useCollection } from '@/firebase/hooks'
import type { Checkin } from '@/types'
import { useToast } from '@/app/Toast'
import { useT } from '@/i18n'

export default function StudentSettings() {
  const t = useT()
  usePrefs()
  const nav = useNavigate()
  const toast = useToast()
  const profile = useProfile()
  const { rows: checkins } = useCollection<Checkin>('checkins')
  const [notify, setNotify] = useState(() => { try { return localStorage.getItem('ss_notify') === '1' } catch { return false } })

  async function setNotifications(on: boolean) {
    if (on && 'Notification' in window && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission()
      if (p !== 'granted') { toast(t('Notifications are blocked in your browser settings.'), 'warn'); return }
    }
    try { localStorage.setItem('ss_notify', on ? '1' : '0') } catch { /* ignore */ }
    setNotify(on)
  }

  async function deleteMine() {
    const mine = checkins.filter(c => c.studentId === profile.studentId)
    await Promise.all(mine.map(c => getStore().remove('checkins', c.id)))
    toast(t('Deleted {n} check-ins', { n: mine.length }))
  }

  return (
    <div className="space-y-5">
      <h1 className="text-5xl font-extrabold leading-[.95]">{t('Settings')}</h1>
      <Panel className="p-4 divide-y divide-line">
        <div className="py-2"><Toggle checked={notify} onChange={setNotifications} label={t('Remind me when to leave class')} /><p className="text-xs text-mute">{t('Works while the app is open or installed on your home screen.')}</p></div>
        <div className="py-3 flex items-center justify-between gap-3"><span className="font-medium">{t('Language')}</span>
          <Segmented label={t('Language')} value={prefs.lang()} onChange={prefs.setLang} options={[{ value: 'en', label: 'English' }, { value: 'es', label: 'Español' }]} /></div>
        <div className="py-3 flex items-center justify-between gap-3"><span className="font-medium">{t('Theme')}</span>
          <Segmented label={t('Theme')} value={prefs.theme()} onChange={prefs.setTheme} options={[{ value: 'system', label: t('Auto') }, { value: 'light', label: t('Light') }, { value: 'dark', label: t('Dark') }]} /></div>
        <div className="py-2"><Toggle checked={prefs.large()} onChange={prefs.setLarge} label={t('Large text')} /></div>
      </Panel>

      <Panel className="p-4 space-y-3">
        <h2 className="text-3xl font-bold">{t('Your schedule')}</h2>
        <Link to="/student/onboarding"><Button variant="outline">{t('Edit my schedule')}</Button></Link>
      </Panel>

      <Panel className="p-4 space-y-3">
        <h2 className="text-3xl font-bold">{t('Your data')}</h2>
        <p className="text-mute">{t('We only keep your check-ins for 30 days. You can delete them now.')}</p>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={deleteMine}>{t('Delete my check-ins')}</Button><Link to="/privacy"><Button variant="ghost">{t('Privacy page')}</Button></Link></div>
      </Panel>

      <Banner tone="info" icon="shield">{t('Questions about ShuttleSync? Ask your sponsor teacher.')}</Banner>
      <Button variant="outline" full icon="log-out" onClick={() => { signOut(); nav('/') }}>{t('Switch role or sign out')}</Button>
    </div>
  )
}
