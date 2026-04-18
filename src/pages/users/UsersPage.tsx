import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, UserRole } from '@/lib/database.types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { UserPlus, Shield, ShieldCheck, Monitor, HardHat, Check, X } from 'lucide-react'

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bg: string; icon: typeof Shield }> = {
  admin:   { label: 'Admin',   color: '#7C3AED', bg: '#F5F3FF', icon: ShieldCheck },
  manager: { label: 'Manager', color: '#2563EB', bg: '#EFF6FF', icon: Shield },
  office:  { label: 'Office',  color: '#059669', bg: '#ECFDF5', icon: Monitor },
  field:   { label: 'Field',   color: '#D97706', bg: '#FFFBEB', icon: HardHat },
}

const ROLES: UserRole[] = ['admin', 'manager', 'office', 'field']

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('field')
  const [inviting, setInviting] = useState(false)
  const toast = useToast()

  const fetchProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) {
      console.error('Failed to fetch profiles:', error)
      return
    }
    setProfiles(data as Profile[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  const handleRoleChange = async (profileId: string, newRole: UserRole) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() } as never)
      .eq('id', profileId)
    if (error) {
      toast.error('Failed to update role')
      return
    }
    toast.success('Role updated')
    fetchProfiles()
  }

  const handleToggleActive = async (profileId: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ active: !currentActive, updated_at: new Date().toISOString() } as never)
      .eq('id', profileId)
    if (error) {
      toast.error('Failed to update status')
      return
    }
    toast.success(currentActive ? 'User deactivated' : 'User reactivated')
    fetchProfiles()
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { toast.error('Email is required'); return }
    setInviting(true)
    try {
      // Use Supabase admin invite (sends magic link email)
      const { error } = await supabase.auth.admin.inviteUserByEmail(inviteEmail.trim(), {
        data: { full_name: inviteName.trim(), role: inviteRole },
        redirectTo: `${window.location.origin}/login`,
      })
      if (error) {
        // Fallback: if admin API not available, use signUp with auto-confirm off
        // The user will get a confirmation email
        if (error.message.includes('not authorized') || error.message.includes('admin')) {
          const { error: signUpError } = await supabase.auth.signUp({
            email: inviteEmail.trim(),
            password: crypto.randomUUID(), // Temporary — user resets via email
            options: {
              data: { full_name: inviteName.trim(), role: inviteRole },
              emailRedirectTo: `${window.location.origin}/login`,
            },
          })
          if (signUpError) throw signUpError
          toast.success('Invitation sent! User will receive a confirmation email.')
        } else {
          throw error
        }
      } else {
        toast.success('Invitation sent!')
      }
      setShowInvite(false)
      setInviteEmail('')
      setInviteName('')
      setInviteRole('field')
      // Refresh after a short delay to let the trigger create the profile
      setTimeout(fetchProfiles, 2000)
    } catch (err) {
      console.error('Invite error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading users...</div>
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 960 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: '#6B7280' }}>Manage team access and roles</p>
        <Button onClick={() => setShowInvite(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <UserPlus className="h-4 w-4" strokeWidth={1.5} />
          Invite User
        </Button>
      </div>

      {/* Role Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {ROLES.map(r => {
          const cfg = ROLE_CONFIG[r]
          return (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: cfg.color }} />
              <span style={{ fontWeight: 500 }}>{cfg.label}</span>
            </div>
          )
        })}
      </div>

      {/* Users List */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 140px 100px 80px',
          gap: 12, padding: '12px 20px', fontSize: 11, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: 0.5, color: '#9CA3AF',
          borderBottom: '1px solid #F3F4F6',
        }}>
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Status</span>
          <span></span>
        </div>

        {profiles.map((p) => {
          const cfg = ROLE_CONFIG[p.role as UserRole] ?? ROLE_CONFIG.field
          const RoleIcon = cfg.icon
          return (
            <div
              key={p.id}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 140px 100px 80px',
                gap: 12, padding: '14px 20px', alignItems: 'center',
                borderBottom: '1px solid #F9FAFB',
                opacity: p.active ? 1 : 0.5,
              }}
            >
              {/* Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <RoleIcon className="h-4 w-4" strokeWidth={1.5} color={cfg.color} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>
                  {p.full_name || 'No name'}
                </span>
              </div>

              {/* Email */}
              <span style={{ fontSize: 13, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.email}
              </span>

              {/* Role Dropdown */}
              <select
                value={p.role}
                onChange={e => handleRoleChange(p.id, e.target.value as UserRole)}
                style={{
                  fontSize: 13, fontWeight: 500, color: cfg.color,
                  background: cfg.bg, border: `1px solid ${cfg.color}22`,
                  borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                ))}
              </select>

              {/* Active Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {p.active ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: '#059669' }}>
                    <Check className="h-4 w-4" strokeWidth={1.5} /> Active
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: '#9CA3AF' }}>
                    <X className="h-4 w-4" strokeWidth={2} /> Inactive
                  </span>
                )}
              </div>

              {/* Toggle Button */}
              <button
                onClick={() => handleToggleActive(p.id, p.active)}
                style={{
                  fontSize: 12, fontWeight: 500, padding: '4px 10px',
                  borderRadius: 6, border: '1px solid #E5E7EB', cursor: 'pointer',
                  background: 'white', color: p.active ? '#DC2626' : '#059669',
                  transition: 'all 150ms',
                }}
              >
                {p.active ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          )
        })}

        {profiles.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
            No users yet. Invite your first team member.
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite User">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6B7280', marginBottom: 6 }}>
              Full Name
            </label>
            <input
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
              placeholder="John Smith"
              style={{
                display: 'block', width: '100%', height: 40, borderRadius: 10,
                border: '1px solid #E5E7EB', padding: '0 12px', fontSize: 14, outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6B7280', marginBottom: 6 }}>
              Email *
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="john@sparkle.com"
              style={{
                display: 'block', width: '100%', height: 40, borderRadius: 10,
                border: '1px solid #E5E7EB', padding: '0 12px', fontSize: 14, outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6B7280', marginBottom: 6 }}>
              Role
            </label>
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as UserRole)}
              style={{
                display: 'block', width: '100%', height: 40, borderRadius: 10,
                border: '1px solid #E5E7EB', padding: '0 12px', fontSize: 14, outline: 'none',
                cursor: 'pointer',
              }}
            >
              {ROLES.map(r => (
                <option key={r} value={r}>{ROLE_CONFIG[r].label} — {
                  r === 'admin' ? 'Full access + user management' :
                  r === 'manager' ? 'Full access, no user management' :
                  r === 'office' ? 'Operational modules, no reports' :
                  'Jobs only'
                }</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
