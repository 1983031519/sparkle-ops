import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Users, Briefcase, FileText, Receipt, UsersRound, Package, BarChart3, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const NAVY = '#0D1B3D'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/estimates', icon: FileText, label: 'Estimates' },
  { to: '/invoices', icon: Receipt, label: 'Invoices' },
  { to: '/vendors', icon: UsersRound, label: 'Vendors & Team' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
]

export function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <aside
        className="no-print"
        style={{ width: 240, display: 'flex', flexDirection: 'column', backgroundColor: NAVY, minHeight: '100vh' }}
      >
        <div style={{ backgroundColor: NAVY, padding: '20px 20px 16px', borderBottom: '1px solid rgba(200,169,110,0.2)' }}>
          <img src="/logo-white.png" alt="Sparkle Stone & Pavers" style={{ width: 150, height: 'auto', maxHeight: 48, display: 'block', objectFit: 'contain' }} />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                isActive ? 'nav-item nav-active' : 'nav-item nav-inactive'
              }
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 8,
                fontSize: 13, fontWeight: isActive ? 600 : 500,
                textDecoration: 'none',
                transition: 'all 150ms ease',
                color: isActive ? '#C8A96E' : 'rgba(255,255,255,0.65)',
                backgroundColor: isActive ? 'rgba(200,169,110,0.08)' : 'transparent',
                boxShadow: isActive ? 'inset 3px 0 0 #C8A96E' : 'none',
              })}
              onMouseEnter={e => {
                const el = e.currentTarget
                if (!el.classList.contains('nav-active')) {
                  el.style.color = 'white'
                  el.style.backgroundColor = 'rgba(255,255,255,0.06)'
                }
              }}
              onMouseLeave={e => {
                const el = e.currentTarget
                if (!el.classList.contains('nav-active')) {
                  el.style.color = 'rgba(255,255,255,0.65)'
                  el.style.backgroundColor = 'transparent'
                }
              }}
            >
              <Icon size={18} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + Sign Out */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px' }}>
          {user?.email && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
          )}
          <button
            onClick={signOut}
            style={{
              display: 'flex', width: '100%', alignItems: 'center', gap: 10,
              padding: '8px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.5)',
              backgroundColor: 'transparent', transition: 'all 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <LogOut size={16} strokeWidth={1.5} />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto" style={{ backgroundColor: '#FAFAF7' }}>
        <Outlet />
      </main>
    </div>
  )
}
