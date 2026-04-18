import { clsx } from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

const variants = {
  primary: 'bg-[#4F6CF7] text-white hover:bg-[#3451D1] active:scale-[0.99] focus:ring-[#4F6CF7]/30',
  gold: 'bg-[#4F6CF7] text-white hover:bg-[#3451D1] active:scale-[0.99] focus:ring-[#4F6CF7]/30',
  secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 active:scale-[0.99] focus:ring-gray-300',
  danger: 'bg-[#EF4444] text-white hover:bg-[#DC2626] active:scale-[0.99] focus:ring-red-500/30',
  ghost: 'text-gray-500 border border-gray-200 hover:bg-gray-50 hover:text-gray-700 active:scale-[0.99] focus:ring-gray-300',
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
        'inline-flex items-center justify-center gap-2 rounded-[8px] font-semibold transition-all duration-100 ease-out focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none',
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
