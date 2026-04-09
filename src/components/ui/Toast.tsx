import { useEffect, useState, useCallback, createContext, useContext, type ReactNode } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts(ts => ts.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++nextId
    setToasts(ts => [...ts, { id, message, type }])
    setTimeout(() => removeToast(id), 4000)
  }, [removeToast])

  const value: ToastContextValue = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] space-y-2 no-print">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  return (
    <div
      className={`flex items-center gap-3 rounded-[12px] border px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-sm transition-all duration-250 ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
      } ${
        toast.type === 'success'
          ? 'border-success-600/20 bg-success-50 text-success-600'
          : 'border-danger-600/20 bg-danger-50 text-danger-600'
      }`}
    >
      {toast.type === 'success'
        ? <CheckCircle className="h-[18px] w-[18px] shrink-0" />
        : <XCircle className="h-[18px] w-[18px] shrink-0" />
      }
      <p className="text-[13px] font-semibold">{toast.message}</p>
      <button onClick={onClose} className="ml-2 shrink-0 rounded-full p-0.5 hover:bg-black/5">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
