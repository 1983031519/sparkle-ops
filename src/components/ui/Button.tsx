import { clsx } from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

const variants = {
  primary: 'bg-navy-900 text-white hover:bg-navy-800 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(13,27,61,0.25)] active:translate-y-0 active:scale-[0.99] focus:ring-navy-700/30',
  gold: 'bg-gold-500 text-white hover:bg-gold-400 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(200,169,110,0.35)] active:translate-y-0 active:scale-[0.99] focus:ring-gold-500/30',
  secondary: 'bg-stone-100 text-stone-700 hover:bg-stone-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.99] focus:ring-stone-300',
  danger: 'bg-danger-600 text-white hover:bg-red-700 hover:-translate-y-px active:translate-y-0 active:scale-[0.99] focus:ring-red-500/30',
  ghost: 'text-stone-500 border border-stone-200 hover:bg-stone-50 hover:text-stone-700 hover:border-gold-500/40 active:scale-[0.99] focus:ring-stone-300',
}

const sizes = {
  sm: 'px-3 py-1.5 text-[12px]',
  md: 'h-[38px] px-4 text-[13px]',
  lg: 'h-[44px] px-6 text-[14px]',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: Props) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-[8px] font-semibold transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
