/**
 * Reusable delete confirmation & warning dialogs.
 *
 * - DeleteConfirmDialog: "Delete X?" with Cancel + Delete buttons
 * - DeleteWarningDialog: "Cannot Delete" with linked-record list + Close button
 */
import { useEffect, type ReactNode } from 'react'
import { AlertTriangle, ShieldAlert } from 'lucide-react'

/* ── shared overlay + card ── */
function DialogShell({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)',
        zIndex: 10000,
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: 420, margin: '0 16px',
        background: 'white', borderRadius: 14,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        zIndex: 10001,
        animation: 'modalIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </>
  )
}

/* ── Confirm Dialog ── */
export interface DeleteConfirmProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message?: string
  loading?: boolean
}

export function DeleteConfirmDialog({ open, onClose, onConfirm, title, message, loading }: DeleteConfirmProps) {
  return (
    <DialogShell open={open} onClose={onClose}>
      <div style={{ padding: '24px 24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <AlertTriangle size={20} strokeWidth={1.75} color="#DC2626" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>{title}</h3>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
              {message || 'This action cannot be undone.'}
            </p>
          </div>
        </div>
      </div>
      <div style={{
        display: 'flex', gap: 10, justifyContent: 'flex-end',
        padding: '0 24px 20px',
      }}>
        <button
          onClick={onClose}
          disabled={loading}
          style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            border: '1px solid #D1D5DB', background: 'white', color: '#374151',
            cursor: 'pointer', transition: 'background 100ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: 'none', background: '#DC2626', color: 'white',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1, transition: 'opacity 100ms',
          }}
        >
          {loading ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </DialogShell>
  )
}

/* ── Warning Dialog ── */
export interface LinkedRecord {
  label: string
  href?: string
}

export interface DeleteWarningProps {
  open: boolean
  onClose: () => void
  title?: string
  message: string
  linkedRecords?: LinkedRecord[]
}

export function DeleteWarningDialog({ open, onClose, title, message, linkedRecords }: DeleteWarningProps) {
  return (
    <DialogShell open={open} onClose={onClose}>
      <div style={{ padding: '24px 24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <ShieldAlert size={20} strokeWidth={1.75} color="#D97706" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>{title || 'Cannot Delete'}</h3>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
              {message}
            </p>
          </div>
        </div>

        {linkedRecords && linkedRecords.length > 0 && (
          <div style={{
            marginTop: 14, padding: '10px 14px',
            background: '#F9FAFB', borderRadius: 8, border: '1px solid #E5E7EB',
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Linked records
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {linkedRecords.map((r, i) => (
                <li key={i} style={{ fontSize: 13, color: '#374151' }}>
                  • {r.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'flex-end',
        padding: '0 24px 20px',
      }}>
        <button
          onClick={onClose}
          style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            border: '1px solid #D1D5DB', background: 'white', color: '#374151',
            cursor: 'pointer', transition: 'background 100ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
        >
          Close
        </button>
      </div>
    </DialogShell>
  )
}
