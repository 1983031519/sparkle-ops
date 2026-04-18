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
      className="group relative block rounded-[10px] border border-gray-200 bg-white p-5 transition-all hover:border-gray-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-start justify-between">
        <p className="text-eyebrow uppercase text-gray-500">{label}</p>
        <ArrowUpRight className="h-4 w-4 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.5} />
      </div>
      <p
        className="mt-3 text-display leading-none text-gray-900"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </p>
      {sub && <p className="mt-2 text-eyebrow font-normal text-gray-400">{sub}</p>}
    </Link>
  )
}
