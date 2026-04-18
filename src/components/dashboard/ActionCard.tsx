import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

interface Props {
  icon: ReactNode
  title: string
  value: string | number
  sub: string
  href: string
  /** When true, value is rendered muted (gray-400) — use for "nothing to do" state. */
  emptyState?: boolean
}

export function ActionCard({ icon, title, value, sub, href, emptyState = false }: Props) {
  return (
    <Link
      to={href}
      className="group relative flex flex-col gap-3 rounded-[10px] border border-gray-200 bg-white p-5 transition-all hover:border-gray-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-start justify-between">
        <div className="shrink-0">{icon}</div>
        <ArrowUpRight className="h-4 w-4 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">{title}</p>
        <p
          className={`mt-1.5 text-[22px] font-bold leading-none ${emptyState ? 'text-gray-400' : 'text-gray-900'}`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </p>
        <p className="mt-2 text-[12px] text-gray-400">{sub}</p>
      </div>
    </Link>
  )
}
