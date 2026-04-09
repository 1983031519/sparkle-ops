import { clsx } from 'clsx'

const colors: Record<string, string> = {
  green: 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]',
  blue: 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]',
  yellow: 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]',
  red: 'bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3]',
  gray: 'bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]',
  purple: 'bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE]',
  orange: 'bg-orange-50 text-orange-700 border border-orange-200',
  gold: 'bg-gold-100 text-gold-500 border border-gold-200',
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
