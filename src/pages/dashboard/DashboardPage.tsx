import { useEffect, useState } from 'react'
import { DollarSign, Users, Briefcase, FileText, FolderOpen, Package, AlertTriangle, ChevronLeft, ChevronRight, UserCheck, TrendingUp, TrendingDown, ArrowRight, MessageSquare, Calendar as CalendarIcon, Clock } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Badge, statusColor } from '@/components/ui/Badge'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, subMonths } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { fmtCurrency, fmtDateShort } from '@/lib/constants'
import { useAuth } from '@/hooks/useAuth'
import { useChatContext } from '@/contexts/ChatContext'
import type { Job, Invoice, Event } from '@/lib/database.types'

function fmtEventTime(t: string | null) {
  if (!t) return ''
  const [hh, mm] = t.split(':')
  const h = parseInt(hh, 10); const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${mm} ${ampm}`
}

function useIsMobile() {
  const [m, setM] = useState(false)
  useEffect(() => { const c = () => setM(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])
  return m
}

function pctChange(current: number, prev: number) {
  if (prev === 0) return current > 0 ? 100 : 0
  return Math.round(((current - prev) / prev) * 100)
}

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const { unreadCount } = useChatContext()
  const rawFirst = (profile?.full_name?.split(/\s+/)[0]) || user?.email?.split('@')[0] || ''
  const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1)
  const [revenue, setRevenue] = useState(0)
  const [outstanding, setOutstanding] = useState(0)
  const [clientCount, setClientCount] = useState(0)
  const [activeJobs, setActiveJobs] = useState(0)
  const [pendingEstimates, setPendingEstimates] = useState(0)
  const [activeVendors, setActiveVendors] = useState(0)
  const [activeProjects, setActiveProjects] = useState(0)
  const [prevRevenue, setPrevRevenue] = useState(0)
  const [prevOutstanding, setPrevOutstanding] = useState(0)
  const [prevActiveJobs, setPrevActiveJobs] = useState(0)
  const [prevClientCount, setPrevClientCount] = useState(0)
  const [jobs, setJobs] = useState<Job[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [lowStock, setLowStock] = useState<{ name: string; quantity: number; low_stock_threshold: number }[]>([])
  const [allEvents, setUpcomingEvents] = useState<Event[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [clientMap, setClientMap] = useState<Record<string, string>>({})
  const isMobile = useIsMobile()
  const navigate = useNavigate()

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    const now = new Date()
    const thisMonthStart = startOfMonth(now).toISOString()
    const prevMonthStart = startOfMonth(subMonths(now, 1)).toISOString()
    const prevMonthEnd = endOfMonth(subMonths(now, 1)).toISOString()

    const [clientRes, jobRes, invRes, stockRes, clientsRes, estRes, vendorRes, projRes,
           prevJobRes, prevClientRes, evRes] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }),
      supabase.from('jobs').select('id, client_id, title, status, start_date, division, created_at').order('created_at', { ascending: false }),
      supabase.from('invoices').select('id, client_id, status, total, balance_due, number, date, due_date, created_at').order('created_at', { ascending: false }),
      supabase.from('inventory').select('name, quantity, low_stock_threshold, category').eq('category', 'Materials & Stock'),
      supabase.from('clients').select('id, name'),
      supabase.from('estimates').select('status'),
      supabase.from('suppliers').select('status'),
      supabase.from('projects').select('status'),
      // prev month jobs
      supabase.from('jobs').select('status').gte('created_at', prevMonthStart).lte('created_at', prevMonthEnd),
      // client count at start of this month
      supabase.from('clients').select('id', { count: 'exact', head: true }).lt('created_at', thisMonthStart),
      // all events (both the "upcoming" list and the mini-calendar need them; slicing happens in the UI)
      supabase.from('events').select('*').order('date', { ascending: true }).order('time_start', { ascending: true, nullsFirst: true }),
    ])

    const allJobs = (jobRes.data ?? []) as Job[]
    const allInvoices = (invRes.data ?? []) as Invoice[]
    setJobs(allJobs)
    setInvoices(allInvoices)
    setClientMap(Object.fromEntries((clientsRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name])))

    // Faturamento (Mês): all invoices dated this month (paid or unpaid)
    const thisMonthInvoices = allInvoices.filter(i => {
      const d = (i as any).date ?? i.created_at
      return d && d >= thisMonthStart.slice(0, 10) && d <= endOfMonth(now).toISOString().slice(0, 10)
    })
    const rev = thisMonthInvoices.reduce((s, i) => s + (i.total || 0), 0)
    const out = allInvoices.filter(i => i.status === 'Unpaid' || i.status === 'Overdue').reduce((s, i) => s + (i.total || 0), 0)
    const cc = clientRes.count ?? 0
    const aj = allJobs.filter(j => j.status === 'In Progress' || j.status === 'Scheduled').length

    setRevenue(rev)
    setOutstanding(out)
    setClientCount(cc)
    setActiveJobs(aj)
    setPendingEstimates(((estRes.data ?? []) as { status: string }[]).filter(e => e.status === 'Draft' || e.status === 'Sent').length)
    setActiveVendors(((vendorRes.data ?? []) as { status: string }[]).filter(v => (v.status ?? 'Active') === 'Active').length)
    setActiveProjects(((projRes.data ?? []) as { status: string }[]).filter(p => p.status === 'Draft' || p.status === 'Sent' || p.status === 'In Progress').length)

    // prev month comparisons — use invoice date field for accurate historical comparison
    const pmStart = startOfMonth(subMonths(now, 1)).toISOString().slice(0, 10)
    const pmEnd = endOfMonth(subMonths(now, 1)).toISOString().slice(0, 10)
    const prevMonthInvoices = allInvoices.filter(i => {
      const d = (i as any).date ?? i.created_at
      return d && d >= pmStart && d <= pmEnd
    })
    setPrevRevenue(prevMonthInvoices.reduce((s, i) => s + (i.total || 0), 0))
    setPrevOutstanding(prevMonthInvoices.filter(i => i.status === 'Unpaid' || i.status === 'Overdue').reduce((s, i) => s + (i.total || 0), 0))
    setPrevActiveJobs(((prevJobRes.data ?? []) as { status: string }[]).filter(j => j.status === 'In Progress' || j.status === 'Scheduled').length)
    setPrevClientCount(prevClientRes.count ?? 0)

    const items = (stockRes.data ?? []) as { name: string; quantity: number; low_stock_threshold: number }[]
    setLowStock(items.filter(i => i.quantity <= i.low_stock_threshold))

    setUpcomingEvents((evRes.data ?? []) as Event[])
  }

  /* ─── Unified "Schedule" card (Upcoming list + monthly mini-calendar) ─── */
  const todayIsoStr = format(new Date(), 'yyyy-MM-dd')

  // Normalize events and jobs into a single stream of calendar items.
  type CalItem =
    | { kind: 'event'; id: string; date: string; time_start: string | null; title: string; sortKey: string }
    | { kind: 'job'; id: string; date: string; title: string; sortKey: string }

  const calItems: CalItem[] = [
    ...allEvents.map<CalItem>(ev => ({
      kind: 'event', id: ev.id, date: ev.date, time_start: ev.time_start, title: ev.title,
      sortKey: `${ev.date}T${ev.time_start ?? '00:00:00'}`,
    })),
    ...jobs.filter(j => j.start_date).map<CalItem>(j => ({
      kind: 'job', id: j.id, date: (j.start_date as string).slice(0, 10), title: j.title,
      sortKey: `${(j.start_date as string).slice(0, 10)}T00:00:00`,
    })),
  ]

  const upcomingList = calItems
    .filter(i => i.date >= todayIsoStr)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .slice(0, 5)

  // Per-day buckets for the mini calendar
  const itemsByDate: Record<string, CalItem[]> = {}
  for (const item of calItems) {
    if (!itemsByDate[item.date]) itemsByDate[item.date] = []
    itemsByDate[item.date].push(item)
  }

  const miniMonthStart = startOfMonth(currentMonth)
  const miniMonthEnd = endOfMonth(currentMonth)
  const miniDays = eachDayOfInterval({ start: miniMonthStart, end: miniMonthEnd })
  const miniStartDow = miniMonthStart.getDay()

  // Pill colors
  const EVENT_PILL = { bg: '#DBEAFE', fg: '#1E40AF' }   // blue (event)
  const JOB_PILL   = { bg: '#1E3A8A', fg: '#FFFFFF' }   // navy (job)

  const scheduleCard = (
    <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: isMobile ? 16 : 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '12px 14px' : '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarIcon size={isMobile ? 13 : 14} color="#4F6CF7" strokeWidth={2} />
          <p style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: '#111827' }}>Schedule</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#6B7280' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: EVENT_PILL.bg, border: `1px solid ${EVENT_PILL.fg}` }} /> Events
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#6B7280' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: JOB_PILL.bg }} /> Jobs
            </span>
          </div>
        </div>
        <Link to="/schedule" style={{ fontSize: isMobile ? 11 : 12, fontWeight: 500, color: '#4F6CF7', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          See all <ArrowRight size={12} />
        </Link>
      </div>

      {/* Section 1: Upcoming list */}
      <div style={{ padding: isMobile ? '10px 14px 4px' : '12px 20px 4px', fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Upcoming
      </div>
      {upcomingList.length === 0
        ? <p style={{ fontSize: 13, color: '#9CA3AF', padding: isMobile ? '4px 14px 16px' : '4px 20px 20px' }}>Nothing coming up. Create an event or schedule a job.</p>
        : upcomingList.map(item => {
            const d = parseISO(item.date)
            const isToday = item.date === todayIsoStr
            const meta = item.kind === 'event' ? EVENT_PILL : JOB_PILL
            const label = item.kind === 'event' ? 'Event' : 'Job'
            return (
              <Link key={`${item.kind}-${item.id}`} to={item.kind === 'event' ? '/schedule' : '/jobs'} style={{
                display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 12,
                padding: isMobile ? '10px 14px' : '12px 20px',
                borderBottom: '1px solid #F9FAFB', textDecoration: 'none',
              }}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  minWidth: isMobile ? 36 : 40, padding: '2px 0',
                  background: isToday ? '#4F6CF7' : '#F3F4F6',
                  color: isToday ? 'white' : '#374151',
                  borderRadius: 6, flexShrink: 0,
                }}>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', opacity: 0.8 }}>{format(d, 'MMM')}</span>
                  <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, lineHeight: 1 }}>{format(d, 'd')}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: meta.bg, color: meta.fg, flexShrink: 0 }}>{label}</span>
                  </div>
                  {item.kind === 'event' && item.time_start && (
                    <p style={{ fontSize: isMobile ? 10 : 11, color: '#6B7280', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} /> {fmtEventTime(item.time_start)}
                    </p>
                  )}
                </div>
              </Link>
            )
          })
      }

      {/* Section 2: mini calendar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '12px 14px 6px' : '14px 20px 6px', borderTop: '1px solid #F3F4F6' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{format(currentMonth, 'MMMM yyyy', { locale: enUS })}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', padding: '3px 6px', color: '#6B7280', display: 'flex', alignItems: 'center' }}><ChevronLeft style={{ width: 14, height: 14 }} /></button>
          <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', padding: '3px 6px', color: '#6B7280', display: 'flex', alignItems: 'center' }}><ChevronRight style={{ width: 14, height: 14 }} /></button>
        </div>
      </div>
      <div style={{ padding: isMobile ? '0 10px 12px' : '0 20px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 2 }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {Array.from({ length: miniStartDow }).map((_, i) => <div key={`e${i}`} />)}
          {miniDays.map(day => {
            const iso = format(day, 'yyyy-MM-dd')
            const dayItems = itemsByDate[iso] ?? []
            const isToday = isSameDay(day, new Date())
            const maxShow = isMobile ? 1 : 2
            return (
              <div key={iso} style={{ minHeight: isMobile ? 56 : 64, padding: '3px 2px', borderRadius: 6 }}>
                <div style={{ textAlign: 'center', marginBottom: 2 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, borderRadius: '50%',
                    fontSize: 12, fontWeight: isToday ? 700 : 400,
                    background: isToday ? '#4F6CF7' : 'transparent',
                    color: isToday ? 'white' : '#374151',
                  }}>{format(day, 'd')}</span>
                </div>
                {dayItems.slice(0, maxShow).map(item => {
                  const pill = item.kind === 'event' ? EVENT_PILL : JOB_PILL
                  return (
                    <div
                      key={`${item.kind}-${item.id}`}
                      title={`${item.kind === 'event' ? 'Event' : 'Job'}: ${item.title}`}
                      style={{
                        fontSize: 9, background: pill.bg, color: pill.fg,
                        borderRadius: 3, padding: '1px 4px', marginBottom: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >{item.title}</div>
                  )
                })}
                {dayItems.length > maxShow && (
                  <div style={{ fontSize: 9, color: '#9CA3AF', paddingLeft: 2 }}>+{dayItems.length - maxShow}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  /* ─── MOBILE ─── */
  if (isMobile) {
    const today = format(new Date(), 'EEEE, MMMM d', { locale: enUS })
    const modules = [
      { icon: FileText,  label: 'Estimates',     value: String(pendingEstimates), sub: 'pending',   to: '/estimates', color: '#4F6CF7' },
      { icon: Briefcase, label: 'Jobs',           value: String(activeJobs),      sub: 'active',    to: '/jobs',      color: '#7C3AED' },
      { icon: DollarSign,label: 'Invoices',       value: fmtCurrency(outstanding),sub: 'unpaid',    to: '/invoices',  color: '#F59E0B' },
      { icon: FolderOpen,label: 'Projects',       value: String(activeProjects),  sub: 'active',    to: '/projects',  color: '#0EA5E9' },
      { icon: Users,     label: 'Clients',        value: String(clientCount),     sub: 'total',     to: '/clients',   color: '#6B7280' },
      { icon: UserCheck, label: 'Vendors & Team', value: String(activeVendors),   sub: 'active',    to: '/vendors',   color: '#10B981' },
      { icon: Package,   label: 'Inventory',      value: lowStock.length > 0 ? String(lowStock.length) : '✓', sub: lowStock.length > 0 ? 'low stock' : 'all good', to: '/inventory', color: lowStock.length > 0 ? '#EF4444' : '#10B981' },
      { icon: MessageSquare, label: 'Chat', value: unreadCount > 0 ? String(unreadCount) : '✓', sub: unreadCount > 0 ? 'unread messages' : 'all caught up', to: '/chat', color: '#0891B2', badge: unreadCount > 0 },
    ]

    return (
      <div style={{ background: '#F8F9FC', minHeight: '100vh' }}>
        <div style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '20px 20px 24px' }}>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>{today}</p>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>{new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, {firstName} 👋</h1>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { label: 'Faturamento', value: fmtCurrency(revenue) },
              { label: 'Em Aberto', value: fmtCurrency(outstanding) },
              { label: 'Active Jobs', value: String(activeJobs) },
            ].map(k => (
              <div key={k.label} style={{ background: '#F8F9FC', borderRadius: 10, padding: '12px 10px', border: '1px solid #E5E7EB', textAlign: 'center' }}>
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF', marginBottom: 4 }}>{k.label}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{k.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px 16px 0' }}>{scheduleCard}</div>

        {lowStock.length > 0 && (
          <div style={{ margin: '0 16px', background: '#FFFBEB', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #FDE68A' }}>
            <AlertTriangle size={14} strokeWidth={2} color="#F59E0B" />
            <p style={{ fontSize: 12, color: '#92400E' }}><strong>Low stock:</strong> {lowStock.length} item{lowStock.length > 1 ? 's' : ''}</p>
          </div>
        )}

        <div style={{ padding: '16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {modules.map(mod => (
            <button
              key={mod.label}
              onClick={() => navigate(mod.to)}
              style={{
                background: 'white', borderRadius: 12, padding: 16, border: '1px solid #E5E7EB',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer',
                textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8,
              }}
            >
              <div style={{ position: 'relative', width: 36, height: 36, borderRadius: 8, background: mod.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <mod.icon size={18} strokeWidth={1.75} color={mod.color} />
                {'badge' in mod && mod.badge && (
                  <div style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: '50%', background: '#4F6CF7', border: '2px solid white' }} />
                )}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: '#6B7280' }}>{mod.label}</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{mod.value}</p>
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{mod.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  /* ─── DESKTOP ─── */
  const kpis = [
    {
      label: 'Faturamento (Mês)', value: fmtCurrency(revenue), icon: DollarSign, iconColor: '#4F6CF7', iconBg: '#EEF1FE',
      pct: pctChange(revenue, prevRevenue), pctLabel: 'vs last month',
    },
    {
      label: 'Em Aberto', value: fmtCurrency(outstanding), icon: FileText, iconColor: '#F59E0B', iconBg: '#FFFBEB',
      pct: pctChange(outstanding, prevOutstanding), pctLabel: 'vs last month', invertSign: true,
    },
    {
      label: 'Total Clients', value: String(clientCount), icon: Users, iconColor: '#10B981', iconBg: '#ECFDF5',
      pct: pctChange(clientCount, prevClientCount), pctLabel: 'vs last month',
    },
    {
      label: 'Active Jobs', value: String(activeJobs), icon: Briefcase, iconColor: '#8B5CF6', iconBg: '#EDE9FE',
      pct: pctChange(activeJobs, prevActiveJobs), pctLabel: 'vs last month',
    },
  ]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{greeting}, {firstName} 👋</h2>
        <p style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>Here's what's happening with your business today.</p>
      </div>

      {/* Upcoming Events (topo — antes de qualquer outro widget) */}
      {scheduleCard}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {kpis.map(kpi => {
          const positive = kpi.invertSign ? kpi.pct <= 0 : kpi.pct >= 0
          const KpiIcon = kpi.icon
          return (
            <div key={kpi.label} style={{
              background: 'white', borderRadius: 10, padding: '20px 24px',
              border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B7280' }}>{kpi.label}</p>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: kpi.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <KpiIcon size={16} strokeWidth={2} color={kpi.iconColor} />
                </div>
              </div>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#111827', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', marginBottom: 8 }}>{kpi.value}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {positive
                  ? <TrendingUp size={13} color="#10B981" />
                  : <TrendingDown size={13} color="#EF4444" />
                }
                <span style={{ fontSize: 12, fontWeight: 600, color: positive ? '#059669' : '#DC2626' }}>
                  {kpi.pct > 0 ? '+' : ''}{kpi.pct}%
                </span>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>{kpi.pctLabel}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle style={{ width: 16, height: 16, color: '#F59E0B', flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: '#92400E' }}><strong>Low stock alert:</strong> {lowStock.map(i => `${i.name} (${i.quantity} left)`).join(' · ')}</p>
        </div>
      )}

      {/* Recent Activity + Schedule */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Recent Jobs */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Recent Jobs</p>
            <Link to="/jobs" style={{ fontSize: 12, fontWeight: 500, color: '#4F6CF7', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              See all <ArrowRight size={12} />
            </Link>
          </div>
          {jobs.length === 0
            ? <p style={{ fontSize: 13, color: '#9CA3AF', padding: '24px 20px' }}>No jobs yet.</p>
            : jobs.slice(0, 6).map(job => (
              <div key={job.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #F9FAFB' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: job.status === 'In Progress' ? '#3B82F6' : job.status === 'Completed' ? '#10B981' : job.status === 'Cancelled' ? '#EF4444' : '#9CA3AF', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clientMap[job.client_id] ?? 'Unknown'}</p>
                    <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</p>
                  </div>
                </div>
                <Badge color={statusColor(job.status)}>{job.status}</Badge>
              </div>
            ))
          }
        </div>

        {/* Recent Invoices */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Recent Invoices</p>
            <Link to="/invoices" style={{ fontSize: 12, fontWeight: 500, color: '#4F6CF7', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              See all <ArrowRight size={12} />
            </Link>
          </div>
          {invoices.length === 0
            ? <p style={{ fontSize: 13, color: '#9CA3AF', padding: '24px 20px' }}>No invoices yet.</p>
            : [...invoices].sort((a, b) => {
                // Unpaid/Overdue first, then by date desc
                const aUnpaid = a.status === 'Unpaid' || a.status === 'Overdue' ? 0 : 1
                const bUnpaid = b.status === 'Unpaid' || b.status === 'Overdue' ? 0 : 1
                if (aUnpaid !== bUnpaid) return aUnpaid - bUnpaid
                return ((b as any).date ?? b.created_at).localeCompare((a as any).date ?? a.created_at)
              }).slice(0, 6).map(inv => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #F9FAFB' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: inv.status === 'Paid' ? '#10B981' : inv.status === 'Overdue' ? '#EF4444' : '#F59E0B', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clientMap[inv.client_id] ?? 'Unknown'}</p>
                    <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{inv.number} · {fmtDateShort(inv.due_date)}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge color={statusColor(inv.status)}>{inv.status}</Badge>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', minWidth: 72, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(inv.total)}</span>
                </div>
              </div>
            ))
          }
        </div>
      </div>

    </div>
  )
}
