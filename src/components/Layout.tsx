import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, Briefcase, FileText, Receipt, UsersRound, Package, BarChart3, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const NAVY = '#0D1B3D'

const allNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/estimates', icon: FileText, label: 'Estimates' },
  { to: '/invoices', icon: Receipt, label: 'Invoices' },
  { to: '/vendors', icon: UsersRound, label: 'Vendors & Team' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
]

// Bottom nav: 5 most important
const bottomNav = allNav.slice(0, 5)

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return mobile
}

export function Layout() {
  const { user, signOut } = useAuth()
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  // Close drawer on navigation
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  /* ─── MOBILE ─── */
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Top bar */}
        <header className="no-print" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 56, padding: '0 16px', background: 'white',
          borderBottom: '1px solid #F3F4F6', position: 'sticky', top: 0, zIndex: 40,
        }}>
          <img src="/logo-dark.png" alt="Sparkle" style={{ height: 28, width: 'auto' }} />
          <button onClick={() => setDrawerOpen(true)} style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer' }}>
            <Menu size={22} strokeWidth={1.5} color={NAVY} />
          </button>
        </header>

        {/* Content */}
        <main style={{ flex: 1, background: '#FAFAF7', paddingBottom: 70, overflowX: 'hidden' }}>
          <Outlet />
        </main>

        {/* Bottom nav */}
        <nav className="no-print" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          display: 'flex', height: 60, background: 'white',
          borderTop: '1px solid #F3F4F6',
        }}>
          {bottomNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, textDecoration: 'none', fontSize: 10, fontWeight: 500,
                color: isActive ? '#C8A96E' : '#9CA3AF',
                transition: 'color 150ms',
              })}
            >
              <Icon size={20} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Drawer overlay */}
        {drawerOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setDrawerOpen(false)}>
            {/* Backdrop */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} />
            {/* Drawer */}
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', top: 0, left: 0, bottom: 0, width: 280,
                background: NAVY, display: 'flex', flexDirection: 'column',
                animation: 'slideIn 200ms ease-out',
              }}
            >
              {/* Drawer header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px', borderBottom: '1px solid rgba(200,169,110,0.2)' }}>
                <img src="/logo-white.png" alt="Sparkle" style={{ height: 32, width: 'auto' }} />
                <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer' }}>
                  <X size={20} strokeWidth={1.5} color="rgba(255,255,255,0.6)" />
                </button>
              </div>
              {/* Drawer nav */}
              <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {allNav.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to} to={to} end={to === '/'}
                    style={({ isActive }) => ({
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 12px', borderRadius: 8,
                      fontSize: 14, fontWeight: isActive ? 600 : 500,
                      textDecoration: 'none', transition: 'all 150ms',
                      color: isActive ? '#C8A96E' : 'rgba(255,255,255,0.65)',
                      backgroundColor: isActive ? 'rgba(200,169,110,0.08)' : 'transparent',
                      boxShadow: isActive ? 'inset 3px 0 0 #C8A96E' : 'none',
                    })}
                  >
                    <Icon size={18} strokeWidth={1.5} />
                    {label}
                  </NavLink>
                ))}
              </nav>
              {/* Drawer footer */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px' }}>
                {user?.email && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>}
                <button onClick={signOut} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.5)', backgroundColor: 'transparent' }}>
                  <LogOut size={16} strokeWidth={1.5} /> Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ─── DESKTOP ─── */
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <aside className="no-print" style={{ width: 240, display: 'flex', flexDirection: 'column', backgroundColor: NAVY, minHeight: '100vh' }}>
        <div style={{ backgroundColor: NAVY, padding: '20px 20px 16px', borderBottom: '1px solid rgba(200,169,110,0.2)' }}>
          <img src="/logo-white.png" alt="Sparkle Stone & Pavers" style={{ width: 150, height: 'auto', maxHeight: 48, display: 'block', objectFit: 'contain' }} />
        </div>
        <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {allNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to} end={to === '/'}
              className={({ isActive }) => isActive ? 'nav-item nav-active' : 'nav-item nav-inactive'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 8,
                fontSize: 13, fontWeight: isActive ? 600 : 500,
                textDecoration: 'none', transition: 'all 150ms ease',
                color: isActive ? '#C8A96E' : 'rgba(255,255,255,0.65)',
                backgroundColor: isActive ? 'rgba(200,169,110,0.08)' : 'transparent',
                boxShadow: isActive ? 'inset 3px 0 0 #C8A96E' : 'none',
              })}
              onMouseEnter={e => { const el = e.currentTarget; if (!el.classList.contains('nav-active')) { el.style.color = 'white'; el.style.backgroundColor = 'rgba(255,255,255,0.06)' } }}
              onMouseLeave={e => { const el = e.currentTarget; if (!el.classList.contains('nav-active')) { el.style.color = 'rgba(255,255,255,0.65)'; el.style.backgroundColor = 'transparent' } }}
            >
              <Icon size={18} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px' }}>
          {user?.email && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>}
          <button onClick={signOut} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '8px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.5)', backgroundColor: 'transparent', transition: 'all 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <LogOut size={16} strokeWidth={1.5} /> Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto" style={{ backgroundColor: '#FAFAF7' }}>
        <Outlet />
      </main>
    </div>
  )
}
