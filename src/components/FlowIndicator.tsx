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
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium ${
            step.status === 'done' ? 'bg-green-50 text-green-700' :
            step.status === 'active' ? 'bg-blue-50 text-blue-700' :
            'bg-stone-100 text-stone-500'
          }`}>
            {step.status === 'done' ? <CheckCircle className="h-3 w-3" /> :
             step.status === 'active' ? <Circle className="h-3 w-3" /> :
             <Clock className="h-3 w-3" />}
            {step.label}
          </span>
        </span>
      ))}
    </div>
  )
}
