import { useState, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('[Auth] Initializing...')

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.error('[Auth] getSession error:', error.message)
        } else {
          console.log('[Auth] Initial session:', session ? session.user.email : 'none')
          setUser(session?.user ?? null)
        }
      })
      .catch((err) => {
        console.error('[Auth] getSession failed:', err)
      })
      .finally(() => {
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] State change:', event, session?.user?.email ?? 'no user')
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    console.log('[Auth] Attempting sign in for:', email)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('[Auth] Sign in error:', error.message, error.status)
      throw error
    }
    console.log('[Auth] Sign in success:', data.user?.email)
    // Explicitly update state — don't rely on onAuthStateChange on mobile
    if (data.user) {
      setUser(data.user)
    }
    return data
  }, [])

  const signOut = useCallback(async () => {
    console.log('[Auth] Signing out')
    setUser(null)
    await supabase.auth.signOut()
  }, [])

  return { user, loading, signIn, signOut }
}
