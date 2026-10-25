import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Banner, Field, Panel, Select, Segmented, Spinner, TextInput, Toggle } from '@/components/ui/Primitives'
import { BuildingBadge } from '@/components/ui/BuildingBadge'
import { Pill } from '@/components/ui/StatusChip'
import { Icon } from '@/components/ui/Icon'
import { MapView } from '@/components/map/MapView'
import { BusQr } from '@/components/qr/RotatingQr'
import { useCampus, useCollection, usePeople, useRules, useSettings } from '@/firebase/hooks'
import { getStore } from '@/firebase/store'
import { parseEnrollment } from '@/lib/csvImport'
import { fmtClock, parseClock } from '@/lib/time'
import { clock } from '@/lib/clock'
import { purgeExpiredCheckins, RETENTION_DAYS } from '@/lib/retention'
import { DEFAULT_RULES } from '@/lib/shuttle'
import { useToast } from '@/app/Toast'
import { useT } from '@/i18n'
import type { BellPeriod, Building, Bus, Checkin, Zone } from '@/types'

type Tab = 'school' | 'campus' | 'shuttles' | 'bell' | 'import' | 'print' | 'data'
const secret = () => Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join('')
const ZONE_LABEL: Record<Zone, string> = { main: 'Main campus (A, D, E: walk indoors to the A loop)', annex: 'Annex (served by the H loop)', closed: 'Closed: under construction' }

export default function Setup() {
  const t = useT()
  const [tab, setTab] = useState<Tab>('campus')
  const campus = useCampus()
  if (!campus.ready) return <Spinner />
  const tabs: { v: Tab; l: string }[] = [
    { v: 'school', l: t('School') }, { v: 'campus', l: t('Buildings and stops') }, { v: 'shuttles', l: t('Shuttles and rules') },
    { v: 'bell', l: t('Bell schedule') }, { v: 'import', l: t('Import') }, { v: 'print', l: t('QR sheets') }, { v: 'data', l: t('Data and privacy') },
  ]
  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-5xl font-extrabold leading-[.95]">{t('School setup')}</h1>
        <p className="text-mute max-w-prose mt-1">{t('Any school that moves students between buildings can configure ShuttleSync here. Work through the tabs left to right.')}</p>
      </div>
      <div role="tablist" aria-label={t('Setup steps')} className="no-print flex gap-1 overflow-x-auto pb-1">
        {tabs.map((x, i) => (
          <button key={x.v} role="tab" aria-selected={tab === x.v} onClick={() => setTab(x.v)} data-testid={`tab-${x.v}`}
            className={`shrink-0 min-h-[44px] px-4 rounded-sign font-bold text-sm border ${tab === x.v ? 'bg-brand text-brand-ink border-brand' : 'bg-panel border-line'}`}>{i + 1}. {x.l}</button>
        ))}
      </div>
      {tab === 'school' && <SchoolTab />}
      {tab === 'campus' && <CampusTab />}
      {tab === 'shuttles' && <ShuttlesTab />}
      {tab === 'bell' && <BellTab />}
      {tab === 'import' && <ImportTab />}
      {tab === 'print' && <PrintTab />}
      {tab === 'data' && <DataTab />}
    </div>
  )
}

function SchoolTab() {
  const t = useT()
  const toast = useToast()
  const { rows } = useCollection<{ name: string; timezone: string }>('school')
  const cur = rows.find(r => r.id === 'main')
  const [name, setName] = useState(cur?.name ?? 'Plano Senior High School')
  const [tz, setTz] = useState(cur?.timezone ?? 'America/Chicago')
  return (
    <Panel className="p-4 space-y-3 max-w-xl">
      <Field label={t('School name')}><TextInput value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label={t('Time zone')} hint={t('Bell times and "today" use this zone.')}><Select value={tz} onChange={e => setTz(e.target.value)}>{['America/Chicago', 'America/New_York', 'America/Denver', 'America/Los_Angeles'].map(z => <option key={z}>{z}</option>)}</Select></Field>
      <Button onClick={async () => { await getStore().set('school', 'main', { name, timezone: tz, createdAt: Date.now() }); toast(t('Saved')) }}>{t('Save changes')}</Button>
    </Panel>
  )
}

