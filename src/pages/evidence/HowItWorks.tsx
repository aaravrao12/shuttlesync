import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { Panel } from '@/components/ui/Primitives'
import { StatusChip } from '@/components/ui/StatusChip'
import { STATUS_META } from '@/lib/studentStatus'
import { useT } from '@/i18n'
import type { LiveStatus } from '@/types'

const WHEN: Record<LiveStatus, string> = {
  no_shuttle: 'Your next class is in the same area (A, D and E are connected inside), or in the same building.',
  waiting: 'You have not checked in yet, and the bell for your next class has not rung.',
  on_the_way: 'You checked in, your location matched the shuttle, and your ride is within a normal time.',
  excused_bus_late: 'You checked in, your location matched, and your ride took longer than normal, or the shuttle reaches the other end after the bell.',
  unverified: 'You checked in, but the location check could not confirm it (no GPS, shuttle phone offline, or far away). Your teacher decides.',
  not_checked_in: 'You did not check in, and the bell for your next class has rung. Your teacher decides.',
  arrived: 'You checked in and the shuttle reached the other end in a normal time.',
}

/** Plain-language explainer for judges and new users. The diagram shows the single path every check-in takes. */
export default function HowItWorks() {
  const t = useT()
  const steps = [
    { icon: 'qr', h: 'Scan', b: 'The student scans the QR on the shuttle phone. The code changes every minute, so a screenshot goes stale.' },
    { icon: 'shield', h: 'Verify', b: 'Three checks: the code is for this shuttle and is current, the student\'s phone is near the shuttle phone, and the shuttle location is fresh.' },
    { icon: 'users', h: 'Roster', b: 'The teacher\'s roster updates instantly. Pass = on the way. Fail = "unverified", never an accusation.' },
  ]
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-12">
      <header className="max-w-2xl"><h1 className="text-6xl sm:text-7xl font-extrabold leading-[.9]">{t('How it works')}</h1><p className="mt-3 text-xl text-mute">{t('One path every check-in takes, and what each result means.')}</p></header>

      <section aria-labelledby="flow">
        <h2 id="flow" className="sr-only">{t('The check-in path')}</h2>
        <ol className="grid md:grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch gap-3">
          {steps.flatMap((s, i) => [
            <li key={s.h} className="bg-panel border border-line rounded-sign p-5">
              <span className="grid place-items-center h-11 w-11 rounded-[6px] bg-brand text-brand-ink"><Icon name={s.icon} size={22} /></span>
              <h3 className="text-4xl font-bold mt-3 leading-none">{t(s.h)}</h3><p className="mt-2 text-mute">{t(s.b)}</p>
            </li>,
            i < steps.length - 1 ? <li key={'a' + i} aria-hidden className="hidden md:grid place-items-center text-mute"><Icon name="arrow" size={28} /></li> : null,
          ])}
        </ol>
      </section>

      <section aria-labelledby="statuses" className="grid md:grid-cols-[1fr_1.6fr] gap-8">
        <div><h2 id="statuses" className="text-5xl font-extrabold leading-[.95]">{t('What each status means')}</h2><p className="mt-3 text-mute">{t('Every status has an icon, words and a color, so it never relies on color alone. There is no timetable, so "Not checked in" only appears after the bell for the student\'s next class has rung.')}</p></div>
        <ul className="space-y-3">
          {(Object.keys(STATUS_META) as LiveStatus[]).map(k => <li key={k} className="flex flex-wrap items-start gap-3"><span className="w-56 shrink-0"><StatusChip status={k} /></span><span className="flex-1 min-w-[12rem]">{t(WHEN[k])}</span></li>)}
        </ul>
      </section>

      <section aria-labelledby="rules" className="grid sm:grid-cols-2 gap-4">
        <h2 id="rules" className="sr-only">{t('The rules')}</h2>
        {[
          ['Excused for a slow ride', 'The shuttle has no timetable, so we measure each rider\'s own ride: from their scan to the shuttle reaching the other end. They are excused if it took longer than a normal ride (about 5 minutes) plus a threshold (3 minutes), or if the shuttle arrives after their class bell. Teachers can still decide otherwise. No AI involved.'],
          ['Will I make it?', 'Time until the bell, against the time you need: walk to the stop (or wait for the shuttle, whichever is longer), the normal ride, and the walk to class. Three or more spare minutes is "on track", under three is "cutting it close", below zero is "likely late".'],
          ['Runs and geofences', 'A run is one trip between the A loop and the H loop. It starts when the shuttle leaves a stop\'s circle (about 45 m) and ends when it enters the other stop\'s circle. "Left" only counts after it is 1.5× that far away, so GPS wobble cannot flicker.'],
          ['What AI does', 'It reads a photo of a schedule, and writes one sentence for the teacher. Every number in that sentence is checked against the real count; if one does not match, a plain template is used instead.'],
          ['What teachers decide', 'Everything uncertain. A teacher can mark anyone present, excused, tardy or absent, with a reason, and that choice always wins.'],
        ].map(([h, b]) => <Panel key={h} className="p-5"><h3 className="text-3xl font-bold leading-none">{t(h)}</h3><p className="mt-2">{t(b)}</p></Panel>)}
      </section>
      <p className="text-mute">{t('Want the privacy details?')} <Link className="underline" to="/privacy">{t('Privacy')}</Link></p>
    </div>
  )
}
