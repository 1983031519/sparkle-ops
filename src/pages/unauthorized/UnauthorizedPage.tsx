import { useNavigate } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function UnauthorizedPage() {
  const navigate = useNavigate()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 32, textAlign: 'center' }}>
      <ShieldX className="h-12 w-12 text-gray-400" strokeWidth={1.5} style={{ marginBottom: 16 }} />
      <h1 className="text-title font-bold" style={{ color: '#111827', marginBottom: 8 }}>Access Restricted</h1>
      <p className="text-body" style={{ color: '#6B7280', maxWidth: 400, marginBottom: 24 }}>
        You don't have permission to access this page. Contact your admin if you believe this is an error.
      </p>
      <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
    </div>
  )
}
