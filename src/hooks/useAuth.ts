import { useState, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserRole, Profile } from '@/lib/database.types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) return null
      return data as Profile
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    let mounted = true

    // Force loading=false after 1.5s no matter what
    const safety = setTimeout(() => { if (mounted) setLoading(false) }, 1500)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      setLoading(false) // Unblock UI immediately
      // Profile in background
      if (session?.user) {
        const p = await fetchProfile(session.user.id)
        if (mounted) setProfile(p)
      }
    }).catch(() => {
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      if (!mounted) return
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) {
        fetchProfile(session.user.id).then(p => { if (mounted) setProfile(p) })
      } else {
        setProfile(null)
      }
    })

    return () => { mounted = false; clearTimeout(safety); subscription.unsubscribe() }
  }, [fetchProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (data.user) {
      setUser(data.user)
      // Don't await — let redirect happen immediately
      fetchProfile(data.user.id).then(p => {
        setProfile(p)
        if (p && !p.active) {
          supabase.auth.signOut()
          setUser(null)
          setProfile(null)
        }
      })
    }
    return data
  }, [fetchProfile])

  const signOut = useCallback(async () => {
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
    if (isOffice) return module !== 'users' && module !== 'reports' && module !== 'rocko'
    return module === 'jobs' || module === 'dashboard' || module === 'chat'
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