function CampusTab() {
  const t = useT()
  const toast = useToast()
  const campus = useCampus()
  const settings = useSettings()
  const store = getStore()
  const [selStop, setSelStop] = useState<string | null>(campus.stops[0]?.id ?? null)
  const stop = campus.stops.find(s => s.id === selStop)
  const bld = (id: string, p: Partial<Building>) => store.update('buildings', id, p)
  const here = (cb: (lat: number, lng: number) => void) => navigator.geolocation?.getCurrentPosition(p => cb(p.coords.latitude, p.coords.longitude), () => toast(t('Could not get your location. Click the map instead.'), 'warn'), { enableHighAccuracy: true, timeout: 8000 })

  async function addBuilding() {
    const code = String.fromCharCode(65 + campus.buildings.length)
    await store.set('buildings', code, { id: code, name: `Building ${code}`, code, color: 'bldA', zone: 'main', lat: campus.buildings[0]?.lat ?? 33.03, lng: (campus.buildings[0]?.lng ?? -96.75) + 0.0005 * campus.buildings.length, approximate: true })
  }
  const approx = (p: boolean | undefined) => p ? <Pill tone="warn" icon="warn">{t('Approximate: confirm on site')}</Pill> : <Pill tone="ok" icon="check">{t('Confirmed')}</Pill>

  return (
    <div className="space-y-5">
      <Panel className="p-4 space-y-2">
        <h2 className="text-3xl font-bold">{t('Rain stop')}</h2>
        <Toggle checked={settings.rainStopActive} onChange={v => store.update('settings', 'main', { rainStopActive: v })} label={t('Rain stop active (east lot by the pond)')} />
        <p className="text-sm text-mute">{t('Off by default. Turn it on only during heavy rain or severe weather: shuttles may then stop at the east lot by the pond, serving Buildings D and E and the nearby portables. It appears in the student app and on the map.')}</p>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <Panel className="p-4 space-y-3">
            <div className="flex items-center justify-between"><h2 className="text-3xl font-bold">{t('Buildings')}</h2><Button size="sm" variant="outline" icon="plus" onClick={addBuilding}>{t('Add building')}</Button></div>
            {campus.buildings.map(b => (
              <div key={b.id} className="border border-line rounded-sign p-3 space-y-2">
                <div className="flex items-center gap-2"><BuildingBadge code={b.code} size={32} /><TextInput aria-label={t('Building name')} defaultValue={b.name} onBlur={e => bld(b.id, { name: e.target.value })} />
                  <Button size="sm" variant="ghost" aria-label={t('Delete')} icon="trash" onClick={() => store.remove('buildings', b.id)} /></div>
                <Field label={t('Where is it?')}><Select value={b.zone} onChange={e => bld(b.id, { zone: e.target.value as Zone })}>{(Object.keys(ZONE_LABEL) as Zone[]).map(z => <option key={z} value={z}>{t(ZONE_LABEL[z])}</option>)}</Select></Field>
                {b.zone === 'closed' && <Field label={t('What is happening there?')}><TextInput defaultValue={b.note ?? ''} onBlur={e => bld(b.id, { note: e.target.value })} placeholder="Interior demolition" /></Field>}
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t('Latitude')}><TextInput defaultValue={b.lat} onBlur={e => bld(b.id, { lat: Number(e.target.value) })} inputMode="decimal" /></Field>
                  <Field label={t('Longitude')}><TextInput defaultValue={b.lng} onBlur={e => bld(b.id, { lng: Number(e.target.value) })} inputMode="decimal" /></Field>
                </div>
                <div className="flex gap-2 flex-wrap items-center"><Button size="sm" variant="outline" icon="pin" onClick={() => here((lat, lng) => bld(b.id, { lat, lng, approximate: false }))}>{t('Use this phone\'s location')}</Button>{approx(b.approximate)}{b.approximate && <Button size="sm" variant="ghost" onClick={() => bld(b.id, { approximate: false })}>{t('Mark confirmed')}</Button>}</div>
              </div>
            ))}
          </Panel>
          <Panel className="p-4 space-y-3">
            <h2 className="text-3xl font-bold">{t('Stops')}</h2>
            {campus.stops.map(s => (
              <button key={s.id} onClick={() => setSelStop(s.id)} className={`w-full text-left rounded-sign border p-2 ${s.id === selStop ? 'border-brand bg-brand/5' : 'border-line'}`}>
                <span className="flex items-center gap-2"><Icon name="pin" size={16} /><span className="font-bold flex-1">{s.name}</span><span className="text-sm text-mute num">{s.geofenceRadiusM} m</span></span>
                <span className="flex gap-2 mt-1 flex-wrap">{approx(s.approximate)}{s.rainOnly && <Pill tone="info" icon="bell">{t('Rain only')}</Pill>}</span>
              </button>
            ))}
            {stop && (
              <div className="border-t border-line pt-3 space-y-2">
                <Field label={t('Stop name')}><TextInput key={stop.id} defaultValue={stop.name} onBlur={e => store.update('stops', stop.id, { name: e.target.value })} /></Field>
                {stop.address && <p className="text-sm text-mute">{stop.address}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t('Latitude')}><TextInput key={stop.id + 'lat' + stop.lat} defaultValue={stop.lat} onBlur={e => store.update('stops', stop.id, { lat: Number(e.target.value), approximate: false })} inputMode="decimal" /></Field>
                  <Field label={t('Longitude')}><TextInput key={stop.id + 'lng' + stop.lng} defaultValue={stop.lng} onBlur={e => store.update('stops', stop.id, { lng: Number(e.target.value), approximate: false })} inputMode="decimal" /></Field>
                </div>
                <Field label={t('Geofence radius: {m} m', { m: stop.geofenceRadiusM })} hint={t('Big enough to cover the loop, small enough not to trigger from the road.')}>
                  <input type="range" min={15} max={150} step={5} value={stop.geofenceRadiusM} onChange={e => store.update('stops', stop.id, { geofenceRadiusM: Number(e.target.value) })} className="w-full" aria-label={t('Geofence radius')} />
                </Field>
                <div className="flex gap-2 flex-wrap"><Button size="sm" variant="outline" icon="pin" onClick={() => here((lat, lng) => store.update('stops', stop.id, { lat, lng, approximate: false }))}>{t('Use this phone\'s location')}</Button>{stop.approximate && <Button size="sm" variant="ghost" onClick={() => store.update('stops', stop.id, { approximate: false })}>{t('Mark confirmed')}</Button>}</div>
              </div>
            )}
          </Panel>
        </div>
        <Panel className="p-3 space-y-2 lg:sticky lg:top-4 self-start">
          <h2 className="text-3xl font-bold">{t('Map')}</h2>
          <p className="text-sm text-mute">{t('Drag a yellow stop marker to move it. Click the map to move the selected stop there. Hatched buildings are closed.')}</p>
          <MapView buildings={campus.buildings} stops={campus.stops} buses={[]} rainActive showGeofence height={440}
            onMapClick={(lat, lng) => stop && store.update('stops', stop.id, { lat, lng, approximate: false })} onStopMove={(id, lat, lng) => store.update('stops', id, { lat, lng, approximate: false })} />
        </Panel>
      </div>
    </div>
  )
}

