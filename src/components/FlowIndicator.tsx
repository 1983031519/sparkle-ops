import { CheckCircle, Circle, Clock } from 'lucide-react'

interface Step { label: string; status: 'done' | 'active' | 'pending' | 'none'; id?: string; link?: string }

export function FlowIndicator({ steps }: { steps: Step[] }) {
  const visible = steps.filter(s => s.status !== 'none')
  if (visible.length === 0) return null

  return (
    <div className="flex items-center gap-1 text-[11px]">
      {visible.map((step, i) => (
        <span key={step.label} className="flex items-center gap-0.5">
          {i > 0 && <span className="mx-0.5 text-stone-300">&rarr;</span>}
          <span className={`inline-flex items-center gap-1 rounded-[20px] px-2 py-[3px] font-semibold tracking-[0.2px] border ${
            step.status === 'done' ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]' :
            step.status === 'active' ? 'bg-navy-900/[0.06] text-navy-900 border-navy-900/10' :
            'bg-[#F3F4F6] text-[#9CA3AF] border-[#E5E7EB]'
          }`}>
            {step.status === 'done' ? <CheckCircle size={12} strokeWidth={1.5} /> :
             step.status === 'active' ? <Circle size={12} strokeWidth={1.5} /> :
             <Clock size={12} strokeWidth={1.5} />}
            {step.label}
          </span>
        </span>
      ))}
    </div>
  )
}
