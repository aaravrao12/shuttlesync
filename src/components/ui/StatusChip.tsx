import { motion } from 'framer-motion'
import type { LiveStatus } from '@/types'
import { STATUS_META } from '@/lib/studentStatus'
import { Icon } from './Icon'
import { useT } from '@/i18n'

const TONE: Record<string, string> = {
  ok: 'text-ok bg-ok/10 border-ok/40',
  info: 'text-info bg-info/10 border-info/40',
  warn: 'text-warn bg-warn/10 border-warn/50',
  bad: 'text-bad bg-bad/10 border-bad/40',
  mute: 'text-mute bg-raised border-line',
}

/** Icon + words + color: status is never conveyed by color alone (WCAG). The morph is a spring layout animation. */
export function StatusChip({ status, detail, compact }: { status: LiveStatus; detail?: string; compact?: boolean }) {
  const t = useT()
  const m = STATUS_META[status]
  return (
    <motion.span
      layout
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-sm font-bold whitespace-nowrap ${TONE[m.tone]}`}
    >
      <Icon name={m.icon} size={compact ? 14 : 16} />
      <span>{t(m.label)}</span>
      {detail && <span className="font-medium opacity-80 num">· {detail}</span>}
    </motion.span>
  )
}

export function Pill({ children, tone = 'mute', icon }: { children: React.ReactNode; tone?: 'ok' | 'info' | 'warn' | 'bad' | 'mute'; icon?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-xs font-bold ${TONE[tone]}`}>
      {icon && <Icon name={icon} size={12} />}{children}
    </span>
  )
}

/** Visible label for anything that is demo data (spec: "Simulated data must be labeled"). */
export function SimulatedTag() {
  const t = useT()
  return <Pill tone="warn" icon="flask">{t('Simulated')}</Pill>
}