function NumberRule({ label, hint, field, min = 0, max = 60 }: { label: string; hint?: string; field: 'normalRideMin' | 'delayThresholdMin' | 'dwellMin' | 'walkToStopMin' | 'walkFromStopMin'; min?: number; max?: number }) {
  const rules = useRules()
  return (
    <Field label={label} hint={hint}>
      <TextInput key={rules[field]} type="number" min={min} max={max} step={0.5} defaultValue={rules[field]} data-testid={`rule-${field}`}
        onBlur={e => { const v = Number(e.target.value); if (!isNaN(v) && v >= min && v <= max) getStore().update('settings', 'main', { [field]: v }) }} />
    </Field>
  )
}

function ShuttlesTab() {
  const t = useT()
  const toast = useToast()
  const campus = useCampus()
  const store = getStore()
  async function addShuttle() {
    const n = String(Math.max(0, ...campus.buses.map(b => parseInt(b.number, 10) || 0)) + 1)
    const b: Bus = { id: `shuttle${n}`, number: n, label: `Shuttle ${n}`, capacity: 36, qrSecret: secret(), status: 'idle', delayMinutes: 0 }
    await store.set('buses', b.id, b)
  }
  return (
    <div className="space-y-5">
      <Panel className="p-4 space-y-3">
        <h2 className="text-3xl font-bold">{t('How the loop works')}</h2>
        <p className="text-mute">{t('There is no timetable. Shuttles run a continuous loop between the A loop and the H loop; any shuttle at your stop goes to the other end. A run starts when a shuttle leaves a stop and ends when it enters the other stop.')}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <NumberRule field="normalRideMin" label={t('Normal ride (minutes)')} hint={t('Time from leaving one loop to reaching the other. Measure it on a ride-along.')} min={1} max={30} />
          <NumberRule field="delayThresholdMin" label={t('Delay threshold (minutes)')} hint={t('A rider is excused if the ride takes longer than normal + this, or the shuttle arrives after the bell.')} min={0} max={20} />
          <NumberRule field="dwellMin" label={t('Normal wait at a stop (minutes)')} min={0} max={15} />
          <NumberRule field="walkToStopMin" label={t('Walk from class to the stop (minutes)')} min={0} max={15} />
          <NumberRule field="walkFromStopMin" label={t('Walk from the stop to class (minutes)')} min={0} max={15} />
        </div>
        <Button size="sm" variant="ghost" icon="reset" onClick={() => store.update('settings', 'main', { ...DEFAULT_RULES, rainStopActive: false })}>{t('Reset to defaults (5 min ride, 3 min threshold)')}</Button>
      </Panel>
      <Panel className="p-4 space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-3xl font-bold">{t('Shuttles')} <span className="text-mute num text-xl">{campus.buses.length}</span></h2>
          <Button size="sm" variant="outline" icon="plus" onClick={addShuttle} data-testid="add-shuttle">{t('Add shuttle')}</Button></div>
        <p className="text-sm text-mute">{t('How many shuttles run the loop? Each one needs a phone (carried by a passenger) that shares its location.')}</p>
        {campus.buses.map(b => (
          <div key={b.id} className="border border-line rounded-sign p-3 flex items-center gap-3 flex-wrap">
            <span className="grid place-items-center h-10 w-10 rounded-[6px] bg-[rgb(21_23_27)] text-[rgb(var(--sign))] font-display text-2xl font-extrabold">{b.number}</span>
            <span className="font-bold flex-1">{t('Shuttle {n}', { n: b.number })}</span>
            <Button size="sm" variant="ghost" onClick={async () => { await store.update('buses', b.id, { qrSecret: secret() }); toast(t('New QR secret saved')) }}>{t('Regenerate QR secret')}</Button>
            <Button size="sm" variant="ghost" icon="trash" onClick={() => store.remove('buses', b.id)}>{t('Remove')}</Button>
          </div>
        ))}
      </Panel>
    </div>
  )
}

