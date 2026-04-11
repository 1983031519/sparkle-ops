import { clsx } from 'clsx'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const inputBase = 'block w-full h-[40px] rounded-[8px] border border-[#D1D5DB] bg-white px-3 text-[14px] shadow-none placeholder:text-[#9CA3AF] transition-all duration-150 ease-out focus:border-[#4F6CF7] focus:outline-none focus:shadow-[0_0_0_3px_rgba(79,108,247,0.12)]'

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151' } as const

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={id} style={labelStyle}>{label}</label>}
      <input id={id} className={clsx(inputBase, error && 'border-[#EF4444]', className)} {...props} />
      {error && <p className="text-[12px] text-[#EF4444]">{error}</p>}
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
      {label && <label htmlFor={id} style={labelStyle}>{label}</label>}
      <select id={id} className={clsx(inputBase, 'pr-8', className)} {...props}>
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
      {label && <label htmlFor={id} style={labelStyle}>{label}</label>}
      <textarea
        id={id}
        className={clsx(
          'block w-full rounded-[8px] border border-[#D1D5DB] bg-white px-3 py-2.5 text-[14px] shadow-none placeholder:text-[#9CA3AF] transition-all duration-150 ease-out focus:border-[#4F6CF7] focus:outline-none focus:shadow-[0_0_0_3px_rgba(79,108,247,0.12)]',
          className,
        )}
        rows={3}
        {...props}
      />
    </div>
  )
}
