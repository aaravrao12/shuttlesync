import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Logo, Panel } from '@/components/ui/Primitives'
import { giveConsent } from '@/app/session'
import { track } from '@/evidence/track'
import { useT } from '@/i18n'
import { PrefsMenu } from '@/app/Layouts'

/** First-use consent in plain language (EN/ES). Short on purpose: students actually read short. */
export default function Consent() {
  const t = useT()
  const points = [
    { icon: 'bus', text: t('We track the buses, not you.') },
    { icon: 'pin', text: t('Your phone location is read once, only at the moment you scan, to check you are on the bus.') },
    { icon: 'shield', text: t('If the check fails you are never in trouble. It just says "unverified" and your teacher decides.') },
    { icon: 'users', text: t('Only your teachers and the school office see your check-ins. They are deleted after 30 days.') },
    { icon: 'spark', text: t('AI only reads a photo of your schedule if you choose to take one. It never decides attendance.') },
  ]
  return (
    <div className="min-h-dvh grid place-items-center p-4">
      <Panel className="w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between"><Logo /><PrefsMenu /></div>
        <h1 className="text-5xl font-extrabold leading-[.95]">{t('Before you start')}</h1>
        <ul className="space-y-3">
          {points.map(p => (
            <li key={p.text} className="flex gap-3"><span className="mt-0.5 grid place-items-center h-8 w-8 rounded-full bg-raised text-brand shrink-0"><Icon name={p.icon} size={16} /></span><span>{p.text}</span></li>
          ))}
        </ul>
        <p className="text-sm text-mute">{t('Your school approved this pilot in writing. Questions? Ask your sponsor teacher.')} <Link to="/privacy" className="underline">{t('Read the full privacy page')}</Link></p>
        <Button full size="lg" data-testid="consent-accept" onClick={() => { giveConsent(); track('consent_given') }}>{t('I understand, continue')}</Button>
      </Panel>
    </div>
  )
}
