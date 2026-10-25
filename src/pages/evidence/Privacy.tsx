import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { Panel } from '@/components/ui/Primitives'
import { useT } from '@/i18n'

export default function Privacy() {
  const t = useT()
  const rows = [
    { icon: 'bus', h: 'Buses are tracked. People are not.', b: 'A passenger phone on each bus shares the bus location while it runs. We never follow students around campus.' },
    { icon: 'pin', h: 'Your location is read once.', b: 'When you scan the bus code, your phone shares one location reading so we can check you are near the bus. It is not stored as a trail. If you say no, you can still check in and your teacher confirms.' },
    { icon: 'shield', h: 'Unverified is not guilty.', b: 'If a check fails, the screen says "unverified" and your teacher decides. Nobody is marked tardy or absent by the app alone.' },
    { icon: 'users', h: 'Who can see your data.', b: 'You see your own check-ins. Your teachers and the school office see check-ins for their classes. Nobody else.' },
    { icon: 'clock', h: 'How long we keep it.', b: 'Check-ins and the location reading attached to them are deleted after 30 days. You can delete yours any time in Settings.' },
    { icon: 'spark', h: 'AI, and what it sees.', b: 'If you choose to photograph your schedule, the photo is sent once to an AI service to read the text. Teachers get a written summary, but AI never decides attendance, and student names are not sent for that summary.' },
    { icon: 'lock', h: 'Not sold, not reused.', b: 'Nothing is sold or used for anything other than getting students to class on time.' },
    { icon: 'file', h: 'School approval.', b: 'The pilot runs only with written approval from school staff. ShuttleSync is designed with student-records privacy rules (FERPA) in mind.' },
  ]
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <h1 className="text-6xl font-extrabold leading-[.9]">{t('Privacy')}</h1>
      <p className="text-xl text-mute">{t('The short version: we track buses, not people.')}</p>
      <div className="grid gap-3">
        {rows.map(r => (
          <Panel key={r.h} className="p-4 flex gap-4"><span className="grid place-items-center h-10 w-10 rounded-full bg-raised text-brand shrink-0"><Icon name={r.icon} /></span><div><h2 className="text-3xl font-bold leading-none">{t(r.h)}</h2><p className="mt-1.5">{t(r.b)}</p></div></Panel>
        ))}
      </div>
      <p className="text-mute">{t('Questions or want your data removed? Ask your sponsor teacher or the front office.')} <Link to="/how-it-works" className="underline">{t('How it works')}</Link></p>
    </div>
  )
}
