import { useEffect, useState, useMemo } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, ArrowRight, Calendar as CalendarIcon, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, subDays, differenceInDays } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { fmtCurrency, fmtDateFull, fmtDateShort } from '@/lib/constants'
import { useAuth } from '@/hooks/useAuth'
import { NewEntityDropdown } from '@/components/dashboard/NewEntityDropdown'
import type { Job, Invoice, Event, Estimate } from '@/lib/database.types'

type WeatherData = { temp: number; precip: number }
type ActivityItem = { id: string; label: string; sub: string; time: string; kind: 'invoice' | 'job' | 'estimate' }

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
  return 'Good evening'
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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const isMobile = useIsMobile()

  useEffect(() => { loadDashboard() }, [])

  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=27.4989&longitude=-82.5748&current=temperature_2m&daily=precipitation_probability_max&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=2')
      .then(r => r.json())
      .then(d => setWeather({ temp: Math.round(d.current.temperature_2m as number), precip: (d.daily.precipitation_probability_max as number[])[0] }))
      .catch(() => {})
  }, [])

  async function loadDashboard() {
    setLoadError(null)
    try {
      const now = new Date()
      const thisMonthStart = startOfMonth(now).toISOString()
      const thisMonthEnd = endOfMonth(now).toISOString()

      const [jobRes, invRes, stockRes, clientsRes, estRes, evRes] = await Promise.all([
        supabase.from('jobs').select('id, client_id, title, status, start_date, division, created_at').order('created_at', { ascending: false }),
        supabase.from('invoices').select('id, client_id, status, total, balance_due, number, date, due_date, created_at').order('created_at', { ascending: false }),
        supabase.from('inventory').select('name, quantity, low_stock_threshold, category').eq('category', 'Materials & Stock'),
        supabase.from('clients').select('id, name'),
        supabase.from('estimates').select('id, status, created_at, number').order('created_at', { ascending: false }),
        supabase.from('events').select('*').order('date', { ascending: true }).order('time_start', { ascending: true, nullsFirst: true }),
      ])

      const allJobs = (jobRes.data ?? []) as Job[]
      const allInvoices = (invRes.data ?? []) as Invoice[]
      setJobs(allJobs)
      setInvoices(allInvoices)
      setEstimates((estRes.data ?? []) as Estimate[])
      setClientMap(Object.fromEntries((clientsRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name])))

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
    } catch (err) {
      console.error('[Dashboard] Load error:', err)
      setLoadError(err instanceof Error ? err.message : 'Failed to load dashboard data.')
    }
  }

  /* ─── Date helpers ─── */
  const today = new Date()
  const todayIsoStr = format(today, 'yyyy-MM-dd')
  const dateSubtext = fmtDateFull(today)
  const greeting = greetingFor(today.getHours())

  /* ─── Collect ─── */
  const collectInvoices = invoices.filter(i => {
    if (i.status === 'Overdue') return true
    if (i.status === 'Unpaid' && i.due_date && i.due_date < todayIsoStr) return true
    return false
  })
  const collectTotal = collectInvoices.reduce((s, i) => s + (i.total || 0), 0)
  const collectCount = collectInvoices.length

  /* ─── Follow Up ─── */
  const sevenDaysAgoIso = format(subDays(today, 7), 'yyyy-MM-dd')
  const followUpEstimates = estimates.filter(e => e.status === 'Sent' && e.created_at.slice(0, 10) < sevenDaysAgoIso)
  const followUpCount = followUpEstimates.length

  /* ─── Collect sorted (for heroClientName) ─── */
  const collectSorted = [...collectInvoices].sort((a, b) => {
    const aOverdue = a.status === 'Overdue' ? 0 : 1
    const bOverdue = b.status === 'Overdue' ? 0 : 1
    if (aOverdue !== bOverdue) return aOverdue - bOverdue
    if (a.status === 'Overdue' && b.status === 'Overdue') {
      const aDays = a.due_date ? differenceInDays(today, parseISO(a.due_date)) : 0
      const bDays = b.due_date ? differenceInDays(today, parseISO(b.due_date)) : 0
      return bDays - aDays
    }
    const aDate = a.date ?? a.created_at
    const bDate = b.date ?? b.created_at
    return aDate.localeCompare(bDate)
  })

  const heroClientName = collectSorted[0] ? (clientMap[collectSorted[0].client_id] ?? null) : null

  /* ─── Collection rate ─── */
  const collectionRate = useMemo(() => {
    const paid = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.total, 0)
    const total = invoices.reduce((s, i) => s + i.total, 0)
    return total > 0 ? (paid / total) * 100 : 0
  }, [invoices])

  /* ─── Activity feed ─── */
  const activityFeed = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [
      ...invoices.slice(0, 12).map(i => ({
        id: `inv-${i.id}`, label: `Invoice ${i.number ?? ''}`, sub: i.status, time: i.created_at, kind: 'invoice' as const,
      })),
      ...jobs.slice(0, 12).map(j => ({
        id: `job-${j.id}`, label: j.title, sub: j.status, time: j.created_at, kind: 'job' as const,
      })),
      ...estimates.slice(0, 12).map(e => ({
        id: `est-${e.id}`, label: `Estimate ${(e as { number?: string }).number ?? ''}`, sub: e.status, time: e.created_at, kind: 'estimate' as const,
      })),
    ]
    return items.sort((a, b) => b.time.localeCompare(a.time)).slice(0, 6)
  }, [invoices, jobs, estimates])

  /* ─── Schedule card ─── */

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

  const itemsByDate: Record<string, CalItem[]> = {}
  for (const item of calItems) {
    if (!itemsByDate[item.date]) itemsByDate[item.date] = []
    itemsByDate[item.date].push(item)
  }

  const miniMonthStart = startOfMonth(currentMonth)
  const miniMonthEnd = endOfMonth(currentMonth)
  const miniDays = eachDayOfInterval({ start: miniMonthStart, end: miniMonthEnd })
  const miniStartDow = miniMonthStart.getDay()

  const EVENT_PILL = { bg: '#DBEAFE', fg: '#1E40AF' }
  const JOB_PILL   = { bg: '#1E3A8A', fg: '#FFFFFF' }

  const scheduleCard = (
    <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
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

  /* ─── Shared error banner ─── */
  const errorBanner = loadError ? (
    <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4" style={{ marginBottom: 20 }}>
      <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
      <p className="text-label text-red-700 flex-1">{loadError}</p>
      <button onClick={loadDashboard} className="text-label font-medium text-red-700 underline underline-offset-2">Retry</button>
    </div>
  ) : null

  /* ─── MOBILE ─── */
  if (isMobile) {
    return (
      <div style={{ background: '#F9FAFB', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 className="text-display text-gray-900">{greeting}, {firstName}.</h1>
              <p className="text-eyebrow font-normal text-gray-400" style={{ marginTop: 4 }}>{dateSubtext}</p>
            </div>
            <NewEntityDropdown compact />
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          {loadError && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4" style={{ marginBottom: 16 }}>
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
              <p className="text-label text-red-700 flex-1">{loadError}</p>
              <button onClick={loadDashboard} className="text-label font-medium text-red-700 underline underline-offset-2">Retry</button>
            </div>
          )}

          {/* Hero card */}
          <div style={{
            background: collectCount > 0
              ? 'linear-gradient(135deg, #991B1B 0%, #7F1D1D 100%)'
              : 'linear-gradient(135deg, #065F46 0%, #064E3B 100%)',
            borderRadius: 12, padding: '24px 20px', color: 'white', marginBottom: 12,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, marginBottom: 6 }}>
              {collectCount > 0 ? 'Action Required' : 'All Clear'}
            </p>
            <p style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>
              {collectCount > 0 ? fmtCurrency(collectTotal) : 'No overdue invoices'}
            </p>
            <p style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>
              {collectCount > 0
                ? `${collectCount} invoice${collectCount !== 1 ? 's' : ''} overdue${heroClientName ? ` · ${heroClientName}` : ''}`
                : `${invoices.filter(i => i.status === 'Unpaid').length} unpaid · all current`}
            </p>
            <Link to="/invoices" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.18)', color: 'white', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, textDecoration: 'none', marginTop: 16, border: '1px solid rgba(255,255,255,0.25)' }}>
              {collectCount > 0 ? 'Collect Now' : 'View Invoices'} <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>

          {/* 3 secondary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', borderLeft: `4px solid ${collectCount > 0 ? '#DC2626' : '#059669'}`, padding: '12px 10px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF' }}>Overdue</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginTop: 4 }}>{collectCount}</p>
              <p style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{fmtCurrency(collectTotal)}</p>
            </div>
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', borderLeft: '4px solid #1E3A8A', padding: '12px 10px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF' }}>Active</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginTop: 4 }}>{activeJobs}</p>
              <p style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Jobs</p>
            </div>
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', borderLeft: `4px solid ${followUpCount > 0 ? '#D97706' : '#E5E7EB'}`, padding: '12px 10px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF' }}>Follow Up</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginTop: 4 }}>{followUpCount}</p>
              <p style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Estimates</p>
            </div>
          </div>

          {/* Low stock */}
          {lowStock.length > 0 && (
            <div style={{ background: '#FFFBEB', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #FDE68A', marginBottom: 12 }}>
              <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2} color="#D97706" />
              <p className="text-eyebrow font-normal" style={{ color: '#92400E' }}><strong>Low stock:</strong> {lowStock.length} item{lowStock.length > 1 ? 's' : ''}</p>
            </div>
          )}

          {/* Financial pulse — stacked */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', padding: '14px 14px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF', marginBottom: 6 }}>Revenue · Month</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(revenue)}</p>
            </div>
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', padding: '14px 14px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF', marginBottom: 6 }}>Outstanding</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: outstanding > 0 ? '#D97706' : '#059669', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(outstanding)}</p>
            </div>
          </div>
          <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', padding: '14px 14px', marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF', marginBottom: 6 }}>Collection Rate · All Time</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>{collectionRate.toFixed(0)}%</p>
            <div style={{ marginTop: 8, background: '#F3F4F6', borderRadius: 4, height: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(collectionRate, 100)}%`, background: collectionRate >= 80 ? '#059669' : collectionRate >= 50 ? '#D97706' : '#DC2626', borderRadius: 4 }} />
            </div>
          </div>

          {/* Schedule + Activity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 16 }}>
            {scheduleCard}
            {/* Activity feed */}
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #F3F4F6' }}>
                <p className="text-label font-semibold text-gray-900">Recent Activity</p>
              </div>
              {activityFeed.length === 0
                ? <p className="text-label font-normal text-gray-400" style={{ padding: '20px 14px' }}>No recent activity.</p>
                : activityFeed.map(item => {
                    const kindColor = item.kind === 'invoice' ? '#1E3A8A' : item.kind === 'job' ? '#059669' : '#D97706'
                    return (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #F9FAFB' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: kindColor, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="text-label font-medium text-gray-900" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</p>
                          <p className="text-micro font-normal text-gray-400" style={{ marginTop: 1 }}>{item.sub}</p>
                        </div>
                        <p className="text-micro font-normal text-gray-400" style={{ flexShrink: 0 }}>{fmtDateShort(item.time.slice(0, 10))}</p>
                      </div>
                    )
                  })
              }
            </div>
          </div>

          {/* Weather */}
          {weather !== null && (
            <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF' }}>Bradenton, FL</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginTop: 2 }}>{weather.temp}°F</p>
              </div>
              <div style={{ height: 32, width: 1, background: '#E5E7EB' }} />
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF' }}>Rain Today</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: weather.precip > 50 ? '#1E3A8A' : '#9CA3AF', marginTop: 2 }}>{weather.precip}%</p>
              </div>
              {weather.precip > 50 && (
                <p className="text-micro font-normal" style={{ color: '#6B7280', marginLeft: 4 }}>Delays possible</p>
              )}
            </div>
          )}
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

      {errorBanner}

      {/* Section 1: Hero + 3 secondary stacked */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {/* Hero card */}
        <div style={{
          flex: 1,
          background: collectCount > 0
            ? 'linear-gradient(135deg, #991B1B 0%, #7F1D1D 100%)'
            : 'linear-gradient(135deg, #065F46 0%, #064E3B 100%)',
          borderRadius: 12, padding: '28px 32px', color: 'white',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 190,
        }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, marginBottom: 8 }}>
              {collectCount > 0 ? 'Action Required' : 'All Clear'}
            </p>
            <p style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
              {collectCount > 0 ? fmtCurrency(collectTotal) : 'No overdue invoices'}
            </p>
            <p style={{ fontSize: 15, opacity: 0.8, marginTop: 8 }}>
              {collectCount > 0
                ? `${collectCount} invoice${collectCount !== 1 ? 's' : ''} overdue${heroClientName ? ` · next: ${heroClientName}` : ''}`
                : `${invoices.filter(i => i.status === 'Unpaid').length} unpaid invoices · all within due dates`}
            </p>
          </div>
          <div style={{ marginTop: 28 }}>
            <Link to="/invoices" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)',
              color: 'white', borderRadius: 8, padding: '9px 18px',
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.25)',
            }}>
              {collectCount > 0 ? 'Collect Now' : 'View Invoices'} <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        </div>

        {/* 3 secondary stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 220, flexShrink: 0 }}>
          <div style={{ flex: 1, background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', borderLeft: `4px solid ${collectCount > 0 ? '#DC2626' : '#059669'}`, padding: '14px 16px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF' }}>Overdue</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginTop: 4 }}>{collectCount}</p>
            <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{fmtCurrency(collectTotal)}</p>
          </div>
          <div style={{ flex: 1, background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', borderLeft: '4px solid #1E3A8A', padding: '14px 16px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF' }}>Active Jobs</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginTop: 4 }}>{activeJobs}</p>
            <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>In progress & scheduled</p>
          </div>
          <div style={{ flex: 1, background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', borderLeft: `4px solid ${followUpCount > 0 ? '#D97706' : '#E5E7EB'}`, padding: '14px 16px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF' }}>Follow Up</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginTop: 4 }}>{followUpCount}</p>
            <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Estimates 7+ days</p>
          </div>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2} color="#D97706" />
          <p className="text-label font-normal" style={{ color: '#92400E' }}><strong>Low stock alert:</strong> {lowStock.map(i => `${i.name} (${i.quantity} left)`).join(' · ')}</p>
        </div>
      )}

      {/* Section 2: Financial Pulse */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', padding: '20px 24px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF', marginBottom: 8 }}>Revenue · This Month</p>
          <p style={{ fontSize: 30, fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(revenue)}</p>
        </div>
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', padding: '20px 24px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF', marginBottom: 8 }}>Collection Rate · All Time</p>
          <p style={{ fontSize: 30, fontWeight: 800, color: '#111827' }}>{collectionRate.toFixed(0)}%</p>
          <div style={{ marginTop: 10, background: '#F3F4F6', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(collectionRate, 100)}%`, background: collectionRate >= 80 ? '#059669' : collectionRate >= 50 ? '#D97706' : '#DC2626', borderRadius: 4, transition: 'width 0.6s ease' }} />
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', padding: '20px 24px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF', marginBottom: 8 }}>Outstanding</p>
          <p style={{ fontSize: 30, fontWeight: 800, color: outstanding > 0 ? '#D97706' : '#059669', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(outstanding)}</p>
        </div>
      </div>

      {/* Section 3: Operations — Schedule + Activity Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {scheduleCard}
        {/* Activity feed */}
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <p className="text-label font-semibold text-gray-900">Recent Activity</p>
          </div>
          {activityFeed.length === 0
            ? <p className="text-label font-normal text-gray-400" style={{ padding: '24px 20px' }}>No recent activity.</p>
            : activityFeed.map(item => {
                const kindColor = item.kind === 'invoice' ? '#1E3A8A' : item.kind === 'job' ? '#059669' : '#D97706'
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #F9FAFB' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: kindColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="text-label font-medium text-gray-900" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</p>
                      <p className="text-micro font-normal text-gray-400" style={{ marginTop: 1 }}>{item.sub}</p>
                    </div>
                    <p className="text-micro font-normal text-gray-400" style={{ flexShrink: 0 }}>{fmtDateShort(item.time.slice(0, 10))}</p>
                  </div>
                )
              })
          }
        </div>
      </div>

      {/* Section 4: Weather (if available) */}
      {weather !== null && (
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5E7EB', padding: '16px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF' }}>Bradenton, FL</p>
            <p style={{ fontSize: 30, fontWeight: 800, color: '#111827', marginTop: 4 }}>{weather.temp}°F</p>
          </div>
          <div style={{ height: 40, width: 1, background: '#E5E7EB' }} />
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF' }}>Rain Chance Today</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: weather.precip > 50 ? '#1E3A8A' : '#9CA3AF', marginTop: 4 }}>{weather.precip}%</p>
          </div>
          {weather.precip > 50 && (
            <p className="text-label font-normal" style={{ color: '#6B7280', marginLeft: 8 }}>Consider delays for outdoor work today.</p>
          )}
        </div>
      )}
    </div>
  )
}
