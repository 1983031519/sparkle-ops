import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge, statusColor } from '@/components/ui/Badge'
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval, startOfYear } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { fmtCurrency, fmtDateShort } from '@/lib/constants'
import type { Invoice, Estimate, Job, Client } from '@/lib/database.types'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']
const RANGE_OPTIONS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3', label: 'Last 3 Months' },
  { value: 'this_year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
]

function getDateRange(range: string): { start: Date; end: Date } {
  const now = new Date()
  switch (range) {
    case 'this_month': return { start: startOfMonth(now), end: endOfMonth(now) }
    case 'last_month': { const lm = subMonths(now, 1); return { start: startOfMonth(lm), end: endOfMonth(lm) } }
    case 'last_3': return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) }
    case 'this_year': return { start: startOfYear(now), end: endOfMonth(now) }
    default: return { start: new Date(2020, 0, 1), end: endOfMonth(now) }
  }
}

function inRange(dateStr: string | null, range: { start: Date; end: Date }): boolean {
  if (!dateStr) return false
  try {
    return isWithinInterval(parseISO(dateStr), range)
  } catch { return false }
}

export default function ReportsPage() {
  const [range, setRange] = useState('this_year')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [totalCosts, setTotalCosts] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [invRes, estRes, jobRes, cliRes, matRes, labRes, othRes] = await Promise.all([
        supabase.from('invoices').select('*'),
        supabase.from('estimates').select('*'),
        supabase.from('jobs').select('*'),
        supabase.from('clients').select('*'),
        supabase.from('job_material_costs').select('total'),
        supabase.from('job_labor_costs').select('total_amount'),
        supabase.from('job_other_costs').select('amount'),
      ])
      setInvoices((invRes.data ?? []) as Invoice[])
      setEstimates((estRes.data ?? []) as Estimate[])
      setJobs((jobRes.data ?? []) as Job[])
      setClients((cliRes.data ?? []) as Client[])
      const mc = ((matRes.data ?? []) as { total: number }[]).reduce((s, r) => s + (r.total || 0), 0)
      const lc = ((labRes.data ?? []) as { total_amount: number }[]).reduce((s, r) => s + (r.total_amount || 0), 0)
      const oc = ((othRes.data ?? []) as { amount: number }[]).reduce((s, r) => s + (r.amount || 0), 0)
      setTotalCosts(mc + lc + oc)
      setLoading(false)
    }
    load()
  }, [])

  const dateRange = useMemo(() => getDateRange(range), [range])

  // 1. Monthly Revenue (paid invoices)
  const monthlyRevenue = useMemo(() => {
    const paid = invoices.filter(i => i.status === 'Paid' && inRange(i.created_at ?? i.created_at, dateRange))
    const byMonth: Record<string, number> = {}
    paid.forEach(i => {
      const month = format(parseISO(i.created_at ?? i.created_at), 'yyyy-MM')
      byMonth[month] = (byMonth[month] ?? 0) + i.total
    })
    return Object.entries(byMonth).sort().map(([month, total]) => ({
      month: format(parseISO(month + '-01'), 'MMM yyyy', { locale: enUS }),
      revenue: total,
    }))
  }, [invoices, dateRange])

  // 2. Outstanding invoices
  const outstandingInvoices = useMemo(() => {
    return invoices.filter(i => (i.status === 'Unpaid' || i.status === 'Overdue') && inRange(i.created_at, dateRange))
  }, [invoices, dateRange])

  const outstandingTotal = outstandingInvoices.reduce((s, i) => s + i.total, 0)

  // 3. Estimates breakdown
  const estimateBreakdown = useMemo(() => {
    const filtered = estimates.filter(e => inRange(e.created_at, dateRange))
    const counts: Record<string, number> = { Sent: 0, Accepted: 0, Declined: 0, Draft: 0 }
    filtered.forEach(e => { counts[e.status] = (counts[e.status] ?? 0) + 1 })
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
  }, [estimates, dateRange])

  // 4. Jobs by status
  const jobsByStatus = useMemo(() => {
    const filtered = jobs.filter(j => inRange(j.created_at, dateRange))
    const counts: Record<string, number> = {}
    filtered.forEach(j => { counts[j.status] = (counts[j.status] ?? 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [jobs, dateRange])

  // 5. Revenue by division
  const revenueByDivision = useMemo(() => {
    const paidInvoices = invoices.filter(i => i.status === 'Paid' && inRange(i.created_at ?? i.created_at, dateRange))
    const jobMap = new Map(jobs.map(j => [j.id, j]))
    const divTotals: Record<string, number> = { Pavers: 0, Stone: 0 }
    paidInvoices.forEach(i => {
      if (i.job_id) {
        const job = jobMap.get(i.job_id)
        if (job) divTotals[job.division] = (divTotals[job.division] ?? 0) + i.total
      }
    })
    // Also count completed jobs total as fallback
    const filteredJobs = jobs.filter(j => j.status === 'Completed' && inRange(j.end_date ?? j.created_at, dateRange))
    if (divTotals.Pavers === 0 && divTotals.Stone === 0) {
      filteredJobs.forEach(j => { divTotals[j.division] = (divTotals[j.division] ?? 0) + j.total })
    }
    return Object.entries(divTotals).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
  }, [invoices, jobs, dateRange])

  // 6. New clients by month
  const clientsByMonth = useMemo(() => {
    const filtered = clients.filter(c => inRange(c.created_at, dateRange))
    const byMonth: Record<string, number> = {}
    filtered.forEach(c => {
      const month = format(parseISO(c.created_at), 'yyyy-MM')
      byMonth[month] = (byMonth[month] ?? 0) + 1
    })
    return Object.entries(byMonth).sort().map(([month, count]) => ({
      month: format(parseISO(month + '-01'), 'MMM yyyy', { locale: enUS }),
      clients: count,
    }))
  }, [clients, dateRange])

  if (loading) return <div className="flex h-full items-center justify-center text-stone-500">Loading reports...</div>

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-stone-600">Period:</label>
          <select
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-[#4F6CF7] focus:outline-none focus:ring-1 focus:ring-[#4F6CF7]/20"
            value={range}
            onChange={e => setRange(e.target.value)}
          >
            {RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Profitability Summary */}
      {(() => {
        const rev = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + (i.total || 0), 0)
        const profit = rev - totalCosts
        const pctMargin = rev > 0 ? (profit / rev) * 100 : 0
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #E5E7EB' }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#9CA3AF', marginBottom: 4 }}>Revenue</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{fmtCurrency(rev)}</p>
            </div>
            <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #E5E7EB' }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#9CA3AF', marginBottom: 4 }}>Total Costs</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#333' }}>{fmtCurrency(totalCosts)}</p>
            </div>
            <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #E5E7EB' }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#9CA3AF', marginBottom: 4 }}>Gross Profit</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: profit >= 0 ? '#16A34A' : '#DC2626' }}>{fmtCurrency(profit)}</p>
            </div>
            <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #E5E7EB' }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#9CA3AF', marginBottom: 4 }}>Margin</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: profit >= 0 ? '#16A34A' : '#DC2626' }}>{pctMargin.toFixed(1)}%</p>
            </div>
          </div>
        )
      })()}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1. Monthly Revenue */}
        <Card className="lg:col-span-2">
          <CardHeader><h2 className="font-semibold">Monthly Revenue (Paid Invoices)</h2></CardHeader>
          <CardBody>
            {monthlyRevenue.length === 0 ? <p className="py-8 text-center text-sm text-stone-400">No paid invoices in this period</p> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [fmtCurrency(Number(v)), 'Revenue']} />
                  <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        {/* 2. Outstanding Invoices */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Outstanding Invoices</h2>
              <span className="text-lg font-bold text-red-600">{fmtCurrency(outstandingTotal)}</span>
            </div>
          </CardHeader>
          <CardBody>
            {outstandingInvoices.length === 0 ? <p className="py-4 text-center text-sm text-stone-400">No outstanding invoices</p> : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {outstandingInvoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border border-stone-100 px-3 py-2 text-sm">
                    <div>
                      <span className="font-mono text-xs text-stone-500">{inv.number}</span>
                      {inv.due_date && <span className="ml-2 text-xs text-stone-400">Due: {fmtDateShort(inv.due_date)}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color={statusColor(inv.status)}>{inv.status}</Badge>
                      <span className="font-medium">{fmtCurrency(inv.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* 3. Estimates Breakdown */}
        <Card>
          <CardHeader><h2 className="font-semibold">Estimates: Sent vs Accepted vs Declined</h2></CardHeader>
          <CardBody>
            {estimateBreakdown.length === 0 ? <p className="py-8 text-center text-sm text-stone-400">No estimates in this period</p> : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={estimateBreakdown} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {estimateBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        {/* 4. Jobs by Status */}
        <Card>
          <CardHeader><h2 className="font-semibold">Jobs by Status</h2></CardHeader>
          <CardBody>
            {jobsByStatus.length === 0 ? <p className="py-8 text-center text-sm text-stone-400">No jobs in this period</p> : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={jobsByStatus} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {jobsByStatus.map((entry, i) => {
                      const colorMap: Record<string, string> = { Lead: '#3b82f6', Scheduled: '#8b5cf6', 'In Progress': '#f59e0b', Completed: '#22c55e', Cancelled: '#a8a29e' }
                      return <Cell key={i} fill={colorMap[entry.name] ?? COLORS[i]} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        {/* 5. Revenue by Division */}
        <Card>
          <CardHeader><h2 className="font-semibold">Revenue by Division</h2></CardHeader>
          <CardBody>
            {revenueByDivision.length === 0 ? <p className="py-8 text-center text-sm text-stone-400">No revenue data for this period</p> : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={revenueByDivision} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${fmtCurrency(value)}`}>
                    <Cell fill="#f97316" />
                    <Cell fill="#3b82f6" />
                  </Pie>
                  <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        {/* 6. New Clients by Month */}
        <Card>
          <CardHeader><h2 className="font-semibold">New Clients by Month</h2></CardHeader>
          <CardBody>
            {clientsByMonth.length === 0 ? <p className="py-8 text-center text-sm text-stone-400">No new clients in this period</p> : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={clientsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="clients" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
