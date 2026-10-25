import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Primitives'
import { SimulatedTag } from '@/components/ui/StatusChip'
import { setProfile } from '@/app/session'
import { useCampus, usePeople } from '@/firebase/hooks'
import { getStore } from '@/firebase/store'
import { seedDemo } from '@/firebase/seed'
import { clock } from '@/lib/clock'
import { useToast } from '@/app/Toast'
import { useT } from '@/i18n'

interface Card { role: string; title: string; body: string; to: string; icon: string; staff?: boolean }

export default function RolePicker() {
  const t = useT()
  const nav = useNavigate()
  const toast = useToast()
  const campus = useCampus()
  const { students, teachers } = usePeople()
  const demoStudents = students.filter(s => s.isSimulated)

  const cards: Card[] = [
    { role: 'student', title: t('I\'m a student'), body: t('See if you need the shuttle, whether you will make it, and check in when you board.'), to: '/student', icon: 'phone' },
    { role: 'teacher', title: t('I\'m a teacher'), body: t('Watch the shuttles live and see who is on the way.'), to: '/teacher', icon: 'teacher', staff: true },
    { role: 'bus', title: t('Shuttle phone'), body: t('A passenger shares the shuttle location. Not for the driver.'), to: '/bus', icon: 'bus' },
    { role: 'kiosk', title: t('Stop kiosk'), body: t('Check in students who have no phone.'), to: '/kiosk', icon: 'tablet' },
    { role: 'admin', title: t('Admin or project team'), body: t('Set up stops and shuttle rules, run tests, see results.'), to: '/admin', icon: 'settings', staff: true },
  ]

  async function loadDemo() {
    await seedDemo(getStore(), clock.date())
    toast(t('Demo campus loaded'))
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <h1 className="text-5xl sm:text-7xl font-extrabold leading-[.95] max-w-2xl">{t('Who is using this device?')}</h1>
      <p className="mt-3 text-mute max-w-prose">{t('Pick your role. You do not need an account.')}</p>

      {campus.empty && (
        <div className="mt-6">
          <Banner tone="info" action={<Button size="sm" onClick={loadDemo} data-testid="load-demo">{t('Load demo campus')}</Button>}>
            {t('No campus is set up yet. Load the simulated demo campus, or set up your own school in Admin.')}
          </Banner>
        </div>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <motion.div key={c.role} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={c.to} onClick={() => { if (c.role !== 'student') setProfile({ role: c.role as any }) }}
              className="group block h-full bg-panel border border-line rounded-sign p-5 hover:border-brand transition" data-testid={`role-${c.role}`}>
              <span className="grid place-items-center h-11 w-11 rounded-[6px] bg-brand text-brand-ink mb-4"><Icon name={c.icon} size={22} /></span>
              <h2 className="text-3xl font-bold leading-none">{c.title}</h2>
              <p className="text-mute mt-2">{c.body}</p>
              {c.staff && <p className="mt-3 text-xs font-bold flex items-center gap-1 text-mute"><Icon name="lock" size={12} />{t('Needs the staff PIN')}</p>}
            </Link>
          </motion.div>
        ))}
      </div>

      {demoStudents.length > 0 && (
        <section className="mt-10 border-t border-line pt-6">
          <div className="flex items-center gap-2 mb-1"><h2 className="text-3xl font-bold">{t('Try it as a simulated student')}</h2><SimulatedTag /></div>
          <p className="text-mute mb-3 max-w-prose">{t('These students are made up. Pick one to see the app exactly as they would.')}</p>
          <div className="flex flex-wrap gap-2">
            {demoStudents.map(s => (
              <Button key={s.id} variant="outline" size="sm" data-testid={`demo-student-${s.code}`}
                onClick={() => { setProfile({ role: 'student', studentId: s.id, name: s.name }); nav('/student') }}>{s.name}</Button>
            ))}
          </div>
        </section>
      )}
      {teachers.length === 0 && students.length === 0 && !campus.empty && null}
    </div>
  )
}
