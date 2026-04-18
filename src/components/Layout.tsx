import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Briefcase, FileText, FolderOpen, Receipt,
  UsersRound, Package, BarChart3, Shield, Bot, MessageSquare,
  LogOut, Menu, X, Bell, ChevronDown, Calendar,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { GlobalSearch } from '@/components/GlobalSearch'
import { useChatContext } from '@/contexts/ChatContext'

/* ── Nav structure with section labels ── */
const navGroups = [
  {
    label: null,
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', module: 'dashboard' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { to: '/clients',   icon: Users,      label: 'Clients',       module: 'clients'   },
      { to: '/jobs',      icon: Briefcase,  label: 'Jobs',          module: 'jobs'      },
      { to: '/schedule',  icon: Calendar,   label: 'Schedule',      module: 'schedule'  },
      { to: '/estimates', icon: FileText,   label: 'Estimates',     module: 'estimates' },
      { to: '/projects',  icon: FolderOpen, label: 'Projects',      module: 'projects'  },
      { to: '/invoices',  icon: Receipt,    label: 'Invoices',      module: 'invoices'  },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { to: '/vendors',   icon: UsersRound, label: 'Vendors & Team', module: 'vendors'   },
      { to: '/inventory', icon: Package,    label: 'Inventory',      module: 'inventory' },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      { to: '/reports', icon: BarChart3, label: 'Reports', module: 'reports' },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { to: '/rocko', icon: Bot,           label: 'Rocko AI', module: 'rocko' },
      { to: '/users', icon: Shield,        label: 'Users',    module: 'users' },
      { to: '/chat',  icon: MessageSquare, label: 'Chat',     module: 'chat'  },
    ],
  },
]

const allNavFlat = navGroups.flatMap(g => g.items)

/* ── Page title map ── */
const pageTitles: Record<string, string> = {
  '/': 'Dashboard', '/clients': 'Clients', '/jobs': 'Jobs',
  '/estimates': 'Estimates', '/schedule': 'Schedule', '/projects': 'Projects', '/invoices': 'Invoices',
  '/vendors': 'Vendors & Team', '/inventory': 'Inventory', '/reports': 'Reports',
  '/rocko': 'Rocko AI', '/users': 'Users', '/chat': 'Messages',
}

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

/* ── Avatar + dropdown ── */
function UserMenu({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const initial = (email?.[0] ?? 'U').toUpperCase()

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '4px 8px', borderRadius: 8,
          transition: 'background 100ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: '#4F6CF7', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 600, flexShrink: 0,
        }}>
          {initial}
        </div>
        <ChevronDown className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: 'white', border: '1px solid #E5E7EB', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.10)', zIndex: 999, minWidth: 200,
          padding: '6px',
        }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #F3F4F6', marginBottom: 4 }}>
            <p style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</p>
          </div>
          <button
            onClick={() => { setOpen(false); onSignOut() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '8px 12px', border: 'none', cursor: 'pointer', borderRadius: 6,
              fontSize: 13, fontWeight: 500, color: '#374151', background: 'transparent',
              transition: 'background 100ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <LogOut className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Desktop nav item ── */
function NavItem({ to, icon: Icon, label, isChat, chatBadge, canAccess }: {
  to: string; icon: typeof LayoutDashboard; label: string;
  isChat: boolean; chatBadge: number; canAccess: boolean
}) {
  if (!canAccess) return null
  return (
    <NavLink
      key={to} to={to} end={to === '/'}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 8,
        fontSize: 13, fontWeight: isActive ? 600 : 500,
        textDecoration: 'none', transition: 'all 100ms ease',
        color: isActive ? '#4F6CF7' : '#6B7280',
        background: isActive ? '#EEF1FE' : 'transparent',
        boxShadow: isActive ? 'inset 3px 0 0 #4F6CF7' : 'none',
      })}
      onMouseEnter={e => {
        const el = e.currentTarget
        if (!el.style.background.includes('EEF1FE')) {
          el.style.background = '#F9FAFB'
          el.style.color = '#374151'
        }
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        if (!el.style.background.includes('EEF1FE')) {
          el.style.background = 'transparent'
          el.style.color = '#6B7280'
        }
      }}
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} />
      {isChat ? (
        <>
          <span style={{ flex: 1 }}>{label}</span>
          {chatBadge > 0 && (
            <span style={{
              background: '#EF4444', color: 'white',
              fontSize: 10, fontWeight: 700, lineHeight: 1,
              padding: '3px 6px', borderRadius: 99, minWidth: 18, textAlign: 'center',
            }}>
              {chatBadge > 99 ? '99+' : chatBadge}
            </span>
          )}
        </>
      ) : label}
    </NavLink>
  )
}

