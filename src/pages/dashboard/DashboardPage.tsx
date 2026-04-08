import { useEffect, useState } from 'react'
import { DollarSign, Users, Briefcase, Package, AlertTriangle, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge, statusColor } from '@/components/ui/Badge'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns'
import type { Job } from '@/lib/database.types'

interface KPI { label: string; value: string; icon: React.ElementType; color: string }

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPI[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [lowStock, setLowStock] = useState<{ name: string; quantity: number; min_stock: number }[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    const [clientRes, jobRes, invRes, stockRes] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }),
      supabase.from('jobs').select('*'),
      supabase.from('invoices').select('total, status'),
      supabase.from('inventory').select('name, quantity, min_stock'),
    ])

    const allJobs = (jobRes.data ?? []) as Job[]
    setJobs(allJobs)

    const invoices = (invRes.data ?? []) as { total: number; status: string }[]
    const revenue = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + (i.total || 0), 0)
    const outstanding = invoices.filter(i => i.status === 'Sent' || i.status === 'Overdue').reduce((s, i) => s + (i.total || 0), 0)
    const activeJobs = allJobs.filter(j => j.status === 'In Progress' || j.status === 'Scheduled').length

    setKpis([
      { label: 'Revenue (Paid)', value: `$${revenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-600 bg-green-50' },
      { label: 'Outstanding', value: `$${outstanding.toLocaleString()}`, icon: DollarSign, color: 'text-yellow-600 bg-yellow-50' },
      { label: 'Total Clients', value: String(clientRes.count ?? 0), icon: Users, color: 'text-blue-600 bg-blue-50' },
      { label: 'Active Jobs', value: String(activeJobs), icon: Briefcase, color: 'text-purple-600 bg-purple-50' },
    ])

    const items = (stockRes.data ?? []) as { name: string; quantity: number; min_stock: number }[]
    setLowStock(items.filter(i => i.quantity <= i.min_stock))
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDow = monthStart.getDay()

  const scheduledJobs = jobs.filter(j => j.scheduled_date)

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-stone-900">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(kpi => (
          <Card key={kpi.label}>
            <CardBody className="flex items-center gap-4">
              <div className={`rounded-lg p-3 ${kpi.color}`}>
                <kpi.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-stone-500">{kpi.label}</p>
                <p className="text-2xl font-bold">{kpi.value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <CalendarDays className="h-5 w-5 text-stone-500" />
              Schedule
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} className="rounded-lg px-2 py-1 text-sm hover:bg-stone-100">&lt;</button>
              <span className="text-sm font-medium">{format(currentMonth, 'MMMM yyyy')}</span>
              <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} className="rounded-lg px-2 py-1 text-sm hover:bg-stone-100">&gt;</button>
            </div>
          </div>
          <CardBody>
            <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-stone-500">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
              {days.map(day => {
                const dayJobs = scheduledJobs.filter(j => j.scheduled_date && isSameDay(parseISO(j.scheduled_date), day))
                const isToday = isSameDay(day, new Date())
                return (
                  <div key={day.toISOString()} className={`min-h-[60px] rounded-lg p-1 text-xs ${isToday ? 'bg-brand-50 ring-1 ring-brand-300' : 'hover:bg-stone-50'}`}>
                    <span className={`inline-block rounded-full px-1.5 py-0.5 ${isToday ? 'bg-brand-600 text-white' : 'text-stone-600'}`}>
                      {format(day, 'd')}
                    </span>
                    {dayJobs.slice(0, 2).map(j => (
                      <div key={j.id} className="mt-0.5 truncate rounded bg-brand-100 px-1 text-[10px] text-brand-800">
                        {j.title}
                      </div>
                    ))}
                    {dayJobs.length > 2 && <div className="mt-0.5 text-[10px] text-stone-400">+{dayJobs.length - 2} more</div>}
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>

        {/* Low Stock + Recent Jobs */}
        <div className="space-y-6">
          {lowStock.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 border-b border-stone-100 px-6 py-4">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <h2 className="font-semibold">Low Stock Alerts</h2>
              </div>
              <CardBody className="space-y-2">
                {lowStock.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span>{item.name}</span>
                    <Badge color="red">{item.quantity} left (min: {item.min_stock})</Badge>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          <Card>
            <div className="flex items-center gap-2 border-b border-stone-100 px-6 py-4">
              <Package className="h-5 w-5 text-stone-500" />
              <h2 className="font-semibold">Recent Jobs</h2>
            </div>
            <CardBody className="space-y-3">
              {jobs.slice(0, 5).map(job => (
                <div key={job.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{job.title}</p>
                    <p className="text-xs text-stone-500">{job.division}</p>
                  </div>
                  <Badge color={statusColor(job.status)}>{job.status}</Badge>
                </div>
              ))}
              {jobs.length === 0 && <p className="text-sm text-stone-500">No jobs yet.</p>}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