function BellTab() {
  const t = useT()
  const toast = useToast()
  const campus = useCampus()
  const store = getStore()
  const upd = (b: BellPeriod, p: Partial<BellPeriod>) => store.update('bellSchedule', b.id, { ...p, ...(p.end != null ? { transitionStart: p.end } : {}) })
  const asTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return (
    <Panel className="p-4 space-y-3 max-w-2xl">
      <div className="flex items-center justify-between"><h2 className="text-3xl font-bold">{t('Bell schedule')}</h2>
        <Button size="sm" variant="outline" icon="plus" onClick={() => { const last = campus.bell[campus.bell.length - 1]; const p = (last?.period ?? 0) + 1; const start = (last?.end ?? 480) + 14; store.set('bellSchedule', `p${p}`, { id: `p${p}`, period: p, name: `Period ${p}`, start, end: start + 50, transitionStart: start + 50 }) }}>{t('Add period')}</Button></div>
      <Banner tone="warn">{t('This is Plano Senior\'s published daily bell schedule (periods 0–7, one lunch after period 3). Early-release and special-schedule days are not modeled yet: change the times here on those days.')}</Banner>
      <p className="text-sm text-mute">{t('Use 24-hour times, like 13:10. Make passing periods long enough to include a shuttle ride.')}</p>
      {campus.bell.map(b => (
        <div key={b.id} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-end">
          <span className="font-display text-3xl font-extrabold pb-1">{b.period}</span>
          <Field label={t('Starts')}><TextInput defaultValue={asTime(b.start)} onBlur={e => { try { upd(b, { start: parseClock(e.target.value) }) } catch { toast(t('Use a time like 09:02'), 'warn') } }} /></Field>
          <Field label={t('Ends')}><TextInput defaultValue={asTime(b.end)} onBlur={e => { try { upd(b, { end: parseClock(e.target.value) }) } catch { toast(t('Use a time like 09:52'), 'warn') } }} /></Field>
          <Button size="sm" variant="ghost" aria-label={t('Delete')} icon="trash" onClick={() => store.remove('bellSchedule', b.id)} />
        </div>
      ))}
    </Panel>
  )
}

