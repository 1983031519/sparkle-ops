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
      className={`rounded-[20px] border-0 p-0 shadow-[0_20px_60px_rgba(0,0,0,0.15)] backdrop:bg-black/40 backdrop:backdrop-blur-[4px] ${wide ? 'max-w-4xl' : 'max-w-lg'} w-full animate-[modalIn_200ms_ease-out]`}
      style={{ animationFillMode: 'backwards' }}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200/60 bg-white px-6 py-4 rounded-t-[20px]">
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0D1B3D', letterSpacing: -0.3 }}>{title}</h2>
        <button onClick={onClose} className="rounded-full p-1.5 transition-all duration-150 hover:bg-stone-100">
          <X size={16} strokeWidth={1.5} className="text-stone-400" />
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </dialog>
  )
}
