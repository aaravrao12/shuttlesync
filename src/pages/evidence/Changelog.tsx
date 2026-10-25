import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { EmptyState, Field, Panel, Sheet, TextInput } from '@/components/ui/Primitives'
import { useCollection } from '@/firebase/hooks'
import { getStore } from '@/firebase/store'
import { schoolDate } from '@/lib/time'
import { useStaffUnlocked } from '@/app/session'
import { useToast } from '@/app/Toast'
import { useT } from '@/i18n'
import type { ChangelogEntry, UsabilityTest } from '@/types'

/** Timeline of "users said X → we changed Y → result after". The proof that testing changed the product. */
export default function Changelog() {
  const t = useT()
  const toast = useToast()
  const staff = useStaffUnlocked()
  const { rows } = useCollection<ChangelogEntry>('changelog')
  const { rows: tests } = useCollection<UsabilityTest>('usabilityTests')
  const [open, setOpen] = useState(false)
  const [d, setD] = useState({ date: schoolDate(new Date()), observation: '', change: '', resultAfter: '' })
  const [linked, setLinked] = useState<string[]>([])
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date))
  const failed = tests.filter(x => !x.success)

  async function save() {
    await getStore().add('changelog', { ...d, linkedTestIds: linked })
    setOpen(false); setD({ ...d, observation: '', change: '', resultAfter: '' }); setLinked([]); toast(t('Saved'))
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div><h1 className="text-6xl font-extrabold leading-[.9]">{t('Changelog')}</h1><p className="text-mute mt-2">{t('Every change we made because of what users said or did.')}</p></div>
        {staff && <Button icon="plus" onClick={() => setOpen(true)} data-testid="cl-add">{t('Add a change')}</Button>}
      </div>
      {sorted.length === 0 ? <EmptyState icon="layers" title={t('No changes logged yet')} body={t('After each round of testing, record what users said, what you changed, and what happened next.')} /> : (
        <ol className="relative border-l-4 border-line pl-6 space-y-6">
          {sorted.map(c => (
            <li key={c.id} className="relative">
              <span className="absolute -left-[34px] top-1 h-4 w-4 rounded-full bg-brand border-4 border-ground" aria-hidden />
              <div className="text-sm text-mute num">{c.date}</div>
              <Panel className="p-4 mt-1 space-y-1.5">
                <p><b>{t('Users said:')}</b> {c.observation}</p>
                <p><b>{t('We changed:')}</b> {c.change}</p>
                <p><b>{t('Result after:')}</b> {c.resultAfter || <span className="text-warn">{t('[REPLACE WITH RESULT]')}</span>}</p>
                {c.linkedTestIds?.length > 0 && <p className="text-xs text-mute">{t('Linked to {n} usability test results.', { n: c.linkedTestIds.length })}</p>}
              </Panel>
            </li>
          ))}
        </ol>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Add a change')}>
        <div className="space-y-3">
          <Field label={t('Date')}><TextInput value={d.date} onChange={e => setD({ ...d, date: e.target.value })} /></Field>
          <Field label={t('What users said or did')}><TextInput value={d.observation} onChange={e => setD({ ...d, observation: e.target.value })} data-testid="cl-obs" /></Field>
          <Field label={t('What we changed')}><TextInput value={d.change} onChange={e => setD({ ...d, change: e.target.value })} data-testid="cl-change" /></Field>
          <Field label={t('Result after (numbers if you have them)')}><TextInput value={d.resultAfter} onChange={e => setD({ ...d, resultAfter: e.target.value })} /></Field>
          {failed.length > 0 && <details><summary className="cursor-pointer text-sm font-bold min-h-[44px] flex items-center">{t('Link failed test tasks ({n})', { n: failed.length })}</summary><ul className="text-sm space-y-1">{failed.map(f => <li key={f.id}><label className="flex gap-2"><input type="checkbox" checked={linked.includes(f.id)} onChange={e => setLinked(e.target.checked ? [...linked, f.id] : linked.filter(x => x !== f.id))} />{f.participantCode} r{f.round}: {f.task}</label></li>)}</ul></details>}
          <Button full disabled={!d.observation || !d.change} onClick={save} data-testid="cl-save">{t('Save change')}</Button>
        </div>
      </Sheet>
    </div>
  )
}
