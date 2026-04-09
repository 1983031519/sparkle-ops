import { clsx } from 'clsx'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const inputClass = 'block w-full h-[40px] rounded-[10px] border border-stone-200 bg-white px-3 text-[14px] shadow-none placeholder:text-stone-400 transition-all duration-150 focus:border-navy-900 focus:outline-none focus:ring-[3px] focus:ring-navy-900/[0.08]'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={id} className="block text-[12px] font-semibold uppercase tracking-[0.5px] text-stone-500">{label}</label>}
      <input id={id} className={clsx(inputClass, error && 'border-danger-600', className)} {...props} />
      {error && <p className="text-[12px] text-danger-600">{error}</p>}
    </div>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

export function Select({ label, options, className, id, ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={id} className="block text-[12px] font-semibold uppercase tracking-[0.5px] text-stone-500">{label}</label>}
      <select id={id} className={clsx(inputClass, 'pr-8', className)} {...props}>
        <option value="">Select...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export function Textarea({ label, className, id, ...props }: TextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={id} className="block text-[12px] font-semibold uppercase tracking-[0.5px] text-stone-500">{label}</label>}
      <textarea
        id={id}
        className={clsx(
          'block w-full rounded-[10px] border border-stone-200 bg-white px-3 py-2.5 text-[14px] shadow-none placeholder:text-stone-400 transition-all duration-150 focus:border-navy-900 focus:outline-none focus:ring-[3px] focus:ring-navy-900/[0.08]',
          className,
        )}
        rows={3}
        {...props}
      />
    </div>
  )
}
