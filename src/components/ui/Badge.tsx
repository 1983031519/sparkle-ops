import { clsx } from 'clsx'

const colors: Record<string, { bg: string; text: string; dot: string }> = {
  green:  { bg: '#D1FAE5', text: '#065F46', dot: '#059669' },
  blue:   { bg: '#DBEAFE', text: '#1E40AF', dot: '#3B82F6' },
  yellow: { bg: '#FEF9C3', text: '#854D0E', dot: '#EAB308' },
  red:    { bg: '#FEE2E2', text: '#991B1B', dot: '#DC2626' },
  gray:   { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF' },
  purple: { bg: '#EDE9FE', text: '#5B21B6', dot: '#7C3AED' },
  orange: { bg: '#FFEDD5', text: '#C2410C', dot: '#F97316' },
  teal:   { bg: '#CCFBF1', text: '#0F766E', dot: '#14B8A6' },
  gold:   { bg: '#FEF3C7', text: '#92400E', dot: '#D97706' },
}

interface Props {
  children: React.ReactNode
  color?: keyof typeof colors
  className?: string
}

export function Badge({ children, color = 'gray', className }: Props) {
  const c = colors[color] ?? colors.gray
  return (
    <span
      className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-micro font-semibold', className)}
      style={{ background: c.bg, color: c.text }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0, display: 'inline-block' }} />
      {children}
    </span>
  )
}

export function statusColor(status: string): keyof typeof colors {
  const map: Record<string, keyof typeof colors> = {
    Lead: 'gray', Scheduled: 'blue', 'In Progress': 'blue', Completed: 'green', Cancelled: 'gray',
    Draft: 'gray', Sent: 'yellow', Approved: 'green',
    Unpaid: 'yellow', Paid: 'green', Overdue: 'red',
    Active: 'green', Inactive: 'gray',
    Viewed: 'blue',
  }
  return map[status] ?? 'gray'
}
