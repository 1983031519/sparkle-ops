import { useState, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserRole, Profile } from '@/lib/database.types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      console.error('[Auth] Profile fetch error:', error.message)
      return null
    }
    return data as Profile
  }, [])

  useEffect(() => {
    console.log('[Auth] Initializing...')

    supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        if (error) {
          console.error('[Auth] getSession error:', error.message)
        } else {
          console.log('[Auth] Initial session:', session ? session.user.email : 'none')
          setUser(session?.user ?? null)
          if (session?.user) {
            const p = await fetchProfile(session.user.id)
            setProfile(p)
          }
        }
      })
      .catch((err) => {
        console.error('[Auth] getSession failed:', err)
      })
      .finally(() => {
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] State change:', event, session?.user?.email ?? 'no user')
      setUser(session?.user ?? null)
      if (session?.user) {
        const p = await fetchProfile(session.user.id)
        setProfile(p)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    console.log('[Auth] Attempting sign in for:', email)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('[Auth] Sign in error:', error.message, error.status)
      throw error
    }
    console.log('[Auth] Sign in success:', data.user?.email)
    if (data.user) {
      setUser(data.user)
      const p = await fetchProfile(data.user.id)
      setProfile(p)
      // If account is deactivated, sign them out
      if (p && !p.active) {
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        throw new Error('Your account has been deactivated. Contact your admin.')
      }
    }
    return data
  }, [fetchProfile])

  const signOut = useCallback(async () => {
    console.log('[Auth] Signing out')
    setUser(null)
    setProfile(null)
    await supabase.auth.signOut()
  }, [])

  const role: UserRole = profile?.role ?? 'field'
  const isAdmin = role === 'admin'
  const isManager = role === 'manager'
  const isOffice = role === 'office'
  const isField = role === 'field'

  // Permission helpers
  const canAccessModule = (module: string): boolean => {
    if (isAdmin) return true
    if (isManager) return module !== 'users'
    if (isOffice) return module !== 'users' && module !== 'reports'
    // Field: only jobs and dashboard
    return module === 'jobs' || module === 'dashboard'
  }

  const canCreate = isAdmin || isManager || isOffice
  const canEdit = isAdmin || isManager || isOffice
  const canDelete = isAdmin || isManager

  return {
    user,
    profile,
    loading,
    role,
    isAdmin,
    isManager,
    isOffice,
    isField,
    canAccessModule,
    canCreate,
    canEdit,
    canDelete,
    signIn,
    signOut,
  }
}