function ImportTab() {
  const t = useT()
  const toast = useToast()
  const campus = useCampus()
  const { teachers } = usePeople()
  const store = getStore()
  const [csv, setCsv] = useState('')
  const parsed = useMemo(() => (csv.trim() ? parseEnrollment(csv, campus.buildings, teachers) : null), [csv, campus.buildings, teachers])
  return (
    <div className="space-y-5 max-w-3xl">
      <Panel className="p-4 space-y-3">
        <h2 className="text-3xl font-bold">{t('Enroll students from a spreadsheet')}</h2>
        <p className="text-sm text-mute">{t('One row per student per class. Header: name,studentNumber,grade,period,building,room,teacher,course. Building is a letter: A, D, E or H.')}</p>
        <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={7} className="w-full rounded-sign border border-line bg-panel p-3 font-mono text-sm" aria-label="CSV" placeholder={'name,studentNumber,grade,period,building,room,teacher,course\nAna Soto,1001,10,1,A,A101,Okafor,English III'} data-testid="csv-text" />
        <input type="file" accept=".csv,text/csv" onChange={async e => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()) }} aria-label={t('Choose a CSV file')} />
        {parsed?.errors.map(e => <Banner key={e} tone="bad">{e}</Banner>)}
        {parsed && parsed.students.length > 0 && <Banner tone="ok" icon="check">{t('{n} students ready to import.', { n: parsed.students.length })}</Banner>}
        <Button disabled={!parsed?.students.length} data-testid="csv-import" onClick={async () => { await Promise.all(parsed!.students.map(s => store.set('students', s.id, s))); toast(t('Imported {n} students', { n: parsed!.students.length })); setCsv('') }}>{t('Import students')}</Button>
      </Panel>
      <Panel className="p-4 space-y-2">
        <h2 className="text-2xl font-bold">{t('Timetable photo import (not used)')}</h2>
        <p className="text-sm text-mute">{t('The shuttle has no timetable, so this feature is switched off. The code (src/ai/timetable.ts) is kept in case a school needs a timetable-based route later.')}</p>
      </Panel>
    </div>
  )
}