export function Layout() {
  const { user, signOut, canAccessModule } = useAuth()
  const { unreadCount } = useChatContext()
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const visibleNavFlat = allNavFlat.filter(n => canAccessModule(n.module))
  // Mobile bottom nav: Dashboard, Clients, Jobs, Schedule, Chat
  const bottomNavModules = ['dashboard', 'clients', 'jobs', 'schedule']
  const bottomNav = [
    ...bottomNavModules
      .map(m => visibleNavFlat.find(n => n.module === m))
      .filter((n): n is typeof visibleNavFlat[number] => !!n),
    ...visibleNavFlat.filter(n => n.module === 'chat'),
  ]
  const location = useLocation()
  const chatBadge = unreadCount
  const pageTitle = pageTitles[location.pathname] ?? 'Sparkle Ops'

  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  /* ─── MOBILE ─── */
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <header className="no-print" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 56, padding: '0 16px', background: 'white',
          borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0, zIndex: 40,
        }}>
          <img src="/logo-dark.png" alt="Sparkle" style={{ height: 28, width: 'auto' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <GlobalSearch mobile />
            <button onClick={() => setDrawerOpen(true)} style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer' }}>
              <Menu className="h-6 w-6 text-gray-700" strokeWidth={1.5} />
            </button>
          </div>
        </header>

        <main style={{ flex: 1, background: '#F8F9FC', paddingBottom: 70, overflowX: 'hidden' }}>
          <Outlet />
        </main>

        {/* Bottom nav */}
        <nav className="no-print" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          display: 'flex', height: 60, background: 'white',
          borderTop: '1px solid #E5E7EB',
        }}>
          {bottomNav.map(({ to, icon: Icon, label }) => {
            const isChatTab = to === '/chat'
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                style={({ isActive }) => ({
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 2, textDecoration: 'none', fontSize: 10, fontWeight: 500,
                  color: isActive ? '#4F6CF7' : '#9CA3AF',
                  transition: 'color 150ms', position: 'relative',
                })}
              >
                <div style={{ position: 'relative' }}>
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                  {isChatTab && chatBadge > 0 && (
                    <span style={{
                      position: 'absolute', top: -5, right: -10,
                      background: '#EF4444', color: 'white',
                      fontSize: 9, fontWeight: 700, lineHeight: 1,
                      padding: '2px 5px', borderRadius: 99, minWidth: 16, textAlign: 'center',
                    }}>
                      {chatBadge > 99 ? '99+' : chatBadge}
                    </span>
                  )}
                </div>
                {label}
              </NavLink>
            )
          })}
        </nav>

        {/* Drawer */}
        {drawerOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setDrawerOpen(false)}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} />
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', top: 0, left: 0, bottom: 0, width: 280,
                background: 'white', display: 'flex', flexDirection: 'column',
                animation: 'slideIn 200ms ease-out', borderRight: '1px solid #E5E7EB',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px', borderBottom: '1px solid #E5E7EB' }}>
                <img src="/logo-dark.png" alt="Sparkle" style={{ height: 30, width: 'auto' }} />
                <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer' }}>
                  <X className="h-5 w-5 text-gray-500" strokeWidth={2} />
                </button>
              </div>
              <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
                {navGroups.map((group, gi) => (
                  <div key={gi}>
                    {group.label && (
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.08em', padding: '10px 12px 4px', textTransform: 'uppercase' }}>
                        {group.label}
                      </p>
                    )}
                    {group.items.map(({ to, icon: Icon, label, module }) => {
                      if (!canAccessModule(module)) return null
                      const isChat = to === '/chat'
                      const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
                      return (
                        <NavLink
                          key={to} to={to} end={to === '/'}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 12px', borderRadius: 8,
                            fontSize: 14, fontWeight: isActive ? 600 : 500,
                            textDecoration: 'none',
                            color: isActive ? '#4F6CF7' : '#6B7280',
                            background: isActive ? '#EEF1FE' : 'transparent',
                            boxShadow: isActive ? 'inset 3px 0 0 #4F6CF7' : 'none',
                          }}
                        >
                          <Icon className="h-5 w-5" strokeWidth={1.5} />
                          {isChat ? (
                            <>
                              <span style={{ flex: 1 }}>{label}</span>
                              {chatBadge > 0 && (
                                <span style={{ background: '#EF4444', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 6px', borderRadius: 99 }}>
                                  {chatBadge > 99 ? '99+' : chatBadge}
                                </span>
                              )}
                            </>
                          ) : label}
                        </NavLink>
                      )
                    })}
                  </div>
                ))}
              </nav>
              <div style={{ borderTop: '1px solid #E5E7EB', padding: '12px 16px' }}>
                {user?.email && <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>}
                <button onClick={signOut} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#6B7280', backgroundColor: 'transparent' }}>
                  <LogOut className="h-4 w-4" strokeWidth={1.5} /> Sign Out
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
      {/* Sidebar */}
      <aside className="no-print" style={{
        width: 220, display: 'flex', flexDirection: 'column',
        background: '#FFFFFF', borderRight: '1px solid #E5E7EB',
        minHeight: '100vh', flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #E5E7EB' }}>
          <img src="/logo-dark.png" alt="Sparkle Stone & Pavers" style={{ width: 160, height: 'auto', maxHeight: 48, display: 'block', objectFit: 'contain' }} />
        </div>

        {/* Nav groups */}
        <nav style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto' }}>
          {navGroups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 4 }}>
              {group.label && (
                <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.08em', padding: '10px 12px 4px', textTransform: 'uppercase' }}>
                  {group.label}
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {group.items.map(({ to, icon, label, module }) => (
                  <NavItem
                    key={to}
                    to={to}
                    icon={icon}
                    label={label}
                    isChat={to === '/chat'}
                    chatBadge={chatBadge}
                    canAccess={canAccessModule(module)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top bar */}
        <header className="no-print" style={{
          height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', background: 'white', borderBottom: '1px solid #E5E7EB',
          flexShrink: 0,
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>{pageTitle}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <GlobalSearch />
            <button
              style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer', borderRadius: 8, color: '#6B7280', transition: 'background 100ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <Bell className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <UserMenu email={user?.email ?? ''} onSignOut={signOut} />
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'auto', background: '#F8F9FC' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
