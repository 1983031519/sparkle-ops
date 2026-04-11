import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, Briefcase, FileText, FolderOpen, Receipt, UsersRound, Package, BarChart3, Shield, Bot, MessageSquare, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { GlobalSearch } from '@/components/GlobalSearch'
import { useChatContext } from '@/contexts/ChatContext'

const NAVY = '#0D1B3D'

const allNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', module: 'dashboard' },
  { to: '/clients', icon: Users, label: 'Clients', module: 'clients' },
  { to: '/jobs', icon: Briefcase, label: 'Jobs', module: 'jobs' },
  { to: '/estimates', icon: FileText, label: 'Estimates', module: 'estimates' },
  { to: '/projects', icon: FolderOpen, label: 'Projects', module: 'projects' },
  { to: '/invoices', icon: Receipt, label: 'Invoices', module: 'invoices' },
  { to: '/vendors', icon: UsersRound, label: 'Vendors & Team', module: 'vendors' },
  { to: '/inventory', icon: Package, label: 'Inventory', module: 'inventory' },
  { to: '/reports', icon: BarChart3, label: 'Reports', module: 'reports' },
  { to: '/rocko', icon: Bot, label: 'Rocko AI', module: 'rocko' },
  { to: '/users', icon: Shield, label: 'Users', module: 'users' },
  { to: '/chat', icon: MessageSquare, label: 'Chat', module: 'chat' },
]

// Bottom nav: derived inside component from visibleNav
// bottomNav derived inside Layout from visibleNav

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
  const { user, signOut, canAccessModule } = useAuth()
  const { unreadCount } = useChatContext()
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const visibleNav = allNav.filter(n => canAccessModule(n.module))
  const bottomNav = visibleNav.slice(0, 5)
  const location = useLocation()
  // Don't show badge while actively viewing chat
  const chatBadge = location.pathname === '/chat' ? 0 : unreadCount

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <GlobalSearch mobile />
            <button onClick={() => setDrawerOpen(true)} style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer' }}>
              <Menu size={22} strokeWidth={1.5} color={NAVY} />
            </button>
          </div>
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
          {bottomNav.map(({ to, icon: Icon, label, img }: typeof allNav[number] & { img?: string }) => (
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
              {img ? <img src={img} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} /> : <Icon size={20} strokeWidth={1.5} />}
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
                {visibleNav.map(({ to, icon: Icon, label, img }: typeof allNav[number] & { img?: string }) => {
                  const isChat = to === '/chat'
                  return (
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
                      {img ? <img src={img} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} /> : <Icon size={18} strokeWidth={1.5} />}
                      {isChat ? (
                        <>
                          <span style={{ flex: 1 }}>{label}</span>
                          {chatBadge > 0 && (
                            <span style={{
                              background: '#ef4444', color: 'white',
                              fontSize: 10, fontWeight: 700, lineHeight: 1,
                              padding: '3px 6px', borderRadius: 99,
                              minWidth: 18, textAlign: 'center',
                            }}>
                              {chatBadge > 99 ? '99+' : chatBadge}
                            </span>
                          )}
                        </>
                      ) : label}
                    </NavLink>
                  )
                })}
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
          <img src="/logo-white.png" alt="Sparkle Stone & Pavers" style={{ width: 195, height: 'auto', maxHeight: 60, display: 'block', objectFit: 'contain' }} />
        </div>
        <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visibleNav.map(({ to, icon: Icon, label, img }: typeof allNav[number] & { img?: string }) => {
            const isChat = to === '/chat'
            return (
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
                {img ? <img src={img} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} /> : <Icon size={18} strokeWidth={1.5} />}
                {isChat ? (
                  <>
                    <span style={{ flex: 1 }}>{label}</span>
                    {chatBadge > 0 && (
                      <span style={{
                        background: '#ef4444', color: 'white',
                        fontSize: 10, fontWeight: 700, lineHeight: 1,
                        padding: '3px 6px', borderRadius: 99,
                        minWidth: 18, textAlign: 'center',
                      }}>
                        {chatBadge > 99 ? '99+' : chatBadge}
                      </span>
                    )}
                  </>
                ) : label}
              </NavLink>
            )
          })}
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar with search */}
        <header className="no-print" style={{
          height: 56, display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
          padding: '0 24px', background: 'white', borderBottom: '1px solid rgba(0,0,0,0.06)',
          flexShrink: 0,
        }}>
          <GlobalSearch />
        </header>
        <main style={{ flex: 1, overflow: 'auto', backgroundColor: '#FAFAF7' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
