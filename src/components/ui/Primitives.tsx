import { useEffect, useRef, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import { Icon, type IconName } from './Icon'
import { Button } from './Button'
import { useT } from '@/i18n'

export function Panel({ children, className = '', as: Tag = 'section', ...rest }: { children: ReactNode; className?: string; as?: any } & React.HTMLAttributes<HTMLElement>) {
  return <Tag className={`bg-panel border border-line rounded-sign ${className}`} {...rest}>{children}</Tag>
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  const t = useT()
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 text-mute p-6">
      <span className="h-5 w-5 rounded-full border-2 border-line border-t-brand animate-spin" aria-hidden />
      <span>{t(label)}…</span>
    </div>
  )
}

export function EmptyState({ icon = 'info', title, body, action }: { icon?: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 p-6 border border-dashed border-line rounded-sign bg-panel/60">
      <span className="grid place-items-center h-10 w-10 rounded-full bg-raised text-mute"><Icon name={icon} /></span>
      <h3 className="text-2xl font-bold leading-none">{title}</h3>
      {body && <p className="text-mute max-w-prose">{body}</p>}
      {action}
    </div>
  )
}

const BANNER: Record<string, string> = {
  info: 'bg-info/10 border-info/40 text-ink', warn: 'bg-warn/10 border-warn/50 text-ink', bad: 'bg-bad/10 border-bad/40 text-ink', ok: 'bg-ok/10 border-ok/40 text-ink',
}
export function Banner({ tone = 'info', icon, children, action }: { tone?: 'info' | 'warn' | 'bad' | 'ok'; icon?: IconName; children: ReactNode; action?: ReactNode }) {
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-sign border px-3 py-2.5 text-sm ${BANNER[tone]}`}>
      <Icon name={icon ?? (tone === 'bad' || tone === 'warn' ? 'warn' : 'info')} size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1">{children}</div>
      {action}
    </div>
  )
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="block text-sm font-bold mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-mute mt-1">{hint}</span>}
    </label>
  )
}

const INPUT = 'w-full min-h-[44px] rounded-sign border border-line bg-panel px-3 text-base placeholder:text-mute/70 focus:border-info'
export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT} ${props.className ?? ''}`} />
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${INPUT} ${props.className ?? ''}`} />
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center justify-between gap-4 w-full min-h-[44px] text-left">
      <span className="font-medium">{label}</span>
      <span className={`relative h-7 w-12 rounded-pill transition ${checked ? 'bg-ok' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-sign border border-line bg-raised p-0.5">
      {options.map(o => (
        <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`min-h-[40px] px-3 rounded-[4px] text-sm font-bold transition ${value === o.value ? 'bg-panel shadow-sm text-ink' : 'text-mute hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Numbers that tick smoothly to their new value instead of jumping. */
export function RollingNumber({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(value)
  const [shown, setShown] = useState(value)
  useEffect(() => {
    if (reduce) { setShown(value); return }
    const c = animate(mv, value, { duration: 0.6, ease: 'easeOut', onUpdate: v => setShown(v) })
    return () => c.stop()
  }, [value])
  return <span className="num">{shown.toFixed(decimals)}{suffix}</span>
}

/** Bottom sheet on phones, centered modal on desktop. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [open])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-lg max-h-[90dvh] overflow-auto bg-panel border border-line rounded-t-xl sm:rounded-sign p-5 safe-bottom outline-none">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-3xl font-bold leading-none">{title}</h2>
              <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('Close')}><Icon name="x" /></Button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Countdown ring with a huge numeral. `fraction` is 0..1 of the remaining window. */
export function CountdownRing({ minutes, fraction, size = 168, label }: { minutes: number; fraction: number; size?: number; label: string }) {
  const t = useT()
  const r = (size - 14) / 2
  const c = 2 * Math.PI * r
  const f = Math.min(1, Math.max(0, fraction))
  const shown = minutes <= 0.5 ? t('NOW') : Math.max(1, Math.round(minutes)).toString()
  const isNow = minutes <= 0.5
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${isNow ? t('NOW') : shown + ' ' + t('min')}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth="8" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} animate={{ strokeDashoffset: c * (1 - f) }} transition={{ type: 'spring', stiffness: 60, damping: 20 }} />
      </svg>
      <div className="absolute text-center leading-none">
        <div className="font-display font-extrabold num" style={{ fontSize: size * (isNow ? 0.28 : 0.4) }}>{shown}</div>
        {!isNow && <div className="text-xs font-bold opacity-80 mt-1">{t('min')}</div>}
      </div>
    </div>
  )
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display font-extrabold text-2xl leading-none ${className}`}>
      <span className="grid place-items-center h-8 w-8 rounded-[6px] bg-brand text-brand-ink"><Icon name="bus" size={18} /></span>
      ShuttleSync
    </span>
  )
}
