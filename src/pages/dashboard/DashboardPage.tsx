import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, ArrowRight, Calendar as CalendarIcon, Clock, CircleDollarSign } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Badge, statusColor } from '@/components/ui/Badge'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, subDays, differenceInDays } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { fmtCurrency, fmtDateFull, fmtDateShort } from '@/lib/constants'
import { useAuth } from '@/hooks/useAuth'
import { ActionCard } from '@/components/dashboard/ActionCard'
import { NewEntityDropdown } from '@/components/dashboard/NewEntityDropdown'
import { ClickableKPI } from '@/components/dashboard/ClickableKPI'
import type { Job, Invoice, Event, Estimate } from '@/lib/database.types'

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

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 18) return 'Good afternoon'
  return 'Good evening' // 18–23 and 0–4 fallback
}

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const rawFirst = (profile?.full_name?.split(/\s+/)[0]) || user?.email?.split('@')[0] || ''
  const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1)

  const [revenue, setRevenue] = useState(0)
  const [outstanding, setOutstanding] = useState(0)
  const [activeJobs, setActiveJobs] = useState(0)
  const [jobs, setJobs] = useState<Job[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [lowStock, setLowStock] = useState<{ name: string; quantity: number; low_stock_threshold: number }[]>([])
  const [allEvents, setUpcomingEvents] = useState<Event[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [clientMap, setClientMap] = useState<Record<string, string>>({})
  const isMobile = useIsMobile()

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    const now = new Date()
    const thisMonthStart = startOfMonth(now).toISOString()
    const thisMonthEnd = endOfMonth(now).toISOString()

    const [jobRes, invRes, stockRes, clientsRes, estRes, evRes] = await Promise.all([
      supabase.from('jobs').select('id, client_id, title, status, start_date, division, created_at').order('created_at', { ascending: false }),
      supabase.from('invoices').select('id, client_id, status, total, balance_due, number, date, due_date, created_at').order('created_at', { ascending: false }),
      supabase.from('inventory').select('name, quantity, low_stock_threshold, category').eq('category', 'Materials & Stock'),
      supabase.from('clients').select('id, name'),
      supabase.from('estimates').select('id, status, created_at'),
      supabase.from('events').select('*').order('date', { ascending: true }).order('time_start', { ascending: true, nullsFirst: true }),
    ])

    const allJobs = (jobRes.data ?? []) as Job[]
    const allInvoices = (invRes.data ?? []) as Invoice[]
    setJobs(allJobs)
    setInvoices(allInvoices)
    setEstimates((estRes.data ?? []) as Estimate[])
    setClientMap(Object.fromEntries((clientsRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name])))

    // Revenue (current month): all invoices dated this month
    const thisMonthInvoices = allInvoices.filter(i => {
      const d = i.date ?? i.created_at
      return d && d >= thisMonthStart.slice(0, 10) && d <= thisMonthEnd.slice(0, 10)
    })
    const rev = thisMonthInvoices.reduce((s, i) => s + (i.total || 0), 0)
    const out = allInvoices.filter(i => i.status === 'Unpaid' || i.status === 'Overdue').reduce((s, i) => s + (i.total || 0), 0)
    const aj = allJobs.filter(j => j.status === 'In Progress' || j.status === 'Scheduled').length

    setRevenue(rev)
    setOutstanding(out)
    setActiveJobs(aj)

    const items = (stockRes.data ?? []) as { name: string; quantity: number; low_stock_threshold: number }[]
    setLowStock(items.filter(i => i.quantity <= i.low_stock_threshold))

    setUpcomingEvents((evRes.data ?? []) as Event[])
  }

  /* ─── Date helpers ─── */
  const today = new Date()
  const todayIsoStr = format(today, 'yyyy-MM-dd')
  const dateSubtext = fmtDateFull(today)
  const greeting = greetingFor(today.getHours())

  /* ─── Action Row data ─── */

  // Collect Today: Overdue status OR (Unpaid with due_date < today).
  // Hybrid criterion because "Overdue" status on the DB is set manually today;
  // using due_date fallback catches unpaid invoices the DB hasn't been marked overdue yet.
  const collectInvoices = invoices.filter(i => {
    if (i.status === 'Overdue') return true
    if (i.status === 'Unpaid' && i.due_date && i.due_date < todayIsoStr) return true
    return false
  })
  const collectTotal = collectInvoices.reduce((s, i) => s + (i.total || 0), 0)
  const collectCount = collectInvoices.length

  // Follow Up: estimates with status='Sent' created 7+ days ago.
  // TODO: adicionar coluna sent_at em estimates (migração Supabase) para precisão.
  // Fase futura de refino do ciclo de vida de estimates.
  const sevenDaysAgoIso = format(subDays(today, 7), 'yyyy-MM-dd')
  const followUpEstimates = estimates.filter(e => e.status === 'Sent' && e.created_at.slice(0, 10) < sevenDaysAgoIso)
  const followUpCount = followUpEstimates.length

  // Today's Schedule: events with date=today + jobs with start_date=today.
  const todayEvents = allEvents.filter(e => e.date === todayIsoStr)
  const todayJobs = jobs.filter(j => j.start_date && j.start_date.slice(0, 10) === todayIsoStr)
  const todayScheduleCount = todayEvents.length + todayJobs.length

  /* ─── Unified "Schedule" card (Upcoming list + monthly mini-calendar) ─── */

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
    <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '12px 14px' : '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarIcon className="h-4 w-4" strokeWidth={1.5} color="#4F6CF7" />
          <p className="text-label font-semibold text-gray-900">Schedule</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 10 }}>
            <span className="text-micro font-normal text-gray-500" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: EVENT_PILL.bg, border: `1px solid ${EVENT_PILL.fg}` }} /> Events
            </span>
            <span className="text-micro font-normal text-gray-500" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: JOB_PILL.bg }} /> Jobs
            </span>
          </div>
        </div>
        <Link to="/schedule" className="text-micro font-medium" style={{ color: '#4F6CF7', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          See all <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
        </Link>
      </div>

      {/* Section 1: Upcoming list */}
      <div className="text-eyebrow uppercase text-gray-400" style={{ padding: isMobile ? '10px 14px 4px' : '12px 20px 4px' }}>
        Upcoming
      </div>
      {upcomingList.length === 0
        ? <p className="text-label font-normal text-gray-400" style={{ padding: isMobile ? '4px 14px 16px' : '4px 20px 20px' }}>Nothing coming up. Create an event or schedule a job.</p>
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
                  {/* exception: 9px density — Phase 4 spec */}
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', opacity: 0.8 }}>{format(d, 'MMM')}</span>
                  <span className={`${isMobile ? 'text-label' : 'text-body'} font-bold`} style={{ lineHeight: 1 }}>{format(d, 'd')}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span className="text-label font-semibold text-gray-900" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                    <span className="text-micro font-semibold" style={{ padding: '2px 6px', borderRadius: 4, background: meta.bg, color: meta.fg, flexShrink: 0 }}>{label}</span>
                  </div>
                  {item.kind === 'event' && item.time_start && (
                    <p className="text-micro font-normal text-gray-500" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock className="h-4 w-4" strokeWidth={1.5} /> {fmtEventTime(item.time_start)}
                    </p>
                  )}
                </div>
              </Link>
            )
          })
      }

      {/* Section 2: mini calendar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '12px 14px 6px' : '14px 20px 6px', borderTop: '1px solid #F3F4F6' }}>
        <span className="text-eyebrow uppercase text-gray-400">{format(currentMonth, 'MMMM yyyy', { locale: enUS })}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', padding: '3px 6px', color: '#6B7280', display: 'flex', alignItems: 'center' }}><ChevronLeft className="h-4 w-4" strokeWidth={1.5} /></button>
          <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', padding: '3px 6px', color: '#6B7280', display: 'flex', alignItems: 'center' }}><ChevronRight className="h-4 w-4" strokeWidth={1.5} /></button>
        </div>
      </div>
      <div style={{ padding: isMobile ? '0 10px 12px' : '0 20px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 2 }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-micro uppercase font-semibold text-gray-400" style={{ letterSpacing: '0.05em', padding: '4px 0' }}>{d}</div>
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
                  {/* Calendar circle — inline fontSize kept to fit 22x22 cell (P7 exception) */}
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
                      // exception: 9px density — Phase 4 spec
                      style={{
                        fontSize: 9, background: pill.bg, color: pill.fg,
                        borderRadius: 3, padding: '1px 4px', marginBottom: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >{item.title}</div>
                  )
                })}
                {dayItems.length > maxShow && (
                  /* exception: 9px density — Phase 4 spec */
                  <div style={{ fontSize: 9, color: '#9CA3AF', paddingLeft: 2 }}>+{dayItems.length - maxShow}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  /* ─── Collect card (replaces "Recent Invoices") ─── */
  // Sort: Overdue first (by days_overdue desc), then Unpaid-past-due (by invoice date asc — oldest first).
  // Excludes Unpaid invoices still within due_date (not actionable yet).
  const collectSorted = [...collectInvoices].sort((a, b) => {
    const aOverdue = a.status === 'Overdue' ? 0 : 1
    const bOverdue = b.status === 'Overdue' ? 0 : 1
    if (aOverdue !== bOverdue) return aOverdue - bOverdue

    if (a.status === 'Overdue' && b.status === 'Overdue') {
      // Both Overdue — sort by days overdue desc (most overdue first)
      const aDays = a.due_date ? differenceInDays(today, parseISO(a.due_date)) : 0
      const bDays = b.due_date ? differenceInDays(today, parseISO(b.due_date)) : 0
      return bDays - aDays
    }
    // Both Unpaid-past-due — oldest invoice date first
    const aDate = a.date ?? a.created_at
    const bDate = b.date ?? b.created_at
    return aDate.localeCompare(bDate)
  })

  const collectCard = (
    <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
        <p className="text-body font-semibold text-gray-900">Collect</p>
        <Link to="/invoices" className="text-eyebrow font-medium" style={{ color: '#4F6CF7', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          View all <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
        </Link>
      </div>
      {collectSorted.length === 0
        ? <p className="text-label font-normal text-gray-400" style={{ padding: '24px 20px' }}>Nothing to collect. All invoices current.</p>
        : collectSorted.slice(0, 6).map(inv => (
            <Link key={inv.id} to="/invoices" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 20px', borderBottom: '1px solid #F9FAFB', textDecoration: 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: inv.status === 'Overdue' ? '#DC2626' : '#D97706', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <p className="text-label text-gray-900" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clientMap[inv.client_id] ?? 'Unknown'}</p>
                  <p className="text-micro font-normal text-gray-400" style={{ marginTop: 1 }}>{inv.number} · due {fmtDateShort(inv.due_date)}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge color={statusColor(inv.status)}>{inv.status}</Badge>
                <span className="text-label font-semibold text-gray-900" style={{ minWidth: 72, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(inv.total)}</span>
              </div>
            </Link>
          ))
      }
    </div>
  )

  /* ─── Action Cards ─── */

  const collectHasWork = collectCount > 0
  const followUpHasWork = followUpCount > 0
  const scheduleHasToday = todayScheduleCount > 0

  const actionCards = (
    <>
      <ActionCard
        icon={<CircleDollarSign className={`h-5 w-5 ${collectHasWork ? 'text-red-600' : 'text-green-600'}`} strokeWidth={1.5} />}
        title="Collect Today"
        value={collectHasWork ? fmtCurrency(collectTotal) : 'All caught up'}
        sub={collectHasWork ? `${collectCount} invoice${collectCount === 1 ? '' : 's'} overdue` : 'Nothing to collect'}
        href="/invoices"
        emptyState={!collectHasWork}
      />
      <ActionCard
        icon={<Clock className={`h-5 w-5 ${followUpHasWork ? 'text-amber-600' : 'text-gray-400'}`} strokeWidth={1.5} />}
        title="Follow Up"
        value={followUpHasWork ? String(followUpCount) : '0'}
        sub={followUpHasWork ? 'Estimates waiting 7+ days' : 'No pending follow-ups'}
        href="/estimates"
        emptyState={!followUpHasWork}
      />
      <ActionCard
        icon={<CalendarIcon className="h-5 w-5 text-[#4F6CF7]" strokeWidth={1.5} />}
        title="Today's Schedule"
        value={String(todayScheduleCount)}
        sub={scheduleHasToday ? `${todayEvents.length} event${todayEvents.length === 1 ? '' : 's'} · ${todayJobs.length} job${todayJobs.length === 1 ? '' : 's'}` : 'No schedule today'}
        href="/schedule"
        emptyState={!scheduleHasToday}
      />
    </>
  )

  /* ─── KPI Cards ─── */
  const kpiCards = (
    <>
      <ClickableKPI label="Revenue (Month)" value={fmtCurrency(revenue)} href="/reports" />
      <ClickableKPI label="Outstanding" value={fmtCurrency(outstanding)} href="/invoices" />
      <ClickableKPI label="Active Jobs" value={String(activeJobs)} href="/jobs" />
    </>
  )

  /* ─── MOBILE ─── */
  if (isMobile) {
    return (
      <div style={{ background: '#F9FAFB', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '20px 16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 className="text-display text-gray-900">{greeting}, {firstName}.</h1>
              <p className="text-eyebrow font-normal text-gray-400" style={{ marginTop: 4 }}>{dateSubtext}</p>
            </div>
            <NewEntityDropdown compact />
          </div>
        </div>

        {/* Action Row (stack) */}
        <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {actionCards}
        </div>

        {/* KPIs — 3 in a row compact */}
        <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {kpiCards}
        </div>

        {/* Low stock alert */}
        {lowStock.length > 0 && (
          <div style={{ margin: '0 16px 16px', background: '#FFFBEB', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #FDE68A' }}>
            <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2} color="#D97706" />
            <p className="text-eyebrow font-normal" style={{ color: '#92400E' }}><strong>Low stock:</strong> {lowStock.length} item{lowStock.length > 1 ? 's' : ''}</p>
          </div>
        )}

        {/* Collect first, then Schedule (mobile ordering) */}
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          {collectCard}
          {scheduleCard}
        </div>
      </div>
    )
  }

  /* ─── DESKTOP ─── */
  return (
    <div style={{ padding: '28px 32px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div>
          <h2 className="text-display text-gray-900">{greeting}, {firstName}.</h2>
          <p className="text-label font-normal text-gray-500" style={{ marginTop: 4 }}>{dateSubtext}</p>
        </div>
        <NewEntityDropdown />
      </div>

      {/* Action Row — 3 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {actionCards}
      </div>

      {/* KPI Row — 3 clickable KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {kpiCards}
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2} color="#D97706" />
          <p className="text-label font-normal" style={{ color: '#92400E' }}><strong>Low stock alert:</strong> {lowStock.map(i => `${i.name} (${i.quantity} left)`).join(' · ')}</p>
        </div>
      )}

      {/* Schedule + Collect */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {scheduleCard}
        {collectCard}
      </div>
    </div>
  )
}
