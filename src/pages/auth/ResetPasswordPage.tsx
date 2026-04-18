import { useState, type FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setSuccess(true)
      setTimeout(() => { window.location.href = '/login' }, 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setLoading(false)
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
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: -0.3 }}>Reset your password</h1>
          <p style={{ marginTop: 6, fontSize: 14, color: '#6B7280' }}>Enter a new password for your account</p>
        </div>

        {success ? (
          <div style={{
            background: 'white', borderRadius: 12, padding: 28,
            border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            textAlign: 'center',
          }}>
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" strokeWidth={1.5} />
            <p style={{ fontSize: 16, fontWeight: 600, color: '#059669', marginBottom: 6 }}>Password updated!</p>
            <p style={{ fontSize: 13, color: '#6B7280' }}>Redirecting to sign in…</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            action="#"
            method="POST"
            style={{
              background: 'white', borderRadius: 12, padding: 28,
              border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ marginBottom: 18 }}>
              <label htmlFor="new-password" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                New Password
              </label>
              <input
                id="new-password"
                name="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                style={{
                  display: 'block', width: '100%', height: 42, borderRadius: 8,
                  border: '1px solid #D1D5DB', background: 'white', padding: '0 12px',
                  fontSize: 16, outline: 'none', WebkitAppearance: 'none', boxSizing: 'border-box',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#4F6CF7'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,108,247,0.12)' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="confirm-password" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                Confirm Password
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                style={{
                  display: 'block', width: '100%', height: 42, borderRadius: 8,
                  border: '1px solid #D1D5DB', background: 'white', padding: '0 12px',
                  fontSize: 16, outline: 'none', WebkitAppearance: 'none', boxSizing: 'border-box',
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

            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: 42, borderRadius: 8, border: 'none',
                background: '#4F6CF7', color: 'white',
                fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.7 : 1, transition: 'opacity 150ms',
              }}
            >
              {loading ? 'Updating…' : 'Update Password'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <a href="/login" style={{ fontSize: 13, color: '#4F6CF7', textDecoration: 'none', fontWeight: 500 }}>
                Back to sign in
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
