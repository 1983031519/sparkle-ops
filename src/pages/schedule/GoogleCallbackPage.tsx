import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { exchangeCode } from '@/lib/googleCalendar'
import { useToast } from '@/components/ui/Toast'

export default function GoogleCallbackPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [status, setStatus] = useState<'working' | 'ok' | 'error'>('working')
  const [message, setMessage] = useState<string>('Connecting to Google Calendar…')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    ;(async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const err = params.get('error')
      if (err) {
        setStatus('error'); setMessage(`Google returned an error: ${err}`)
        toast.error(`Google auth error: ${err}`)
        setTimeout(() => navigate('/schedule', { replace: true }), 2500)
        return
      }
      if (!code) {
        setStatus('error'); setMessage('Missing authorization code.')
        setTimeout(() => navigate('/schedule', { replace: true }), 2500)
        return
      }
      try {
        await exchangeCode(code)
        setStatus('ok'); setMessage('Google Calendar connected.')
        toast.success('Google Calendar connected')
        setTimeout(() => navigate('/schedule', { replace: true }), 800)
      } catch (e) {
        setStatus('error'); setMessage((e as Error).message)
        toast.error((e as Error).message)
        setTimeout(() => navigate('/schedule', { replace: true }), 3000)
      }
    })()
  }, [navigate, toast])

  const Icon = status === 'working' ? Loader2 : status === 'ok' ? CheckCircle2 : XCircle
  const color = status === 'working' ? '#4F6CF7' : status === 'ok' ? '#059669' : '#DC2626'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', padding: 24, textAlign: 'center',
    }}>
      <Icon
        className="h-12 w-12"
        strokeWidth={1.5}
        color={color}
        style={status === 'working' ? { animation: 'spin 900ms linear infinite' } : undefined}
      />
      <h2 className="text-title font-bold" style={{ color: '#111827', marginTop: 16 }}>
        {status === 'working' ? 'Connecting…' : status === 'ok' ? 'Connected' : 'Failed'}
      </h2>
      <p className="text-label" style={{ color: '#6B7280', marginTop: 6, maxWidth: 380 }}>{message}</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
