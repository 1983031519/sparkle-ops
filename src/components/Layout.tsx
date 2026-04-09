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
        {/* Logo — single img, no filter, no fallback */}
        <div style={{ backgroundColor: NAVY, padding: '20px 20px 12px' }}>
          <img src="/logo-white.svg" alt="Sparkle Stone & Pavers" style={{ width: 160, height: 'auto', display: 'block' }} />
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
                fontSize: 13, fontWeight: 500,
                textDecoration: 'none',
                transition: 'all 150ms',
                borderLeft: isActive ? '3px solid #C8A96E' : '3px solid transparent',
                paddingLeft: isActive ? 9 : 12,
                color: isActive ? '#C8A96E' : 'rgba(255,255,255,0.65)',
                backgroundColor: isActive ? 'rgba(200,169,110,0.1)' : 'transparent',
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
              <Icon style={{ width: 18, height: 18 }} />
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
            <LogOut style={{ width: 16, height: 16 }} />
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
