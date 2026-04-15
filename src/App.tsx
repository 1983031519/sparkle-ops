import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Layout } from '@/components/Layout'
import { ToastProvider } from '@/components/ui/Toast'
import { ChatProvider } from '@/contexts/ChatContext'
import LoginPage from '@/pages/auth/LoginPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import UnauthorizedPage from '@/pages/unauthorized/UnauthorizedPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import ClientsPage from '@/pages/clients/ClientsPage'
import JobsPage from '@/pages/jobs/JobsPage'
import SchedulePage from '@/pages/schedule/SchedulePage'
import GoogleCallbackPage from '@/pages/schedule/GoogleCallbackPage'
import EstimatesPage from '@/pages/estimates/EstimatesPage'
import ProjectsPage from '@/pages/projects/ProjectsPage'
import InvoicesPage from '@/pages/invoices/InvoicesPage'
import VendorsPage from '@/pages/vendors/VendorsPage'
import InventoryPage from '@/pages/inventory/InventoryPage'
import ReportsPage from '@/pages/reports/ReportsPage'
import UsersPage from '@/pages/users/UsersPage'
import RockoPage from '@/pages/rocko/RockoPage'
import ViewDocumentPage from '@/pages/view/ViewDocumentPage'
import ChatPage from '@/pages/chat/ChatPage'

function ProtectedRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center text-stone-500">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return (
    <ChatProvider>
      <Layout />
    </ChatProvider>
  )
}

/** Wraps a page and redirects to /unauthorized if the user's role doesn't have access */
function ModuleGuard({ module, children }: { module: string; children: React.ReactNode }) {
  const { canAccessModule, loading } = useAuth()
  if (loading) return null
  if (!canAccessModule(module)) return <Navigate to="/unauthorized" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          <Route path="/view/:token" element={<ViewDocumentPage />} />
          <Route element={<ProtectedRoutes />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route path="/clients" element={<ModuleGuard module="clients"><ClientsPage /></ModuleGuard>} />
            <Route path="/jobs" element={<ModuleGuard module="jobs"><JobsPage /></ModuleGuard>} />
            <Route path="/schedule" element={<ModuleGuard module="schedule"><SchedulePage /></ModuleGuard>} />
            <Route path="/schedule/google-callback" element={<ModuleGuard module="schedule"><GoogleCallbackPage /></ModuleGuard>} />
            <Route path="/estimates" element={<ModuleGuard module="estimates"><EstimatesPage /></ModuleGuard>} />
            <Route path="/projects" element={<ModuleGuard module="projects"><ProjectsPage /></ModuleGuard>} />
            <Route path="/invoices" element={<ModuleGuard module="invoices"><InvoicesPage /></ModuleGuard>} />
            <Route path="/vendors" element={<ModuleGuard module="vendors"><VendorsPage /></ModuleGuard>} />
            <Route path="/inventory" element={<ModuleGuard module="inventory"><InventoryPage /></ModuleGuard>} />
            <Route path="/reports" element={<ModuleGuard module="reports"><ReportsPage /></ModuleGuard>} />
            <Route path="/users" element={<ModuleGuard module="users"><UsersPage /></ModuleGuard>} />
            <Route path="/rocko" element={<ModuleGuard module="rocko"><RockoPage /></ModuleGuard>} />
            <Route path="/chat" element={<ChatPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
