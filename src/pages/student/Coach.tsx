import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { markCoach } from '@/app/session'
import { useT } from '@/i18n'

/** Three first-run tips, max. A brand-new user should never need help; these are the only three things to know. */
export function Coach({ onDone }: { onDone: () => void }) {
  const t = useT()
  const [i, setI] = useState(0)
  const steps = [
    { title: t('This is your next move'), body: t('The yellow sign says whether you need the shuttle and whether you will make it to class on time.') },
    { title: t('Check in when you board'), body: t('Tap the black button and scan the code on the shuttle screen. It takes about five seconds.') },
    { title: t('Slow shuttle? You are covered'), body: t('If you checked in and the ride takes longer than normal, you are excused automatically.') },
  ]
  const s = steps[i]
  const finish = () => { markCoach('today'); onDone() }
  return (
    <AnimatePresence>
      <motion.div key={i} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed z-[45] inset-x-4 bottom-24 mx-auto max-w-md bg-ink text-ground rounded-sign p-4 shadow-xl" role="dialog" aria-label={s.title}>
        <div className="text-xs font-bold opacity-70">{t('Tip {i} of {n}', { i: i + 1, n: steps.length })}</div>
        <div className="font-display text-3xl font-bold leading-none mt-1">{s.title}</div>
        <p className="mt-1 opacity-90">{s.body}</p>
        <div className="flex justify-between mt-3">
          <button className="text-sm underline opacity-80" onClick={finish}>{t('Skip')}</button>
          <Button size="sm" variant="sign" onClick={() => (i < steps.length - 1 ? setI(i + 1) : finish())} data-testid="coach-next">{i < steps.length - 1 ? t('Next') : t('Got it')}</Button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
