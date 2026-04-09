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
    console.log('[Login] Submitting for:', trimmedEmail)
    try {
      await signIn(trimmedEmail, password)
      console.log('[Login] Success — redirecting to /')
      // Force navigation — don't rely on React state across hook instances
      window.location.href = '/'
    } catch (err: unknown) {
      console.error('[Login] Auth error:', err)
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
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#FAFAF7', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="/logo-dark.png"
            alt="Sparkle Stone & Pavers"
            style={{ width: 160, height: 'auto', display: 'block', margin: '0 auto 16px' }}
          />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D1B3D', letterSpacing: -0.5 }}>Welcome back</h1>
          <p style={{ marginTop: 4, fontSize: 13, color: '#6B7280' }}>Sign in to your operations portal</p>
        </div>

        <form
          onSubmit={handleSubmit}
          action="#"
          method="POST"
          style={{
            background: 'white', borderRadius: 20, padding: 28,
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="email" style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6B7280', marginBottom: 6 }}>Email</label>
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
                display: 'block', width: '100%', height: 44, borderRadius: 10,
                border: '1px solid #E5E3DF', background: 'white', padding: '0 12px',
                fontSize: 16, /* 16px prevents iOS zoom */
                outline: 'none', WebkitAppearance: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#0D1B3D'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13,27,61,0.08)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E5E3DF'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="password" style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6B7280', marginBottom: 6 }}>Password</label>
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
                display: 'block', width: '100%', height: 44, borderRadius: 10,
                border: '1px solid #E5E3DF', background: 'white', padding: '0 12px',
                fontSize: 16,
                outline: 'none', WebkitAppearance: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#0D1B3D'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13,27,61,0.08)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E5E3DF'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>

          {error && (
            <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 10, padding: '10px 14px', marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: '#E11D48', fontWeight: 500 }}>{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" style={{ height: 44 }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  )
}
