import { useEffect, useState } from 'react'
import { DollarSign, Users, Briefcase, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge, statusColor } from '@/components/ui/Badge'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { fmtCurrency, fmtDateShort } from '@/lib/constants'
import type { Job, Invoice } from '@/lib/database.types'

export default function DashboardPage() {
  const [revenue, setRevenue] = useState(0)
  const [outstanding, setOutstanding] = useState(0)
  const [clientCount, setClientCount] = useState(0)
  const [activeJobs, setActiveJobs] = useState(0)
  const [jobs, setJobs] = useState<Job[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [lowStock, setLowStock] = useState<{ name: string; quantity: number; low_stock_threshold: number }[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [clientMap, setClientMap] = useState<Record<string, string>>({})

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    const [clientRes, jobRes, invRes, stockRes, clientsRes] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }),
      supabase.from('jobs').select('*').order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('inventory').select('name, quantity, low_stock_threshold'),
      supabase.from('clients').select('id, name'),
    ])

    const allJobs = (jobRes.data ?? []) as Job[]
    const allInvoices = (invRes.data ?? []) as Invoice[]
    setJobs(allJobs)
    setInvoices(allInvoices)
    setClientMap(Object.fromEntries((clientsRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name])))

    const invData = allInvoices as { total: number; status: string }[]
    setRevenue(invData.filter(i => i.status === 'Paid').reduce((s, i) => s + (i.total || 0), 0))
    setOutstanding(invData.filter(i => i.status === 'Unpaid' || i.status === 'Overdue').reduce((s, i) => s + (i.total || 0), 0))
    setClientCount(clientRes.count ?? 0)
    setActiveJobs(allJobs.filter(j => j.status === 'In Progress' || j.status === 'Scheduled').length)

    const items = (stockRes.data ?? []) as { name: string; quantity: number; low_stock_threshold: number }[]
    setLowStock(items.filter(i => i.quantity <= i.low_stock_threshold))
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDow = monthStart.getDay()
  const scheduledJobs = jobs.filter(j => j.start_date)

  const kpis = [
    { label: 'Revenue', value: fmtCurrency(revenue), icon: DollarSign, accent: true },
    { label: 'Outstanding', value: fmtCurrency(outstanding), icon: DollarSign, accent: false },
    { label: 'Total Clients', value: String(clientCount), icon: Users, accent: false },
    { label: 'Active Jobs', value: String(activeJobs), icon: Briefcase, accent: false },
  ]

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>

      {/* OVERVIEW */}
      <p style={{ fontSize: 13, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Overview</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {kpis.map(kpi => (
          <div key={kpi.label} style={{
            background: 'white', borderRadius: 16, padding: 28,
            border: '1px solid rgba(0,0,0,0.06)',
            borderBottom: kpi.accent ? '3px solid #C8A96E' : '1px solid rgba(0,0,0,0.06)',
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, color: '#9CA3AF', marginBottom: 8 }}>{kpi.label}</p>
            <p style={{ fontSize: 36, fontWeight: 700, color: '#0D1B3D', lineHeight: 1.1 }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* LOW STOCK ALERTS */}
      {lowStock.length > 0 && (
        <div style={{ background: '#FEF9C3', borderRadius: 12, padding: '16px 20px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle style={{ width: 18, height: 18, color: '#B45309', flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: '#92400E' }}>
            <strong>Low stock:</strong> {lowStock.map(i => `${i.name} (${i.quantity} left)`).join(' · ')}
          </p>
        </div>
      )}

      {/* RECENT ACTIVITY */}
      <p style={{ fontSize: 13, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Recent Activity</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>

        {/* Recent Jobs */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#9CA3AF', marginBottom: 12 }}>Jobs</p>
          {jobs.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9CA3AF', padding: '20px 0' }}>No jobs yet.</p>
          ) : (
            <div>
              {jobs.slice(0, 6).map(job => (
                <div key={job.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#0D1B3D' }}>{clientMap[job.client_id] ?? 'Unknown'}</p>
                    <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{job.title}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge color={statusColor(job.status)}>{job.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#9CA3AF', marginBottom: 12 }}>Invoices</p>
          {invoices.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9CA3AF', padding: '20px 0' }}>No invoices yet.</p>
          ) : (
            <div>
              {invoices.slice(0, 6).map(inv => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#0D1B3D' }}>{clientMap[inv.client_id] ?? 'Unknown'}</p>
                    <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{inv.number} · {fmtDateShort(inv.due_date)}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Badge color={statusColor(inv.status)}>{inv.status}</Badge>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0D1B3D', minWidth: 80, textAlign: 'right' }}>{fmtCurrency(inv.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SCHEDULE */}
      <p style={{ fontSize: 13, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Schedule</p>

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', padding: 24 }}>
        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: '#6B7280' }}>
            <ChevronLeft style={{ width: 20, height: 20 }} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#0D1B3D' }}>{format(currentMonth, 'MMMM yyyy', { locale: enUS })}</span>
          <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: '#6B7280' }}>
            <ChevronRight style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 4 }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, padding: '8px 0' }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
          {days.map(day => {
            const dayJobs = scheduledJobs.filter(j => j.start_date && isSameDay(parseISO(j.start_date), day))
            const isToday = isSameDay(day, new Date())
            return (
              <div key={day.toISOString()} style={{ minHeight: 64, padding: '6px 4px', borderRadius: 8, position: 'relative' }}>
                <div style={{ textAlign: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? '#0D1B3D' : '#6B7280' }}>
                    {format(day, 'd', { locale: enUS })}
                  </span>
                  {isToday && (
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#0D1B3D', margin: '2px auto 0' }} />
                  )}
                </div>
                {dayJobs.slice(0, 2).map(j => (
                  <div key={j.id} style={{ fontSize: 10, background: 'rgba(200,169,110,0.15)', color: '#92700A', borderRadius: 4, padding: '1px 4px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {j.title}
                  </div>
                ))}
                {dayJobs.length > 2 && <div style={{ fontSize: 10, color: '#9CA3AF' }}>+{dayJobs.length - 2}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
