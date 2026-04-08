import { clsx } from 'clsx'

const colors: Record<string, string> = {
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-stone-100 text-stone-700',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
}

interface Props {
  children: React.ReactNode
  color?: keyof typeof colors
  className?: string
}

export function Badge({ children, color = 'gray', className }: Props) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colors[color], className)}>
      {children}
    </span>
  )
}

export function statusColor(status: string): keyof typeof colors {
  const map: Record<string, keyof typeof colors> = {
    Lead: 'blue', Scheduled: 'purple', 'In Progress': 'yellow', Completed: 'green', Cancelled: 'gray',
    Draft: 'gray', Sent: 'blue', Accepted: 'green', Declined: 'red',
    Paid: 'green', Overdue: 'red',
  }
  return map[status] ?? 'gray'
}
