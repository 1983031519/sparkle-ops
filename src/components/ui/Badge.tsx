import { clsx } from 'clsx'

const colors: Record<string, string> = {
  green: 'bg-success-50 text-success-600',
  blue: 'bg-info-50 text-info-600',
  yellow: 'bg-warning-50 text-warning-600',
  red: 'bg-danger-50 text-danger-600',
  gray: 'bg-[#F3F4F6] text-[#6B7280]',
  purple: 'bg-purple-50 text-purple-700',
  orange: 'bg-orange-50 text-orange-700',
  gold: 'bg-gold-100 text-gold-500',
}

interface Props {
  children: React.ReactNode
  color?: keyof typeof colors
  className?: string
}

export function Badge({ children, color = 'gray', className }: Props) {
  return (
    <span className={clsx(
      'inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-semibold tracking-[0.2px]',
      colors[color],
      className,
    )}>
      {children}
    </span>
  )
}

export function statusColor(status: string): keyof typeof colors {
  const map: Record<string, keyof typeof colors> = {
    Lead: 'blue', Scheduled: 'purple', 'In Progress': 'yellow', Completed: 'green', Cancelled: 'gray',
    Draft: 'gray', Sent: 'blue', Approved: 'green',
    Unpaid: 'yellow', Paid: 'green', Overdue: 'red',
  }
  return map[status] ?? 'gray'
}
