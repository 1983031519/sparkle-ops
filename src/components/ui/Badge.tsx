import { clsx } from 'clsx'

const colors: Record<string, string> = {
  green: 'bg-[#F0FDF4] text-[#15803D]',
  blue: 'bg-[#EFF6FF] text-[#1D4ED8]',
  yellow: 'bg-[#FFFBEB] text-[#B45309]',
  red: 'bg-[#FFF1F2] text-[#BE123C]',
  gray: 'bg-[#F3F4F6] text-[#6B7280]',
  purple: 'bg-[#F5F3FF] text-[#6D28D9]',
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
      'inline-flex items-center rounded-[20px] px-2.5 py-[2px] text-[11px] font-semibold tracking-[0.2px] transition-opacity duration-150',
      colors[color],
      className,
    )}>
      {children}
    </span>
  )
}

export function statusColor(status: string): keyof typeof colors {
  const map: Record<string, keyof typeof colors> = {
    Lead: 'blue', Scheduled: 'purple', 'In Progress': 'yellow', Completed: 'blue', Cancelled: 'gray',
    Draft: 'gray', Sent: 'blue', Approved: 'green',
    Unpaid: 'red', Paid: 'green', Overdue: 'red',
    Active: 'green', Inactive: 'gray',
  }
  return map[status] ?? 'gray'
}
