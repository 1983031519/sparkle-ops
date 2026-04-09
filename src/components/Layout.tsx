import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Users, Briefcase, FileText, Receipt, Truck, Package, BarChart3, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { COMPANY } from '@/lib/constants'

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
  const { signOut } = useAuth()

  return (
    <div className="flex h-screen">
      <aside className="no-print flex w-64 flex-col border-r border-stone-200 bg-white">
        <div className="border-b border-stone-200 px-6 py-5">
          <h1 className="text-lg font-bold text-brand-700">{COMPANY.brand}</h1>
          <p className="text-xs text-stone-500">Operations Portal</p>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-stone-200 px-3 py-3">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-stone-50">
        <Outlet />
      </main>
    </div>
  )
}
