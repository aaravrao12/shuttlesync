import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Icon, type IconName } from './Icon'

type Variant = 'primary' | 'sign' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:opacity-90',
  sign: 'bg-[rgb(var(--sign))] text-[rgb(var(--sign-ink))] hover:brightness-95',
  ghost: 'bg-transparent text-ink hover:bg-raised',
  outline: 'bg-panel text-ink border border-line hover:bg-raised',
  danger: 'bg-bad text-brand-ink hover:opacity-90',
}
const SIZE: Record<Size, string> = {
  sm: 'min-h-[36px] px-3 text-sm',
  md: 'min-h-[44px] px-4 text-base',
  lg: 'min-h-[56px] px-6 text-lg',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: IconName
  full?: boolean
}

/** 44px minimum touch target on md+; text is verbs ("Save changes"), never "Submit". */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ variant = 'primary', size = 'md', icon, full, className = '', children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      {...rest}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sign font-bold transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none ${VARIANT[variant]} ${SIZE[size]} ${full ? 'w-full' : ''} ${className}`}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 22 : 18} />}
      {children}
    </button>
  )
})
