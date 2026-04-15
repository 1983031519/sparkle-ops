import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Plus, Calendar as CalendarIcon, List as ListIcon, ChevronLeft, ChevronRight,
  Clock, MapPin, User as UserIcon, Trash2, ExternalLink, X, Building2, CheckCircle2, Link2,
} from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  parseISO, startOfWeek, endOfWeek,
} from 'date-fns'
import { enUS } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { DateInput } from '@/components/ui/DateInput'
import { buildAuthUrl, getStatus, disconnect as disconnectGoogle, syncEvent } from '@/lib/googleCalendar'
import type { Event, EventType, Client, Profile, Supplier } from '@/lib/database.types'

/* ─── Config ─── */
const TYPE_META: Record<EventType, { label: string; color: string; bg: string }> = {
  site_visit:  { label: 'Site Visit',  color: '#2563EB', bg: '#DBEAFE' },
  job_start:   { label: 'Job Start',   color: '#059669', bg: '#D1FAE5' },
  job_ongoing: { label: 'Job Ongoing', color: '#7C3AED', bg: '#EDE9FE' },
  meeting:     { label: 'Meeting',     color: '#DB2777', bg: '#FCE7F3' },
  follow_up:   { label: 'Follow-up',   color: '#D97706', bg: '#FEF3C7' },
  other:       { label: 'Other',       color: '#6B7280', bg: '#F3F4F6' },
}

const TYPE_OPTIONS = Object.entries(TYPE_META).map(([value, m]) => ({ value, label: m.label }))

function useIsMobile() {
  const [m, setM] = useState(false)
  useEffect(() => {
    const c = () => setM(window.innerWidth < 768); c()
    window.addEventListener('resize', c); return () => window.removeEventListener('resize', c)
  }, [])
  return m
}

