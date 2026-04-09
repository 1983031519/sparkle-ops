import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Layout } from '@/components/Layout'
import { ToastProvider } from '@/components/ui/Toast'
import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import ClientsPage from '@/pages/clients/ClientsPage'
import JobsPage from '@/pages/jobs/JobsPage'
import EstimatesPage from '@/pages/estimates/EstimatesPage'
import ProjectsPage from '@/pages/projects/ProjectsPage'
import InvoicesPage from '@/pages/invoices/InvoicesPage'
import VendorsPage from '@/pages/vendors/VendorsPage'
import InventoryPage from '@/pages/inventory/InventoryPage'
import ReportsPage from '@/pages/reports/ReportsPage'

function ProtectedRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center text-stone-500">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <Layout />
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoutes />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/estimates" element={<EstimatesPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/vendors" element={<VendorsPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
