import { CheckCircle, Circle, Clock } from 'lucide-react'

interface Step { label: string; status: 'done' | 'active' | 'pending' | 'none'; id?: string; link?: string }

export function FlowIndicator({ steps }: { steps: Step[] }) {
  const visible = steps.filter(s => s.status !== 'none')
  if (visible.length === 0) return null

  return (
    <div className="flex items-center gap-1 text-[11px]">
      {visible.map((step, i) => (
        <span key={step.label} className="flex items-center gap-0.5">
          {i > 0 && <span className="mx-0.5 text-[#D1D5DB]">&rarr;</span>}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] font-semibold border ${
            step.status === 'done'    ? 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]' :
            step.status === 'active' ? 'bg-[#EEF1FE] text-[#4F6CF7] border-[#4F6CF7]/20' :
                                       'bg-[#F3F4F6] text-[#9CA3AF] border-[#E5E7EB]'
          }`}>
            {step.status === 'done'    ? <CheckCircle className="h-4 w-4" strokeWidth={1.5} /> :
             step.status === 'active'  ? <Circle className="h-4 w-4" strokeWidth={1.5} /> :
                                         <Clock className="h-4 w-4" strokeWidth={1.5} />}
            {step.label}
          </span>
        </span>
      ))}
    </div>
  )
}
