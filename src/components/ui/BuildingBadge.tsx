import type { CSSProperties } from 'react'

export const BLD_VAR: Record<string, string> = { A: '--bld-a', B: '--bld-b', C: '--bld-c', D: '--bld-d', E: '--bld-e', H: '--bld-h' }
export const bldColor = (code?: string) => `rgb(var(${BLD_VAR[(code ?? '').toUpperCase()] ?? '--mute'}))`

/** Square signage tile with the building letter, like a platform sign. */
export function BuildingBadge({ code, size = 36, className = '' }: { code?: string; size?: number; className?: string }) {
  const style: CSSProperties = { width: size, height: size, background: bldColor(code), fontSize: size * 0.62, color: '#fff' }
  return (
    <span className={`inline-grid place-items-center rounded-[6px] font-display font-extrabold leading-none shrink-0 ${className}`} style={style} aria-label={`Building ${code}`}>
      {code}
    </span>
  )
}

/** "SHUTTLE 1 → H" sign (the destination is optional: the loop has two ends and any shuttle goes to the other one). */
export function BusSign({ number, toCode, className = '' }: { number: string; toCode?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-[6px] bg-[rgb(21_23_27)] text-white px-2.5 py-1 font-display font-bold tracking-wide ${className}`}>
      <span className="text-[rgb(var(--sign))]">SHUTTLE {number}</span>
      {toCode && <><span aria-hidden>→</span><BuildingBadge code={toCode} size={22} /></>}
    </span>
  )
}
