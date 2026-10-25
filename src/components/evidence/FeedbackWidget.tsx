import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { Field, Sheet } from '@/components/ui/Primitives'
import { getStore } from '@/firebase/store'
import { useSettings } from '@/firebase/hooks'
import { useProfile } from '@/app/session'
import { track } from '@/evidence/track'
import { useToast } from '@/app/Toast'
import { useT } from '@/i18n'

function Scale({ value, onChange, label, low, high }: { value: number; onChange: (n: number) => void; label: string; low: string; high: string }) {
  return (
    <fieldset>
      <legend className="text-sm font-bold mb-1">{label}</legend>
      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange(n)}
            className={`h-11 flex-1 rounded-sign border font-display text-2xl font-bold ${value === n ? 'bg-brand text-brand-ink border-brand' : 'bg-panel border-line'}`}>{n}</button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-mute mt-1"><span>{low}</span><span>{high}</span></div>
    </fieldset>
  )
}

/** Floating feedback button on every screen: ease 1–5, would-use 1–5, one text box. Auto-tags the screen. */
export function FeedbackWidget() {
  const t = useT()
  const loc = useLocation()
  const profile = useProfile()
  const settings = useSettings()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [ease, setEase] = useState(0)
  const [use, setUse] = useState(0)
  const [text, setText] = useState('')
  if (loc.pathname.startsWith('/pitch')) return null

  async function send() {
    await getStore().add('feedback', {
      role: profile.role ?? 'visitor', rating: ease, easeScore: ease, wouldUse: use, text: text.trim(),
      screen: loc.pathname, createdAt: Date.now(), isPilot: settings.mode === 'pilot', isSimulated: settings.mode !== 'pilot',
    })
    track('feedback_open', { sent: true })
    toast(t('Feedback sent'))
    setOpen(false); setEase(0); setUse(0); setText('')
  }

  return (
    <>
      <button onClick={() => setOpen(true)} data-testid="feedback-open" aria-label={t('Give feedback')}
        className="no-print fixed z-40 right-3 bottom-24 sm:bottom-5 h-12 px-4 rounded-pill bg-ink text-ground font-bold shadow-lg flex items-center gap-2 text-sm">
        <Icon name="message" size={18} /><span className="hidden sm:inline">{t('Feedback')}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('How did that go?')}>
        <div className="space-y-4">
          <Scale value={ease} onChange={setEase} label={t('How easy was this screen?')} low={t('Hard')} high={t('Easy')} />
          <Scale value={use} onChange={setUse} label={t('Would you use ShuttleSync?')} low={t('No way')} high={t('Every day')} />
          <Field label={t('One thing we should change')}>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={3} className="w-full rounded-sign border border-line bg-panel p-3" placeholder={t('Optional. Please do not include your name.')} />
          </Field>
          <Button full disabled={!ease} onClick={send} data-testid="feedback-send">{t('Send feedback')}</Button>
        </div>
      </Sheet>
    </>
  )
}
