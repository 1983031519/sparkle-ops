import { useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <div className="mb-4 text-center">
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0D1B3D' }}>sparkle</div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: '#0D1B3D' }}>STONE &amp; PAVERS</div>
          </div>
          <h1 className="text-[22px] font-bold text-navy-900">Welcome back</h1>
          <p className="mt-1 text-[13px] text-stone-500">Sign in to your operations portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-[20px] border border-black/[0.06] bg-white p-7 shadow-[0_2px_16px_rgba(0,0,0,0.05)]">
          <Input
            label="Email"
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
          <Input
            label="Password"
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Your password"
            required
          />

          {error && <p className="text-[13px] text-danger-600">{error}</p>}

          <Button type="submit" className="w-full h-[44px]" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  )
}
