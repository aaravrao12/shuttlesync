import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field, Panel, TextInput, Banner, Logo } from '@/components/ui/Primitives'
import { unlockStaff } from '@/app/session'
import { useT } from '@/i18n'

/** Staff PIN gate. Honest about what it is: a speed bump for the pilot, not security (rules enforce real access). */
export function StaffGate() {
  const t = useT()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  return (
    <div className="min-h-dvh grid place-items-center p-4">
      <Panel className="w-full max-w-sm p-6 space-y-4">
        <Logo />
        <h1 className="text-4xl font-extrabold leading-none">{t('Staff sign-in')}</h1>
        <p className="text-mute">{t('Enter the staff PIN your sponsor teacher gave you. Teachers, the front office and the project team use this.')}</p>
        <form onSubmit={e => { e.preventDefault(); setErr(!unlockStaff(pin)) }} className="space-y-3">
          <Field label={t('Staff PIN')}>
            <TextInput autoFocus type="password" value={pin} onChange={e => { setPin(e.target.value); setErr(false) }} autoComplete="off" data-testid="staff-pin" />
          </Field>
          {err && <Banner tone="bad">{t('That PIN is not right. Check with your sponsor teacher.')}</Banner>}
          <Button full type="submit" data-testid="staff-unlock">{t('Unlock')}</Button>
        </form>
        <Link to="/start" className="text-sm underline text-mute">{t('Back')}</Link>
      </Panel>
    </div>
  )
}
