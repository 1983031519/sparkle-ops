import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx(
      'rounded-[16px] border border-black/[0.06] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)]',
      className,
    )}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('border-b border-stone-100 px-6 py-4', className)}>{children}</div>
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('px-6 py-5', className)}>{children}</div>
}
