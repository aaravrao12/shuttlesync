import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Banner, Field, Panel, Select, TextInput } from '@/components/ui/Primitives'
import { useCollection } from '@/firebase/hooks'
import { getStore } from '@/firebase/store'
import { schoolDate } from '@/lib/time'
import { useToast } from '@/app/Toast'
import { useT } from '@/i18n'
import type { BaselineEntry } from '@/types'

const KNOWN: [string, string, BaselineEntry['source']][] = [
  ['survey_responses', 'Survey: number of responses', 'survey'],
  ['tardy_from_shuttle_pct', 'Survey: % marked tardy because of a late shuttle', 'survey'],
  ['late_bus_per_month', 'Survey: late-bus tardies per month (average)', 'survey'],
  ['would_scan_pct', 'Survey: % who would scan a QR code', 'survey'],
  ['prefers_spanish_pct', 'Survey: % who prefer Spanish', 'survey'],
  ['quote', 'Interview quote (with permission)', 'interview'],
  ['story', 'One real student moment for the pitch (anonymized, with permission)', 'interview'],
]

/** Evidence lead's data-entry page: survey results, interview quotes, ride-along delays. Feeds the Results page. */
export default function Baseline() {
  const t = useT()
  const toast = useToast()
  const { rows } = useCollection<BaselineEntry>('baseline')
  const [metric, setMetric] = useState(KNOWN[0][0])
  const [value, setValue] = useState('')
  const [n, setN] = useState('')
  const [notes, setNotes] = useState('')
  const [ride, setRide] = useState({ bus: '', left: '', arrived: '' })
  const [csv, setCsv] = useState('')
  const today = schoolDate(new Date())

  async function add() {
    const known = KNOWN.find(k => k[0] === metric)!
    const isQuote = metric === 'quote' || metric === 'story'
    await getStore().add('baseline', { source: known[2], metric, value: isQuote ? value.trim() : Number(value), n: Number(n) || 1, notes, date: today })
    setValue(''); setN(''); setNotes(''); toast(t('Saved'))
  }
  async function addRide() {
    const [sh, sm] = ride.left.split(':').map(Number); const [ah, am] = ride.arrived.split(':').map(Number)
    if ([sh, sm, ah, am].some(isNaN) || ah * 60 + am <= sh * 60 + sm) return
    // the real ride time: from leaving one loop to reaching the other (no timetable to compare against)
    await getStore().add('baseline', { source: 'ride_along', metric: 'ride_min', value: ah * 60 + am - (sh * 60 + sm), n: 1, notes: `Shuttle ${ride.bus}`, date: today })
    setRide({ bus: ride.bus, left: '', arrived: '' }); toast(t('Saved'))
  }
  async function importCsv() {
    // columns: source,metric,value,n,notes,date
    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean)
    for (const l of lines) {
      const [source, m, v, nn, nt, d] = l.split(',').map(x => x.trim())
      if (!['survey', 'ride_along', 'interview'].includes(source) || !m) continue
      await getStore().add('baseline', { source, metric: m, value: isNaN(Number(v)) ? v : Number(v), n: Number(nn) || 1, notes: nt ?? '', date: d || today })
    }
    setCsv(''); toast(t('Imported'))
  }

  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-5xl font-extrabold leading-[.95]">{t('Baseline data')}</h1>
      <Banner tone="info" icon="file">{t('Type in the real survey results, interview quotes and ride-along delays. The Results page and pitch use only what you enter here. Nothing is made up.')}</Banner>

      <Panel className="p-4 space-y-3">
        <h2 className="text-3xl font-bold">{t('Add a result')}</h2>
        <div className="grid sm:grid-cols-[2fr_1fr_1fr] gap-3">
          <Field label={t('What was measured')}><Select value={metric} onChange={e => setMetric(e.target.value)} data-testid="bl-metric">{KNOWN.map(k => <option key={k[0]} value={k[0]}>{t(k[1])}</option>)}</Select></Field>
          <Field label={metric === 'quote' || metric === 'story' ? t('The text') : t('Value')}><TextInput value={value} onChange={e => setValue(e.target.value)} inputMode={metric === 'quote' || metric === 'story' ? 'text' : 'decimal'} data-testid="bl-value" /></Field>
          <Field label={t('Sample size (n)')}><TextInput value={n} onChange={e => setN(e.target.value)} inputMode="numeric" data-testid="bl-n" /></Field>
        </div>
        <Field label={metric === 'quote' ? t('Who said it (role only, e.g. "9th grade student")') : t('Notes')}><TextInput value={notes} onChange={e => setNotes(e.target.value)} /></Field>
        <Button disabled={!value.trim()} onClick={add} data-testid="bl-add">{t('Save result')}</Button>
      </Panel>

      <Panel className="p-4 space-y-3">
        <h2 className="text-3xl font-bold">{t('Ride-along log')}</h2>
        <p className="text-sm text-mute">{t('One row per ride you timed. Enter when the shuttle left one loop and when it reached the other; the ride time is the difference.')}</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label={t('Shuttle number')}><TextInput value={ride.bus} onChange={e => setRide({ ...ride, bus: e.target.value })} /></Field>
          <Field label={t('Left the loop (24h, 09:12)')}><TextInput value={ride.left} onChange={e => setRide({ ...ride, left: e.target.value })} placeholder="09:12" /></Field>
          <Field label={t('Reached the other loop (24h)')}><TextInput value={ride.arrived} onChange={e => setRide({ ...ride, arrived: e.target.value })} placeholder="09:17" /></Field>
        </div>
        <Button variant="outline" onClick={addRide}>{t('Add ride')}</Button>
      </Panel>

      <Panel className="p-4 space-y-3">
        <h2 className="text-3xl font-bold">{t('Paste CSV')}</h2>
        <p className="text-sm text-mute">source,metric,value,n,notes,date — {t('for example')}: <code className="break-all">survey,tardy_from_shuttle_pct,31,64,,2026-02-02</code></p>
        <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={4} className="w-full rounded-sign border border-line bg-panel p-3 font-mono text-sm" aria-label="CSV" />
        <Button variant="outline" disabled={!csv.trim()} onClick={importCsv}>{t('Import rows')}</Button>
      </Panel>

      <Panel className="p-4">
        <h2 className="text-3xl font-bold mb-2">{t('Entered so far')} <span className="text-mute num text-xl">{rows.length}</span></h2>
        {rows.length === 0 ? <p className="text-mute">{t('Nothing yet. The Results page shows placeholders until you add data.')}</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-mute"><th className="py-1">{t('Source')}</th><th>{t('Measure')}</th><th>{t('Value')}</th><th>n</th><th>{t('Date')}</th><th /></tr></thead>
            <tbody>{[...rows].sort((a, b) => b.date.localeCompare(a.date)).map(r => <tr key={r.id} className="border-t border-line"><td className="py-1.5">{r.source.replace('_', '-')}</td><td>{r.metric}</td><td className="max-w-xs truncate">{String(r.value)}</td><td className="num">{r.n}</td><td className="num">{r.date}</td><td><Button size="sm" variant="ghost" aria-label={t('Delete')} icon="trash" onClick={() => getStore().remove('baseline', r.id)} /></td></tr>)}</tbody></table></div>
        )}
      </Panel>
    </div>
  )
}
