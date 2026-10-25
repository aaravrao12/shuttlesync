import { useState } from 'react'
import { useT } from '@/i18n'

// Two-series comparison (Round 1 vs Round 2). Colors are slots 1 and 2 of the validated categorical palette
// (blue, orange), stepped separately for the dark surface. Text never wears the series color; a legend, direct value
// labels, per-bar tooltips and a table view keep identity from relying on color alone.
export interface Point { value: number | null; n: number }
export interface CompareRow { label: string; a: Point; b: Point; max: number; fmt: (v: number) => string }

const css = `
.viz-root{--s1:#2a78d6;--s2:#eb6834;--surface:rgb(var(--panel));--track:rgb(var(--raised))}
:root[data-theme='dark'] .viz-root{--s1:#3987e5;--s2:#d95926}
@media (prefers-color-scheme: dark){:root:not([data-theme='light']) .viz-root{--s1:#3987e5;--s2:#d95926}}
`

function Bar({ p, color, row, name }: { p: Point; color: string; row: CompareRow; name: string }) {
  const pct = p.value == null ? 0 : Math.max(2, Math.min(100, (p.value / row.max) * 100))
  const tip = p.value == null ? `${name}: no data yet` : `${name}: ${row.fmt(p.value)} (n=${p.n})`
  return (
    <div className="flex items-center gap-3 min-h-[28px]" title={tip}>
      <div className="flex-1 h-4 rounded-r-[4px] bg-[var(--track)]" aria-hidden>
        {p.value != null && <div className="h-full rounded-r-[4px]" style={{ width: `${pct}%`, background: color, transition: 'width .6s cubic-bezier(.2,.8,.2,1)' }} />}
      </div>
      <div className="w-28 text-sm num text-right"><b>{p.value == null ? '–' : row.fmt(p.value)}</b> <span className="text-mute">n={p.n}</span></div>
    </div>
  )
}

export function CompareBars({ rows, aName, bName }: { rows: CompareRow[]; aName: string; bName: string }) {
  const t = useT()
  const [table, setTable] = useState(false)
  return (
    <div className="viz-root">
      <style>{css}</style>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <ul className="flex gap-4 text-sm" aria-label={t('Legend')}>
          <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-[3px]" style={{ background: 'var(--s1)' }} />{aName}</li>
          <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-[3px]" style={{ background: 'var(--s2)' }} />{bName}</li>
        </ul>
        <button className="text-sm underline text-mute min-h-[44px]" onClick={() => setTable(!table)} aria-pressed={table}>{table ? t('Show chart') : t('Show table')}</button>
      </div>
      {table ? (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-mute"><th className="py-1 pr-3">{t('Measure')}</th><th className="pr-3">{aName}</th><th>{bName}</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.label} className="border-t border-line"><td className="py-1.5 pr-3">{r.label}</td>
            <td className="pr-3 num">{r.a.value == null ? '–' : `${r.fmt(r.a.value)} (n=${r.a.n})`}</td><td className="num">{r.b.value == null ? '–' : `${r.fmt(r.b.value)} (n=${r.b.n})`}</td></tr>)}</tbody>
        </table></div>
      ) : (
        <div className="space-y-5">
          {rows.map(r => (
            <div key={r.label}>
              <div className="font-bold mb-1">{r.label}</div>
              <div className="space-y-[2px]"><Bar p={r.a} color="var(--s1)" row={r} name={aName} /><Bar p={r.b} color="var(--s2)" row={r} name={bName} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
