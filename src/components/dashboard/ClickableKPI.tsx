import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

interface Props {
  label: string
  value: string
  sub?: string
  href: string
}

export function ClickableKPI({ label, value, sub, href }: Props) {
  return (
    <Link
      to={href}
      className="group relative block rounded-[10px] border border-[#E5E7EB] bg-white p-5 transition-all hover:border-gray-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">{label}</p>
        <ArrowUpRight className="h-4 w-4 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.5} />
      </div>
      <p
        className="mt-3 text-[28px] font-bold leading-none text-[#111827]"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </p>
      {sub && <p className="mt-2 text-[12px] text-[#9CA3AF]">{sub}</p>}
    </Link>
  )
}