function fmtTime(t: string | null) {
  if (!t) return ''
  // "14:30:00" -> "2:30 PM"
  const [hh, mm] = t.split(':')
  const h = parseInt(hh, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${mm} ${ampm}`
}

function timeRange(start: string | null, end: string | null) {
  if (!start && !end) return 'All day'
  if (start && end) return `${fmtTime(start)} – ${fmtTime(end)}`
  return fmtTime(start || end)
}

/** Exibe nome amigável de um profile: full_name > prefixo do email > 'Unassigned' */
export function displayName(p: Profile | null | undefined): string {
  if (!p) return 'Unassigned'
  if (p.full_name && p.full_name.trim()) return p.full_name.trim()
  if (p.email) return p.email.split('@')[0]
  return 'Unassigned'
}

export function displayInitial(p: Profile | null | undefined): string {
  return displayName(p)[0]?.toUpperCase() ?? '?'
}

/** Gera URL "Add to Google Calendar" a partir do evento */
function googleCalendarLink(ev: { title: string; date: string; time_start: string | null; time_end: string | null; notes: string | null; address: string | null }): string {
  const dateCompact = ev.date.replace(/-/g, '')
  let dates: string
  if (ev.time_start) {
    const startHms = ev.time_start.replace(/:/g, '').padEnd(6, '0').slice(0, 6)
    const endSrc = ev.time_end || ev.time_start
    const endHms = endSrc.replace(/:/g, '').padEnd(6, '0').slice(0, 6)
    dates = `${dateCompact}T${startHms}/${dateCompact}T${endHms}`
  } else {
    // All-day: end = next day
    const d = new Date(ev.date + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    const endDate = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    dates = `${dateCompact}/${endDate}`
  }
  const params = new URLSearchParams({ action: 'TEMPLATE', text: ev.title, dates })
  if (ev.notes) params.set('details', ev.notes)
  if (ev.address) params.set('location', ev.address)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/* ─── 12h Time Picker ─── */
function TimePicker({ label, value, onChange, disabled }: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
  disabled?: boolean
}) {
  // Parse "HH:MM:SS" -> { h12, m, ampm }
  const parsed = useMemo(() => {
    if (!value) return { h: '', m: '', ampm: 'AM' as 'AM' | 'PM' }
    const [hh, mm] = value.split(':')
    const h = parseInt(hh, 10)
    return { h: String(h % 12 || 12), m: mm || '00', ampm: (h >= 12 ? 'PM' : 'AM') as 'AM' | 'PM' }
  }, [value])

  function emit(h: string, m: string, ampm: 'AM' | 'PM') {
    if (!h) { onChange(null); return }
    let h24 = parseInt(h, 10) % 12
    if (ampm === 'PM') h24 += 12
    onChange(`${String(h24).padStart(2, '0')}:${(m || '00').padStart(2, '0')}:00`)
  }

  const selectStyle: React.CSSProperties = {
    height: 40, padding: '0 8px', borderRadius: 8, border: '1px solid #D1D5DB',
    background: 'white', fontSize: 14, color: '#111827',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
  }

  return (
    <div className="space-y-1.5">
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151' }}>{label}</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={parsed.h}
          onChange={e => emit(e.target.value, parsed.m || '00', parsed.ampm)}
          disabled={disabled}
          style={selectStyle}
        >
          <option value="">—</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <span style={{ color: '#6B7280', fontWeight: 600 }}>:</span>
        <select
          value={parsed.m}
          onChange={e => emit(parsed.h || '12', e.target.value, parsed.ampm)}
          disabled={disabled}
          style={selectStyle}
        >
          {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div style={{ display: 'inline-flex', background: '#F3F4F6', borderRadius: 8, padding: 3 }}>
          {(['AM', 'PM'] as const).map(a => (
            <button
              key={a}
              type="button"
              disabled={disabled}
              onClick={() => emit(parsed.h || '12', parsed.m || '00', a)}
              style={{
                padding: '6px 12px', border: 'none', borderRadius: 6,
                fontSize: 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
                background: parsed.ampm === a ? 'white' : 'transparent',
                color: parsed.ampm === a ? '#111827' : '#6B7280',
                boxShadow: parsed.ampm === a ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >{a}</button>
          ))}
        </div>
        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 11, marginLeft: 4 }}
          >Clear</button>
        )}
      </div>
    </div>
  )
}

/* ─── Page ─── */
export default function SchedulePage() {
  const { user, isAdmin, isManager } = useAuth()
  const toast = useToast()
  const isMobile = useIsMobile()

  const [events, setEvents] = useState<Event[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [vendors, setVendors] = useState<Supplier[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState<'calendar' | 'list'>(isMobile ? 'list' : 'calendar')
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [filterAssignee, setFilterAssignee] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)

  const [googleConnected, setGoogleConnected] = useState<boolean>(false)
  const [checkingGoogle, setCheckingGoogle] = useState<boolean>(true)

  const canEditEvent = useCallback(
    (e: Event) => isAdmin || isManager || e.assigned_to === user?.id || e.created_by === user?.id,
    [isAdmin, isManager, user?.id],
  )

  const load = useCallback(async () => {
    setLoading(true)
    const [evRes, clRes, vdRes, prRes] = await Promise.all([
      supabase.from('events').select('*').order('date', { ascending: true }).order('time_start', { ascending: true, nullsFirst: true }),
      supabase.from('clients').select('id, name, address').order('name'),
      supabase.from('suppliers').select('id, name, address, status').order('name'),
      supabase.from('profiles').select('id, full_name, email, role, active, created_at, updated_at').eq('active', true).order('full_name'),
    ])
    setEvents((evRes.data ?? []) as Event[])
    setClients((clRes.data ?? []) as Client[])
    setVendors(((vdRes.data ?? []) as Supplier[]).filter(v => (v.status ?? 'Active') === 'Active'))
    setProfiles((prRes.data ?? []) as Profile[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setCheckingGoogle(true)
      const s = await getStatus()
      if (mounted) { setGoogleConnected(s.connected); setCheckingGoogle(false) }
    })()
    return () => { mounted = false }
  }, [])

  /** Fire-and-forget sync — never blocks the UI. Warns on failure. */
  const fireSync = useCallback(async (
    operation: 'create' | 'update' | 'delete',
    payload: { event_id?: string; google_event_id?: string | null },
  ) => {
    if (!googleConnected) return
    const res = await syncEvent(operation, payload)
    if (res.error) toast.error(`Google Calendar: ${res.error}`)
  }, [googleConnected, toast])

  async function handleConnectGoogle() {
    try { window.location.href = buildAuthUrl() }
    catch (e) { toast.error((e as Error).message) }
  }

  async function handleDisconnectGoogle() {
    if (!confirm('Disconnect Google Calendar? New events will no longer sync.')) return
    try {
      await disconnectGoogle()
      setGoogleConnected(false)
      toast.success('Google Calendar disconnected')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients])
  const vendorMap = useMemo(() => Object.fromEntries(vendors.map(v => [v.id, v])), [vendors])
  const profileMap = useMemo(() => Object.fromEntries(profiles.map(p => [p.id, p])), [profiles])

  const filteredEvents = useMemo(() => events.filter(e => {
    if (filterAssignee && e.assigned_to !== filterAssignee) return false
    if (filterType && e.type !== filterType) return false
    return true
  }), [events, filterAssignee, filterType])

  function openNew() { setEditing(null); setModalOpen(true) }
  function openEdit(e: Event) {
    if (!canEditEvent(e)) { toast.error('You can only edit events assigned to you.'); return }
    setEditing(e); setModalOpen(true)
  }
  function closeModal() { setModalOpen(false); setEditing(null) }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event?')) return
    // Capture google_event_id BEFORE deleting so we can remove it from Google too.
    const target = events.find(e => e.id === id)
    const gid = target?.google_event_id ?? null
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Event deleted')
    if (gid) fireSync('delete', { google_event_id: gid })
    closeModal()
    load()
  }

  return (
    <div style={{ padding: isMobile ? '16px 12px' : '24px 32px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* View toggle */}
          <div style={{ display: 'inline-flex', background: '#F3F4F6', borderRadius: 8, padding: 3 }}>
            <button
              onClick={() => setView('calendar')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: view === 'calendar' ? 'white' : 'transparent',
                color: view === 'calendar' ? '#111827' : '#6B7280',
                boxShadow: view === 'calendar' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <CalendarIcon size={14} /> Calendar
            </button>
            <button
              onClick={() => setView('list')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: view === 'list' ? 'white' : 'transparent',
                color: view === 'list' ? '#111827' : '#6B7280',
                boxShadow: view === 'list' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <ListIcon size={14} /> List
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Filters */}
          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            style={{
              height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid #D1D5DB',
              background: 'white', fontSize: 12, color: '#374151', cursor: 'pointer',
            }}
          >
            <option value="">All assignees</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{displayName(p)}</option>)}
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{
              height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid #D1D5DB',
              background: 'white', fontSize: 12, color: '#374151', cursor: 'pointer',
            }}
          >
            <option value="">All types</option>
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {!checkingGoogle && (googleConnected ? (
            <button
              onClick={handleDisconnectGoogle}
              title="Disconnect Google Calendar"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 30, padding: '0 10px', borderRadius: 99,
                background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <CheckCircle2 size={12} /> Google Calendar Connected
            </button>
          ) : (
            <button
              onClick={handleConnectGoogle}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 30, padding: '0 12px', borderRadius: 8,
                background: 'white', color: '#374151', border: '1px solid #D1D5DB',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Link2 size={12} /> Connect Google Calendar
            </button>
          ))}
          <Button size="sm" onClick={openNew}>
            <Plus size={14} strokeWidth={2} /> New Event
          </Button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 13 }}>Loading…</div>
      ) : view === 'calendar' ? (
        <CalendarView
          events={filteredEvents}
          month={currentMonth}
          onPrev={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          onNext={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          onToday={() => setCurrentMonth(new Date())}
          onOpen={openEdit}
          onNewOnDate={(d) => { setEditing({ ...(makeEmpty(user?.id)), date: d } as Event); setModalOpen(true) }}
          profileMap={profileMap}
          isMobile={isMobile}
        />
      ) : (
        <ListView
          events={filteredEvents}
          onOpen={openEdit}
          clientMap={clientMap}
          vendorMap={vendorMap}
          profileMap={profileMap}
        />
      )}

      {modalOpen && (
        <EventModal
          event={editing}
          clients={clients}
          vendors={vendors}
          profiles={profiles}
          canEdit={!editing || canEditEvent(editing)}
          onClose={closeModal}
          onSaved={async ({ id, operation }) => {
            await load()
            closeModal()
            if (id) fireSync(operation, { event_id: id })
          }}
          onDelete={editing && editing.id ? () => handleDelete(editing.id) : undefined}
          userId={user?.id}
          toast={toast}
        />
      )}
    </div>
  )
}

/* ─── Calendar View ─── */
function CalendarView({
  events, month, onPrev, onNext, onToday, onOpen, onNewOnDate, profileMap, isMobile,
}: {
  events: Event[]; month: Date
  onPrev: () => void; onNext: () => void; onToday: () => void
  onOpen: (e: Event) => void
  onNewOnDate: (iso: string) => void
  profileMap: Record<string, Profile>
  isMobile: boolean
}) {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const eventsByDate = useMemo(() => {
    const m: Record<string, Event[]> = {}
    for (const ev of events) {
      if (!m[ev.date]) m[ev.date] = []
      m[ev.date].push(ev)
    }
    return m
  }, [events])

  return (
    <div style={{
      background: 'white', borderRadius: 10, border: '1px solid #E5E7EB',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: isMobile ? 12 : 20,
    }}>
      {/* Month header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onPrev} style={navBtn}><ChevronLeft size={16} /></button>
          <button onClick={onToday} style={{ ...navBtn, padding: '6px 12px', width: 'auto', fontSize: 12, fontWeight: 600 }}>Today</button>
          <button onClick={onNext} style={navBtn}><ChevronRight size={16} /></button>
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
          {format(month, 'MMMM yyyy', { locale: enUS })}
        </span>
        <div style={{ width: isMobile ? 0 : 120 }} />
      </div>

      {/* Day names */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{
            fontSize: 10, fontWeight: 600, color: '#9CA3AF',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            padding: '6px 4px', textAlign: 'center',
          }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        border: '1px solid #F3F4F6', borderRadius: 6, overflow: 'hidden',
      }}>
        {days.map((day) => {
          const iso = format(day, 'yyyy-MM-dd')
          const dayEvents = eventsByDate[iso] ?? []
          const isCurrentMonth = day.getMonth() === month.getMonth()
          const isToday = isSameDay(day, new Date())
          const maxShow = isMobile ? 2 : 3

          return (
            <div
              key={iso}
              onClick={() => onNewOnDate(iso)}
              style={{
                minHeight: isMobile ? 72 : 108,
                padding: isMobile ? 4 : 6,
                borderRight: '1px solid #F3F4F6',
                borderBottom: '1px solid #F3F4F6',
                background: isCurrentMonth ? 'white' : '#FAFAFA',
                cursor: 'pointer', overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: '50%',
                  fontSize: 11, fontWeight: isToday ? 700 : 500,
                  background: isToday ? '#4F6CF7' : 'transparent',
                  color: isToday ? 'white' : (isCurrentMonth ? '#374151' : '#9CA3AF'),
                }}>
                  {format(day, 'd')}
                </span>
              </div>
              {dayEvents.slice(0, maxShow).map(ev => {
                const meta = TYPE_META[ev.type] || TYPE_META.other
                const who = ev.assigned_to ? profileMap[ev.assigned_to] : null
                const whoInitial = who ? displayInitial(who) : ''
                return (
                  <div
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); onOpen(ev) }}
                    style={{
                      fontSize: 10, fontWeight: 500,
                      background: meta.bg, color: meta.color,
                      borderRadius: 4, padding: '2px 5px', marginBottom: 2,
                      display: 'flex', alignItems: 'center', gap: 4,
                      overflow: 'hidden', whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                    title={`${ev.title} — ${meta.label}${who ? ' · ' + displayName(who) : ''}`}
                  >
                    {ev.time_start && <span style={{ fontWeight: 600, fontSize: 9, flexShrink: 0 }}>{fmtTime(ev.time_start).replace(' ', '')}</span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>
                    {whoInitial && <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.7, flexShrink: 0 }}>{whoInitial}</span>}
                  </div>
                )
              })}
              {dayEvents.length > maxShow && (
                <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, paddingLeft: 2 }}>
                  +{dayEvents.length - maxShow} more
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14, padding: '8px 4px', borderTop: '1px solid #F3F4F6' }}>
        {TYPE_OPTIONS.map(o => {
          const m = TYPE_META[o.value as EventType]
          return (
            <div key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6B7280' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: m.bg, border: `1px solid ${m.color}` }} />
              {m.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'white', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', color: '#6B7280',
}

/* ─── List View ─── */
function ListView({
  events, onOpen, clientMap, vendorMap, profileMap,
}: {
  events: Event[]
  onOpen: (e: Event) => void
  clientMap: Record<string, Client>
  vendorMap: Record<string, Supplier>
  profileMap: Record<string, Profile>
}) {
  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, Event[]>()
    for (const ev of events) {
      if (!map.has(ev.date)) map.set(ev.date, [])
      map.get(ev.date)!.push(ev)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [events])

  if (!events.length) {
    return (
      <div style={{
        background: 'white', borderRadius: 10, border: '1px solid #E5E7EB',
        padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13,
      }}>
        No events. Click <strong>New Event</strong> to add one.
      </div>
    )
  }

  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {grouped.map(([date, evs]) => {
        const d = parseISO(date)
        const isToday = date === today
        return (
          <div key={date} style={{
            background: 'white', borderRadius: 10, border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 16px', borderBottom: '1px solid #F3F4F6',
              display: 'flex', alignItems: 'center', gap: 10,
              background: isToday ? '#EEF1FE' : '#FAFAFA',
            }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                minWidth: 44, padding: '2px 0',
                background: isToday ? '#4F6CF7' : 'white',
                color: isToday ? 'white' : '#111827',
                borderRadius: 6, border: isToday ? 'none' : '1px solid #E5E7EB',
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', opacity: 0.8 }}>{format(d, 'MMM')}</span>
                <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{format(d, 'd')}</span>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                  {isToday ? 'Today' : format(d, 'EEEE', { locale: enUS })}
                </p>
                <p style={{ fontSize: 11, color: '#6B7280' }}>{format(d, 'MMMM d, yyyy', { locale: enUS })} · {evs.length} event{evs.length > 1 ? 's' : ''}</p>
              </div>
            </div>
            {evs.map(ev => {
              const meta = TYPE_META[ev.type] || TYPE_META.other
              const who = ev.assigned_to ? profileMap[ev.assigned_to] : null
              const client = ev.client_id ? clientMap[ev.client_id] : null
              const vendor = ev.vendor_id ? vendorMap[ev.vendor_id] : null
              return (
                <div
                  key={ev.id}
                  onClick={() => onOpen(ev)}
                  style={{
                    padding: '12px 16px', borderBottom: '1px solid #F9FAFB',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
                >
                  <div style={{
                    width: 4, height: 36, borderRadius: 2,
                    background: meta.color, flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.title}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                        background: meta.bg, color: meta.color, flexShrink: 0,
                      }}>{meta.label}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 11, color: '#6B7280' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={11} />{timeRange(ev.time_start, ev.time_end)}
                      </span>
                      {client && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <UserIcon size={11} />{client.name}
                        </span>
                      )}
                      {vendor && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#7C3AED' }}>
                          <Building2 size={11} />{vendor.name}
                        </span>
                      )}
                      {ev.address && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                          <MapPin size={11} />{ev.address}
                        </span>
                      )}
                    </div>
                  </div>
                  {who && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px', borderRadius: 99,
                      background: '#F3F4F6', fontSize: 11, fontWeight: 500, color: '#374151',
                      flexShrink: 0,
                    }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: '50%', background: '#4F6CF7',
                        color: 'white', display: 'inline-flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 9, fontWeight: 700,
                      }}>
                        {displayInitial(who)}
                      </span>
                      {displayName(who)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Modal (form) ─── */
function makeEmpty(userId?: string): Omit<Event, 'id' | 'created_at'> {
  return {
    title: '',
    type: 'site_visit',
    date: format(new Date(), 'yyyy-MM-dd'),
    time_start: null,
    time_end: null,
    client_id: null,
    vendor_id: null,
    address: null,
    assigned_to: userId ?? null,
    notes: null,
    google_calendar_link: null,
    google_event_id: null,
    created_by: userId ?? null,
  }
}

function EventModal({
  event, clients, vendors, profiles, canEdit, onClose, onSaved, onDelete, userId, toast,
}: {
  event: Event | null
  clients: Client[]
  vendors: Supplier[]
  profiles: Profile[]
  canEdit: boolean
  onClose: () => void
  onSaved: (arg: { id: string | null; operation: 'create' | 'update' }) => void | Promise<void>
  onDelete?: () => void
  userId?: string
  toast: { success: (m: string) => void; error: (m: string) => void }
}) {
  const isEdit = !!(event && event.id)
  const [form, setForm] = useState<Omit<Event, 'id' | 'created_at'>>(() => {
    if (event) {
      const { id: _id, created_at: _c, ...rest } = event as Event & { id?: string; created_at?: string }
      return rest
    }
    return makeEmpty(userId)
  })
  const [saving, setSaving] = useState(false)

  function update<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function save() {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    if (!form.date) { toast.error('Date is required'); return }
    setSaving(true)
    const payload = {
      ...form,
      title: form.title.trim(),
      address: form.address?.trim() || null,
      notes: form.notes?.trim() || null,
      // google_calendar_link is auto-generated at view time — we don't persist it anymore.
      google_calendar_link: null,
      time_start: form.time_start || null,
      time_end: form.time_end || null,
      client_id: form.client_id || null,
      vendor_id: form.vendor_id || null,
      assigned_to: form.assigned_to || null,
      created_by: form.created_by || userId || null,
    }
    let savedId: string | null = null
    if (isEdit) {
      savedId = (event as Event).id
      const res = await supabase.from('events').update(payload as never).eq('id', savedId)
      setSaving(false)
      if (res.error) { toast.error(res.error.message); return }
    } else {
      const res = await supabase.from('events').insert(payload as never).select('id').single()
      setSaving(false)
      if (res.error) { toast.error(res.error.message); return }
      savedId = (res.data as { id: string } | null)?.id ?? null
    }
    toast.success(isEdit ? 'Event updated' : 'Event created')
    onSaved({ id: savedId, operation: isEdit ? 'update' : 'create' })
  }

  // When selecting a client, autofill address with the client's address (always overwrite
  // on selection so the field reflects the newly-selected client; still editable afterwards).
  // When clearing the client, keep the current address untouched so the user can type a free location.
  function onClientChange(clientId: string) {
    if (!clientId) {
      setForm(f => ({ ...f, client_id: null }))
      return
    }
    const c = clients.find(cl => cl.id === clientId)
    setForm(f => ({
      ...f,
      client_id: clientId,
      address: c?.address ?? f.address,
    }))
  }

  // Vendor selection mirrors client behavior: selecting overwrites address with vendor.address.
  function onVendorChange(vendorId: string) {
    if (!vendorId) {
      setForm(f => ({ ...f, vendor_id: null }))
      return
    }
    const v = vendors.find(vd => vd.id === vendorId)
    setForm(f => ({
      ...f,
      vendor_id: vendorId,
      address: v?.address ?? f.address,
    }))
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Event' : 'New Event'} wide>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Input
            label="Title *"
            value={form.title}
            onChange={e => update('title', e.target.value)}
            placeholder="e.g. Site visit at Smith residence"
            disabled={!canEdit}
          />
        </div>

        <Select
          label="Type *"
          value={form.type}
          onChange={e => update('type', e.target.value as EventType)}
          options={TYPE_OPTIONS}
          disabled={!canEdit}
        />
        <Select
          label="Assigned to"
          value={form.assigned_to ?? ''}
          onChange={e => update('assigned_to', e.target.value || null)}
          options={profiles.map(p => ({ value: p.id, label: displayName(p) }))}
          disabled={!canEdit}
        />

        <DateInput
          label="Date *"
          value={form.date}
          onChange={iso => update('date', iso)}
          required
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <TimePicker label="Start" value={form.time_start} onChange={v => update('time_start', v)} disabled={!canEdit} />
          <TimePicker label="End" value={form.time_end} onChange={v => update('time_end', v)} disabled={!canEdit} />
        </div>

        <Select
          label="Client"
          value={form.client_id ?? ''}
          onChange={e => onClientChange(e.target.value)}
          options={clients.map(c => ({ value: c.id, label: c.name }))}
          disabled={!canEdit}
        />
        <Select
          label="Vendor"
          value={form.vendor_id ?? ''}
          onChange={e => onVendorChange(e.target.value)}
          options={vendors.map(v => ({ value: v.id, label: v.name }))}
          disabled={!canEdit}
        />
        <div style={{ gridColumn: '1 / -1' }}>
          <Input
            label="Address"
            value={form.address ?? ''}
            onChange={e => update('address', e.target.value || null)}
            placeholder="Site or vendor address"
            disabled={!canEdit}
          />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Textarea
            label="Notes"
            value={form.notes ?? ''}
            onChange={e => update('notes', e.target.value || null)}
            rows={3}
            disabled={!canEdit}
          />
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 20, paddingTop: 16, borderTop: '1px solid #F3F4F6', gap: 8,
      }}>
        <div>
          {isEdit && canEdit && onDelete && (
            <Button variant="danger" size="sm" onClick={onDelete}>
              <Trash2 size={14} /> Delete
            </Button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isEdit && form.title && form.date && (
            <a
              href={googleCalendarLink({
                title: form.title,
                date: form.date,
                time_start: form.time_start,
                time_end: form.time_end,
                notes: form.notes,
                address: form.address,
              })}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8, border: '1px solid #E5E7EB',
                background: 'white', color: '#374151', fontSize: 13, fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={13} /> Add to Google Calendar
            </a>
          )}
          <Button variant="secondary" size="md" onClick={onClose}>
            <X size={14} /> Cancel
          </Button>
          {canEdit && (
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
