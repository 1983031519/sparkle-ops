import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}

export function Modal({ open, onClose, title, children, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    else if (!open && el.open) el.close()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className={`rounded-xl shadow-xl border-0 p-0 backdrop:bg-black/40 ${wide ? 'max-w-4xl' : 'max-w-lg'} w-full`}
    >
      <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
        <button onClick={onClose} className="rounded-lg p-1 hover:bg-stone-100">
          <X className="h-5 w-5 text-stone-500" />
        </button>
      </div>
      <div className="px-6 py-4">{children}</div>
    </dialog>
  )
}
