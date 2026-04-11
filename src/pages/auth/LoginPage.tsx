import { useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim()
    if (!trimmedEmail) { setError('Please enter your email.'); return }
    if (!password) { setError('Please enter your password.'); return }

    setLoading(true)
    try {
      await signIn(trimmedEmail, password)
      window.location.href = '/'
    } catch (err: unknown) {
      setLoading(false)
      const msg = err instanceof Error ? err.message : 'Sign in failed'
      if (msg.includes('Invalid login')) {
        setError('Incorrect email or password. Please try again.')
      } else if (msg.includes('Email not confirmed')) {
        setError('Please confirm your email address before signing in.')
      } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) {
        setError('Network error. Please check your internet connection.')
      } else {
        setError(msg)
      }
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F8F9FC', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="/logo-dark.png"
            alt="Sparkle Stone & Pavers"
            style={{ width: 160, height: 'auto', display: 'block', margin: '0 auto 20px' }}
          />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: -0.3 }}>Welcome back</h1>
          <p style={{ marginTop: 6, fontSize: 14, color: '#6B7280' }}>Sign in to your operations portal</p>
        </div>

        <form
          onSubmit={handleSubmit}
          action="#"
          method="POST"
          style={{
            background: 'white', borderRadius: 12, padding: 28,
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="email" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Email</label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              enterKeyHint="next"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                display: 'block', width: '100%', height: 42, borderRadius: 8,
                border: '1px solid #D1D5DB', background: 'white', padding: '0 12px',
                fontSize: 16,
                outline: 'none', WebkitAppearance: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#4F6CF7'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,108,247,0.12)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="password" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              enterKeyHint="go"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              style={{
                display: 'block', width: '100%', height: 42, borderRadius: 8,
                border: '1px solid #D1D5DB', background: 'white', padding: '0 12px',
                fontSize: 16,
                outline: 'none', WebkitAppearance: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#4F6CF7'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,108,247,0.12)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 18 }}>
              <p style={{ fontSize: 13, color: '#DC2626', fontWeight: 500 }}>{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" style={{ height: 42 }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  )
}
