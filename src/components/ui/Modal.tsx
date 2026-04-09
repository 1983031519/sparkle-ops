import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}

export function Modal({ open, onClose, title, children, wide }: Props) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Overlay — fixed fullscreen */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          zIndex: 9998,
        }}
      />
      {/* Modal — fixed centered */}
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%', maxWidth: wide ? 896 : 512,
          maxHeight: '95vh',
          background: 'white', borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          zIndex: 9999,
          display: 'flex', flexDirection: 'column',
          animation: 'modalIn 200ms ease-out',
          margin: '0 16px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header — sticky */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.06)',
          borderRadius: '20px 20px 0 0', flexShrink: 0,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0D1B3D', letterSpacing: -0.3 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', padding: 6, borderRadius: 20, cursor: 'pointer', transition: 'background 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
          >
            <X size={16} strokeWidth={1.5} color="#9CA3AF" />
          </button>
        </div>
        {/* Body — scrollable */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </>
  )
}
