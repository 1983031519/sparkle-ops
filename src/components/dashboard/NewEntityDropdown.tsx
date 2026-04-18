import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronDown, FileText, FileEdit, Briefcase, User } from 'lucide-react'

interface Option {
  label: string
  to: string
  icon: typeof FileText
}

const OPTIONS: Option[] = [
  { label: 'New Invoice',  to: '/invoices?new=true',  icon: FileText },
  { label: 'New Estimate', to: '/estimates?new=true', icon: FileEdit },
  { label: 'New Job',      to: '/jobs?new=true',      icon: Briefcase },
  { label: 'New Client',   to: '/clients?new=true',   icon: User },
]

export function NewEntityDropdown({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function choose(to: string) {
    setOpen(false)
    navigate(to)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex h-[38px] items-center gap-2 rounded-[8px] bg-[#4F6CF7] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#3451D1] focus:outline-none focus:ring-2 focus:ring-[#4F6CF7]/30 focus:ring-offset-1"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
        {!compact && <span>New</span>}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[200px] overflow-hidden rounded-[10px] border border-gray-200 bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
        >
          {OPTIONS.map(opt => {
            const OptIcon = opt.icon
            return (
              <button
                key={opt.to}
                type="button"
                role="menuitem"
                onClick={() => choose(opt.to)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <OptIcon className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
