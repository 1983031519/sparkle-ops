import { useState, useEffect, useMemo } from 'react'
import { ComposedChart, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Line, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge, statusColor } from '@/components/ui/Badge'
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval, startOfYear } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { fmtCurrency, fmtDateShort } from '@/lib/constants'
import type { Invoice, Estimate, Job, Client } from '@/lib/database.types'

const NAVY = '#1E3A5F'
const SKY  = '#38BDF8'
const COLORS = [NAVY, SKY, '#D97706', '#DC2626', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

const TAB_OPTIONS = [
  { value: 'this_month',   label: 'This Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year',    label: 'This Year' },
  { value: 'all',          label: 'All Time' },
]

function getDateRange(range: string): { start: Date; end: Date } {
  const now = new Date()
  switch (range) {
    case 'this_month':   return { start: startOfMonth(now), end: endOfMonth(now) }
    case 'this_quarter': {
      const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      return { start: qStart, end: endOfMonth(now) }
    }
    case 'this_year':    return { start: startOfYear(now), end: endOfMonth(now) }
    default:             return { start: new Date(2020, 0, 1), end: endOfMonth(now) }
  }
}

function inRange(dateStr: string | null, range: { start: Date; end: Date }): boolean {
  if (!dateStr) return false
  try {
    return isWithinInterval(parseISO(dateStr), range)
  } catch { return false }
}

export default function ReportsPage() {
  const [range, setRange] = useState('all')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [invRes, estRes, jobRes, cliRes] = await Promise.all([
        supabase.from('invoices').select('*'),
        supabase.from('estimates').select('*'),
        supabase.from('jobs').select('*'),
        supabase.from('clients').select('*'),
      ])
      setInvoices((invRes.data ?? []) as Invoice[])
      setEstimates((estRes.data ?? []) as Estimate[])
      setJobs((jobRes.data ?? []) as Job[])
      setClients((cliRes.data ?? []) as Client[])
      setLoading(false)
    }
    load()
  }, [])

  const dateRange = useMemo(() => getDateRange(range), [range])

  function invoiceDate(i: Invoice): string {
    return i.date ?? i.created_at
  }

  // 1. Monthly Revenue with trend line
  const monthlyRevenue = useMemo(() => {
    const paid = invoices.filter(i => i.status === 'Paid' && inRange(invoiceDate(i), dateRange))
    const byMonth: Record<string, number> = {}
    paid.forEach(i => {
      const month = format(parseISO(invoiceDate(i)), 'yyyy-MM')
      byMonth[month] = (byMonth[month] ?? 0) + i.total
    })
    const sorted = Object.entries(byMonth).sort().map(([month, total]) => ({
      month: format(parseISO(month + '-01'), 'MMM yyyy', { locale: enUS }),
      revenue: total,
    }))
    return sorted.map((d, i, arr) => ({
      ...d,
      trend: i === 0 ? d.revenue : Math.round((d.revenue + arr[i - 1].revenue) / 2),
    }))
  }, [invoices, dateRange])

  // 2. Outstanding invoices
  const outstandingInvoices = useMemo(() => {
    return invoices.filter(i => (i.status === 'Unpaid' || i.status === 'Overdue') && inRange(invoiceDate(i), dateRange))
  }, [invoices, dateRange])

  const outstandingTotal = outstandingInvoices.reduce((s, i) => s + i.total, 0)

  // 3. Conversion rate
  const conversionRate = useMemo(() => {
    const filtered = estimates.filter(e => inRange(e.created_at, dateRange))
    const actionable = filtered.filter(e => e.status === 'Sent' || e.status === 'Approved' || e.status === 'Declined')
    const approved = filtered.filter(e => e.status === 'Approved')
    return actionable.length > 0 ? (approved.length / actionable.length) * 100 : 0
  }, [estimates, dateRange])

  // 4. Jobs by status (donut)
  const jobsByStatus = useMemo(() => {
    const filtered = jobs.filter(j => inRange(j.created_at, dateRange))
    const counts: Record<string, number> = {}
    filtered.forEach(j => { counts[j.status] = (counts[j.status] ?? 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [jobs, dateRange])

  // 5. Collection performance
  const collectionPerf = useMemo(() => {
    const filtered = invoices.filter(i => inRange(invoiceDate(i), dateRange))
    const paid = filtered.filter(i => i.status === 'Paid').reduce((s, i) => s + i.total, 0)
    const overdue = filtered.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.total, 0)
    const total = filtered.reduce((s, i) => s + i.total, 0)
    return { paid, overdue, total, rate: total > 0 ? (paid / total) * 100 : 0 }
  }, [invoices, dateRange])

  // 6. Revenue by division
  const revenueByDivision = useMemo(() => {
    const paidInvoices = invoices.filter(i => i.status === 'Paid' && inRange(invoiceDate(i), dateRange))
    const jobMap = new Map(jobs.map(j => [j.id, j]))
    const divTotals: Record<string, number> = { Pavers: 0, Stone: 0 }
    paidInvoices.forEach(i => {
      if (i.job_id) {
        const job = jobMap.get(i.job_id)
        if (job) divTotals[job.division] = (divTotals[job.division] ?? 0) + i.total
      }
    })
    const filteredJobs = jobs.filter(j => j.status === 'Completed' && inRange(j.end_date ?? j.created_at, dateRange))
    if (divTotals.Pavers === 0 && divTotals.Stone === 0) {
      filteredJobs.forEach(j => { divTotals[j.division] = (divTotals[j.division] ?? 0) + j.total })
    }
    return Object.entries(divTotals).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
  }, [invoices, jobs, dateRange])

  // 7. New clients by month
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

  if (loading) return <div className="flex h-full items-center justify-center text-gray-500">Loading reports...</div>

  /* ─── Summary stats (within-range) ─── */
  const filteredInvoices = invoices.filter(i => inRange(invoiceDate(i), dateRange))
  const totalInvoiced   = filteredInvoices.reduce((s, i) => s + (i.total || 0), 0)
  const totalCollected  = filteredInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + (i.total || 0), 0)
  const totalOutstanding = filteredInvoices.filter(i => i.status === 'Unpaid' || i.status === 'Overdue').reduce((s, i) => s + (i.total || 0), 0)
  const collectionRate  = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0

  /* ─── Estimate funnel data ─── */
  const estFiltered = estimates.filter(e => inRange(e.created_at, dateRange))
  const estTotal    = estFiltered.length
  const estSent     = estFiltered.filter(e => e.status === 'Sent').length
  const estApproved = estFiltered.filter(e => e.status === 'Approved').length
  const estDeclined = estFiltered.filter(e => e.status === 'Declined').length

  /* ─── Jobs donut colors ─── */
  const jobStatusColors: Record<string, string> = {
    Lead: SKY, Scheduled: '#8b5cf6', 'In Progress': '#D97706', Completed: '#059669', Cancelled: '#a8a29e',
  }

  return (
    <div className="space-y-6 p-6">
      {/* Period tabs */}
      <div className="flex items-center justify-between">
        <h1 className="text-display text-gray-900">Reports</h1>
        <div style={{ display: 'flex', gap: 4, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
          {TAB_OPTIONS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setRange(tab.value)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                background: range === tab.value ? 'white' : 'transparent',
                color: range === tab.value ? '#111827' : '#6B7280',
                boxShadow: range === tab.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #E5E7EB' }}>
          <p className="text-micro font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 1, color: '#9CA3AF', marginBottom: 4 }}>Total Invoiced</p>
          <p className="text-display" style={{ color: '#111827' }}>{fmtCurrency(totalInvoiced)}</p>
        </div>
        <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #E5E7EB' }}>
          <p className="text-micro font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 1, color: '#9CA3AF', marginBottom: 4 }}>Total Collected</p>
          <p className="text-display" style={{ color: '#059669' }}>{fmtCurrency(totalCollected)}</p>
        </div>
        <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #E5E7EB' }}>
          <p className="text-micro font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 1, color: '#9CA3AF', marginBottom: 4 }}>Outstanding</p>
          <p className="text-display" style={{ color: totalOutstanding > 0 ? '#D97706' : '#059669' }}>{fmtCurrency(totalOutstanding)}</p>
        </div>
        <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid #E5E7EB' }}>
          <p className="text-micro font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 1, color: '#9CA3AF', marginBottom: 4 }}>Collection Rate</p>
          <p className="text-display" style={{ color: '#111827' }}>{collectionRate.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Chart 1: Monthly Revenue — ComposedChart with navy gradient bars + trend line */}
        <Card className="lg:col-span-2">
          <CardHeader><h2 className="font-semibold">Monthly Revenue (Paid Invoices)</h2></CardHeader>
          <CardBody>
            {monthlyRevenue.length === 0 ? <p className="py-8 text-center text-sm text-gray-400">No paid invoices in this period</p> : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={monthlyRevenue}>
                  <defs>
                    <linearGradient id="navyBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={NAVY} stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v, name) => [fmtCurrency(Number(v)), name === 'trend' ? 'Trend' : 'Revenue']} />
                  <Bar dataKey="revenue" fill="url(#navyBarGradient)" radius={[4, 4, 0, 0]} />
                  <Line dataKey="trend" type="monotone" stroke="#7C3AED" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        {/* Chart 2: Estimate Conversion — CSS funnel */}
        <Card>
          <CardHeader><h2 className="font-semibold">Estimate Conversion</h2></CardHeader>
          <CardBody>
            {estTotal === 0
              ? <p className="py-8 text-center text-sm text-gray-400">No estimates in this period</p>
              : (
                <div>
                  {/* Conversion headline */}
                  <div style={{ textAlign: 'center', padding: '12px 0 20px' }}>
                    <p style={{ fontSize: 52, fontWeight: 800, color: NAVY, lineHeight: 1 }}>{conversionRate.toFixed(0)}%</p>
                    <p style={{ fontSize: 13, color: '#6B7280', marginTop: 6 }}>Estimate Conversion Rate</p>
                  </div>
                  {/* Funnel bars */}
                  {[
                    { label: 'Total Created', count: estTotal,    color: '#9CA3AF', bg: '#F3F4F6' },
                    { label: 'Sent',          count: estSent,     color: '#2563EB', bg: '#DBEAFE' },
                    { label: 'Approved',      count: estApproved, color: '#059669', bg: '#D1FAE5' },
                    { label: 'Declined',      count: estDeclined, color: '#DC2626', bg: '#FEE2E2' },
                  ].map((stage, i) => {
                    const pct = estTotal > 0 ? Math.round((stage.count / estTotal) * 100) : 0
                    return (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: stage.color }}>{stage.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: stage.color }}>{stage.count}</span>
                        </div>
                        <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: stage.color, borderRadius: 4, opacity: 0.7, transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }
          </CardBody>
        </Card>

        {/* Chart 3: Jobs by Status — donut PieChart */}
        <Card>
          <CardHeader><h2 className="font-semibold">Jobs by Status</h2></CardHeader>
          <CardBody>
            {jobsByStatus.length === 0 ? <p className="py-8 text-center text-sm text-gray-400">No jobs in this period</p> : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <ResponsiveContainer width="55%" height={240}>
                  <PieChart>
                    <Pie data={jobsByStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={2}>
                      {jobsByStatus.map((entry, i) => (
                        <Cell key={i} fill={jobStatusColors[entry.name] ?? COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {jobsByStatus.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: jobStatusColors[entry.name] ?? COLORS[i % COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>{entry.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Chart 4: Revenue by Division */}
        <Card>
          <CardHeader><h2 className="font-semibold">Revenue by Division</h2></CardHeader>
          <CardBody>
            {revenueByDivision.length === 0 ? <p className="py-8 text-center text-sm text-gray-400">No revenue data for this period</p> : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <ResponsiveContainer width="55%" height={240}>
                  <PieChart>
                    <Pie data={revenueByDivision} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={false}>
                      <Cell fill={NAVY} />
                      <Cell fill={SKY} />
                    </Pie>
                    <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {revenueByDivision.map((entry, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: i === 0 ? NAVY : SKY, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{entry.name}</span>
                      </div>
                      <p style={{ fontSize: 18, fontWeight: 800, color: '#111827', paddingLeft: 18 }}>{fmtCurrency(entry.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Chart 5 (new): Collection Performance — CSS only */}
        <Card>
          <CardHeader><h2 className="font-semibold">Collection Performance</h2></CardHeader>
          <CardBody>
            <div style={{ textAlign: 'center', padding: '12px 0 20px' }}>
              <p style={{ fontSize: 52, fontWeight: 800, color: collectionPerf.rate >= 80 ? '#059669' : collectionPerf.rate >= 50 ? '#D97706' : '#DC2626', lineHeight: 1 }}>
                {collectionPerf.rate.toFixed(0)}%
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', marginTop: 6 }}>Invoices Collected</p>
            </div>
            {[
              { label: 'Total Invoiced', amount: collectionPerf.total, color: '#9CA3AF' },
              { label: 'Collected (Paid)', amount: collectionPerf.paid, color: '#059669' },
              { label: 'Overdue', amount: collectionPerf.overdue, color: '#DC2626' },
            ].map((row, i) => {
              const pct = collectionPerf.total > 0 ? Math.round((row.amount / collectionPerf.total) * 100) : 0
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: row.color }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: row.color }}>{fmtCurrency(row.amount)}</span>
                  </div>
                  <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: row.color, borderRadius: 4, opacity: 0.7, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )
            })}
          </CardBody>
        </Card>

        {/* Chart 6: Outstanding Invoices list */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Outstanding Invoices</h2>
              <span className="text-lg font-bold text-red-600">{fmtCurrency(outstandingTotal)}</span>
            </div>
          </CardHeader>
          <CardBody>
            {outstandingInvoices.length === 0 ? <p className="py-4 text-center text-sm text-gray-400">No outstanding invoices</p> : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {outstandingInvoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                    <div>
                      <span className="font-mono text-xs text-gray-500">{inv.number}</span>
                      {inv.due_date && <span className="ml-2 text-xs text-gray-400">Due: {fmtDateShort(inv.due_date)}</span>}
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

        {/* Chart 7: New Clients by Month */}
        <Card className="lg:col-span-2">
          <CardHeader><h2 className="font-semibold">New Clients by Month</h2></CardHeader>
          <CardBody>
            {clientsByMonth.length === 0 ? <p className="py-8 text-center text-sm text-gray-400">No new clients in this period</p> : (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={clientsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="clients" fill={NAVY} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-micro" style={{ color: '#9CA3AF', fontStyle: 'italic', marginTop: 8 }}>* Legacy clients imported Apr 2026 — historical distribution may be skewed</p>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
