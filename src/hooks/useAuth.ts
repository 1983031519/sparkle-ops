import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserRole, Profile } from '@/lib/database.types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const loadingDone = useRef(false)

  // Safe way to set loading false — only once
  const finishLoading = useCallback(() => {
    if (!loadingDone.current) {
      loadingDone.current = true
      setLoading(false)
      console.log('[Auth] Loading complete')
    }
  }, [])

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
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
    } catch (err) {
      console.error('[Auth] Profile fetch exception:', err)
      return null
    }
  }, [])

  useEffect(() => {
    console.log('[Auth] Initializing...')

    // Safety timeout — if loading hasn't resolved in 3 seconds, force it
    const timeout = setTimeout(() => {
      console.warn('[Auth] Safety timeout — forcing loading=false')
      finishLoading()
    }, 3000)

    // Get session + profile
    supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        if (error) {
          console.error('[Auth] getSession error:', error.message)
        } else {
          console.log('[Auth] Session:', session ? session.user.email : 'none')
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
        finishLoading()
      })

    // Listen for future auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip INITIAL_SESSION — we handle that above via getSession
      if (event === 'INITIAL_SESSION') return

      console.log('[Auth] State change:', event, session?.user?.email ?? 'no user')
      setUser(session?.user ?? null)
      if (session?.user) {
        const p = await fetchProfile(session.user.id)
        setProfile(p)
      } else {
        setProfile(null)
      }
      finishLoading()
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [fetchProfile, finishLoading])

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

  const role: UserRole = profile?.role ?? 'admin'
  const isAdmin = role === 'admin'
  const isManager = role === 'manager'
  const isOffice = role === 'office'
  const isField = role === 'field'

  const canAccessModule = (module: string): boolean => {
    if (!profile) return true
    if (isAdmin) return true
    if (isManager) return module !== 'users'
    if (isOffice) return module !== 'users' && module !== 'reports'
    return module === 'jobs' || module === 'dashboard'
  }

  const canCreate = !profile || isAdmin || isManager || isOffice
  const canEdit = !profile || isAdmin || isManager || isOffice
  const canDelete = !profile || isAdmin || isManager

  return {
    user, profile, loading, role,
    isAdmin, isManager, isOffice, isField,
    canAccessModule, canCreate, canEdit, canDelete,
    signIn, signOut,
  }
}
