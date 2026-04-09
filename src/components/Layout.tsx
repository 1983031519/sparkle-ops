import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Users, Briefcase, FileText, Receipt, Truck, Package, BarChart3, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/estimates', icon: FileText, label: 'Estimates' },
  { to: '/invoices', icon: Receipt, label: 'Invoices' },
  { to: '/suppliers', icon: Truck, label: 'Suppliers' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
]

export function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="no-print flex w-[240px] flex-col" style={{ background: '#0D1B3D' }}>
        {/* Logo */}
        <div style={{ background: '#0D1B3D', padding: '24px 24px 16px' }}>
          <img src="/sparkle-logo-light.png" alt="Sparkle Stone & Pavers" width={160} style={{ height: 'auto', display: 'block' }} />
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'border-l-[3px] border-gold-500 bg-white/[0.08] text-gold-500 pl-[9px]'
                    : 'border-l-[3px] border-transparent text-white/60 hover:text-white/90 hover:bg-white/[0.05]'
                }`
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + Sign Out */}
        <div className="border-t border-white/10 px-4 py-4">
          {user?.email && (
            <p className="mb-2 truncate text-[11px] text-white/40">{user.email}</p>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] font-medium text-white/50 transition-colors hover:text-white/80 hover:bg-white/[0.05]"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-surface">
        <Outlet />
      </main>
    </div>
  )
}