function PrintTab() {
  const t = useT()
  const campus = useCampus()
  return (
    <div className="space-y-4">
      <div className="no-print flex items-center gap-3 flex-wrap">
        <Button icon="print" onClick={() => window.print()} data-testid="print-qr">{t('Print QR sheets')}</Button>
        <p className="text-sm text-mute max-w-xl">{t('Printed codes never change, so they only prove which shuttle. The location check does the rest. For a stronger check, show the rotating code on the shuttle phone instead.')}</p>
      </div>
      <div className="grid gap-6 print:block">
        {campus.buses.map(b => (
          <section key={b.id} className="bg-white text-black border border-line rounded-sign p-8 text-center break-after-page">
            <div className="font-display text-[6rem] leading-none font-extrabold">SHUTTLE {b.number}</div>
            <div className="text-2xl mb-4">Building A loop ⇄ Building H loop</div>
            <BusQr bus={b} mode="static" size={320} />
            <p className="mt-4 text-xl font-bold">Scan with the ShuttleSync app when you board</p>
            <p className="text-sm">Your location is read once, only to check you are on this shuttle.</p>
          </section>
        ))}
      </div>
    </div>
  )
}

function DataTab() {
  const t = useT()
  const toast = useToast()
  const settings = useSettings()
  const store = getStore()
  const { rows: checkins } = useCollection<Checkin>('checkins')
  function exportCsv() {
    const head = 'studentId,busId,runId,scannedAt,method,verified,reason,distanceToBusM'
    const body = checkins.map(c => [c.studentId, c.busId, c.runId, new Date(c.scannedAt).toISOString(), c.method, c.verified, JSON.stringify(c.verifyReason), c.distanceToBusM ?? ''].join(','))
    const url = URL.createObjectURL(new Blob([[head, ...body].join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'shuttlesync-checkins.csv'; a.click(); URL.revokeObjectURL(url)
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel className="p-4 space-y-3">
        <h2 className="text-3xl font-bold">{t('Pilot mode')}</h2>
        <Segmented label={t('Data mode')} value={settings.mode} onChange={m => store.update('settings', 'main', { mode: m })} options={[{ value: 'demo', label: t('Demo (simulated)') }, { value: 'pilot', label: t('Real pilot') }]} />
        <Banner tone="warn">{t('Only switch to Real pilot after the school has approved the pilot in writing. In Real pilot mode, every device that opens the app records its scans and feedback as real data.')}</Banner>
        <Toggle checked={settings.analyticsOff} onChange={v => store.update('settings', 'main', { analyticsOff: v })} label={t('Turn analytics off for everyone')} />
      </Panel>
      <Panel className="p-4 space-y-3">
        <h2 className="text-3xl font-bold">{t('Retention')}</h2>
        <p className="text-mute">{t('Check-ins and the location saved with them are deleted after {d} days. This runs automatically whenever staff open the app; you can also run it now.', { d: RETENTION_DAYS })}</p>
        <div className="flex gap-2 flex-wrap"><Button variant="outline" onClick={async () => toast(t('Purged {n} old check-ins', { n: await purgeExpiredCheckins(store) }))}>{t('Purge old check-ins now')}</Button>
          <Button variant="outline" icon="download" onClick={exportCsv}>{t('Export check-ins (CSV)')}</Button></div>
        <p className="text-xs text-mute flex items-center gap-1"><Icon name="shield" size={12} />{t('{n} check-ins stored right now.', { n: checkins.length })} {fmtClock(clock.minutes())}</p>
      </Panel>
    </div>
  )
}
