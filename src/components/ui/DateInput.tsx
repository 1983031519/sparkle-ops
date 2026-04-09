import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { clsx } from 'clsx'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Format YYYY-MM-DD → MM/DD/YYYY for display */
function toDisplay(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

/** Parse MM/DD/YYYY → YYYY-MM-DD */
function toISO(display: string): string {
  const match = display.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return ''
  const [, m, d, y] = match
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

interface Props {
  label?: string
  id?: string
  value: string          // YYYY-MM-DD (ISO) — what gets stored
  onChange: (iso: string) => void
  required?: boolean
  placeholder?: string
}

export function DateInput({ label, id, value, onChange, required, placeholder = 'MM/DD/YYYY' }: Props) {
  const [open, setOpen] = useState(false)
  const [inputText, setInputText] = useState(toDisplay(value))
  const [viewYear, setViewYear] = useState(() => value ? parseInt(value.split('-')[0]) : new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.split('-')[1]) - 1 : new Date().getMonth())
  const ref = useRef<HTMLDivElement>(null)

  // Sync display when value prop changes externally
  useEffect(() => {
    setInputText(toDisplay(value))
    if (value) {
      const [y, m] = value.split('-')
      setViewYear(parseInt(y))
      setViewMonth(parseInt(m) - 1)
    }
  }, [value])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleInputChange(text: string) {
    setInputText(text)
    // Auto-convert when full date typed
    const iso = toISO(text)
    if (iso) onChange(iso)
  }

  function handleInputBlur() {
    const iso = toISO(inputText)
    if (iso) {
      onChange(iso)
    } else if (!inputText) {
      onChange('')
    } else {
      // Reset to last valid value
      setInputText(toDisplay(value))
    }
  }

  function selectDay(day: number) {
    const m = String(viewMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    const iso = `${viewYear}-${m}-${d}`
    onChange(iso)
    setOpen(false)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const totalDays = daysInMonth(viewYear, viewMonth)
  const startDow = firstDayOfWeek(viewYear, viewMonth)

  // Determine which day is selected in this view
  const selectedDay = (() => {
    if (!value) return -1
    const [sy, sm, sd] = value.split('-').map(Number)
    if (sy === viewYear && sm - 1 === viewMonth) return sd
    return -1
  })()

  const todayDay = (() => {
    const now = new Date()
    if (now.getFullYear() === viewYear && now.getMonth() === viewMonth) return now.getDate()
    return -1
  })()

  return (
    <div className="space-y-1" ref={ref}>
      {label && <label htmlFor={id} className="block text-[12px] font-semibold uppercase tracking-[0.5px] text-stone-500">{label}</label>}
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          value={inputText}
          onChange={e => handleInputChange(e.target.value)}
          onBlur={handleInputBlur}
          onFocus={() => setOpen(true)}
          required={required}
          className="block w-full h-[40px] rounded-[10px] border border-stone-200 bg-white px-3 pr-10 text-[14px] shadow-none placeholder:text-stone-400 transition-all duration-150 focus:border-navy-900 focus:outline-none focus:ring-[3px] focus:ring-navy-900/[0.08]"
          autoComplete="off"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen(o => !o)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-stone-400 hover:text-stone-600"
        >
          <Calendar className="h-4 w-4" />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-[280px] rounded-[16px] border border-black/[0.06] bg-white p-3 shadow-[0_8px_30px_rgba(0,0,0,0.1)]">
            {/* Header */}
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={prevMonth} className="rounded p-1 hover:bg-stone-100">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold">{MONTHS[viewMonth]} {viewYear}</span>
              <button type="button" onClick={nextMonth} className="rounded p-1 hover:bg-stone-100">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 text-center text-[11px] font-medium text-stone-500">
              {DAYS.map(d => <div key={d} className="py-1">{d}</div>)}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7">
              {Array.from({ length: startDow }).map((_, i) => <div key={`blank-${i}`} />)}
              {Array.from({ length: totalDays }).map((_, i) => {
                const day = i + 1
                const isSelected = day === selectedDay
                const isToday = day === todayDay
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={clsx(
                      'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors',
                      isSelected && 'bg-navy-900 text-white font-bold',
                      !isSelected && isToday && 'ring-1 ring-gold-500 text-navy-900 font-medium',
                      !isSelected && !isToday && 'hover:bg-stone-100 text-stone-700',
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Today shortcut */}
            <div className="mt-2 border-t border-stone-100 pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  const now = new Date()
                  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                  onChange(iso)
                  setOpen(false)
                }}
                className="text-xs font-medium text-navy-900 hover:underline"
              >
                Today
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
