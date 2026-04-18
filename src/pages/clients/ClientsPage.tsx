import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, UserPlus, Trash2, Phone, Mail, X, ArrowLeft, Edit2, FileText, Briefcase, Receipt, MapPin, ChevronRight } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTable } from '@/hooks/useSupabase'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge, statusColor } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { CLIENT_TYPES, CONTACT_ROLES, PREFERRED_CONTACTS, fmtCurrency } from '@/lib/constants'
import { useToast } from '@/components/ui/Toast'
import type { Client, ClientType, ClientContact, Invoice, Estimate, Job } from '@/lib/database.types'

const typeColors: Record<string, string> = {
  Homeowner: 'blue', HOA: 'purple', Builder: 'orange', Company: 'green', Commercial: 'yellow', 'Property Manager': 'teal',
}

function useIsMobile() {
  const [m, setM] = useState(false)
  useEffect(() => { const c = () => setM(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])
  return m
}

interface ContactForm { id?: string; name: string; role: string; phone: string; email: string; preferred_contact: string; notes: string }
const emptyContact: ContactForm = { name: '', role: 'Owner', phone: '', email: '', preferred_contact: 'Phone', notes: '' }
const emptyForm = { name: '', type: 'Homeowner' as ClientType, email: '', phone: '', address: '', notes: '' }

/* ─── Detail Panel: linked records ─── */
interface LinkedData {
  invoices: Invoice[]
  estimates: Estimate[]
  jobs: Job[]
  loading: boolean
}

function ClientDetailPanel({ client, contacts, onEdit, onClose, isMobile }: {
  client: Client
  contacts: ClientContact[]
  onEdit: () => void
  onClose: () => void
  isMobile: boolean
}) {
  const navigate = useNavigate()
  const [linked, setLinked] = useState<LinkedData>({ invoices: [], estimates: [], jobs: [], loading: true })

  useEffect(() => {
    let mounted = true
    setLinked(l => ({ ...l, loading: true }))
    Promise.all([
      supabase.from('invoices').select('id, number, status, total, due_date').eq('client_id', client.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('estimates').select('id, number, status, total, created_at').eq('client_id', client.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('jobs').select('id, title, status, division, created_at').eq('client_id', client.id).order('created_at', { ascending: false }).limit(5),
    ]).then(([inv, est, job]) => {
      if (!mounted) return
      setLinked({
        invoices: (inv.data ?? []) as Invoice[],
        estimates: (est.data ?? []) as Estimate[],
        jobs: (job.data ?? []) as Job[],
        loading: false,
      })
    })
    return () => { mounted = false }
  }, [client.id])

  const rc = typeColors[client.type] ?? 'gray'

  return (
    <div style={{
      width: isMobile ? '100%' : 380,
      flexShrink: 0,
      borderLeft: isMobile ? 'none' : '1px solid #E5E7EB',
      background: 'white',
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        {isMobile && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#4F6CF7', flexShrink: 0 }}>
            <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h2 className="text-title font-bold" style={{ margin: 0, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {client.name}
            </h2>
            <Badge color={rc as never}>{client.type}</Badge>
          </div>
        </div>
        <button onClick={onEdit} className="text-eyebrow font-medium" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, border: '1px solid #E5E7EB', background: 'white', color: '#374151', cursor: 'pointer', flexShrink: 0 }}>
          <Edit2 className="h-4 w-4" strokeWidth={1.5} /> Edit
        </button>
        {!isMobile && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9CA3AF' }}>
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {/* Contact info */}
        <div style={{ marginBottom: 20 }}>
          {client.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Mail className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
              <a href={`mailto:${client.email}`} className="text-label" style={{ color: '#4F6CF7', textDecoration: 'none' }}>{client.email}</a>
            </div>
          )}
          {client.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Phone className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
              <a href={`tel:${client.phone}`} className="text-label" style={{ color: '#374151', textDecoration: 'none' }}>{client.phone}</a>
            </div>
          )}
          {client.address && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <MapPin className="h-4 w-4 text-gray-400 shrink-0" strokeWidth={1.5} style={{ marginTop: 2 }} />
              <span className="text-label" style={{ color: '#374151' }}>{client.address}</span>
            </div>
          )}
          {!client.email && !client.phone && !client.address && (
            <p className="text-label" style={{ color: '#9CA3AF', fontStyle: 'italic' }}>No contact info on file</p>
          )}
        </div>

        {/* Contacts */}
        {contacts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h4 className="text-micro font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF', marginBottom: 8 }}>Contacts</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {contacts.map(c => (
                <div key={c.id} style={{ padding: '8px 10px', background: '#F9FAFB', borderRadius: 8, border: '1px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span className="text-label font-semibold" style={{ color: '#111827' }}>{c.name}</span>
                    {c.role && <Badge color="gray" className="text-micro">{c.role}</Badge>}
                  </div>
                  <div className="text-eyebrow" style={{ display: 'flex', gap: 12, color: '#6B7280' }}>
                    {c.phone && <span>{c.phone}</span>}
                    {c.email && <span>{c.email}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked records */}
        {linked.loading ? (
          <p className="text-label" style={{ color: '#9CA3AF', textAlign: 'center', padding: 20 }}>Loading records…</p>
        ) : (
          <>
            {/* Invoices */}
            <LinkedSection
              icon={Receipt}
              title="Invoices"
              count={linked.invoices.length}
              onViewAll={() => navigate('/invoices')}
            >
              {linked.invoices.map(inv => (
                <LinkedRow key={inv.id} onClick={() => navigate('/invoices')}>
                  <span className="text-eyebrow" style={{ fontFamily: 'monospace' }}>{inv.number}</span>
                  <Badge color={statusColor(inv.status)}>{inv.status}</Badge>
                  <span className="text-label font-semibold" style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(inv.total)}</span>
                </LinkedRow>
              ))}
            </LinkedSection>

            {/* Estimates */}
            <LinkedSection
              icon={FileText}
              title="Estimates"
              count={linked.estimates.length}
              onViewAll={() => navigate('/estimates')}
            >
              {linked.estimates.map(est => (
                <LinkedRow key={est.id} onClick={() => navigate('/estimates')}>
                  <span className="text-eyebrow" style={{ fontFamily: 'monospace' }}>{est.number}</span>
                  <Badge color={statusColor(est.status)}>{est.status}</Badge>
                  <span className="text-label font-semibold" style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(est.total)}</span>
                </LinkedRow>
              ))}
            </LinkedSection>

            {/* Jobs */}
            <LinkedSection
              icon={Briefcase}
              title="Jobs"
              count={linked.jobs.length}
              onViewAll={() => navigate('/jobs')}
            >
              {linked.jobs.map(job => (
                <LinkedRow key={job.id} onClick={() => navigate('/jobs')}>
                  <span className="text-eyebrow font-medium" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</span>
                  <Badge color={statusColor(job.status)}>{job.status}</Badge>
                </LinkedRow>
              ))}
            </LinkedSection>
          </>
        )}
      </div>
    </div>
  )
}

function LinkedSection({ icon: Icon, title, count, children, onViewAll }: {
  icon: typeof Receipt; title: string; count: number; children: React.ReactNode; onViewAll: () => void
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon className="h-4 w-4 text-gray-500" strokeWidth={1.5} />
          <h4 className="text-label font-semibold" style={{ margin: 0, color: '#374151' }}>{title}</h4>
          <span className="text-micro" style={{ color: '#9CA3AF' }}>({count})</span>
        </div>
        {count > 0 && (
          <button onClick={onViewAll} className="text-micro" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4F6CF7', display: 'flex', alignItems: 'center', gap: 2 }}>
            View all <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
      </div>
      {count === 0 ? (
        <p className="text-eyebrow" style={{ color: '#9CA3AF', fontStyle: 'italic', paddingLeft: 20 }}>None</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
      )}
    </div>
  )
}

function LinkedRow({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '7px 10px', borderRadius: 6, border: 'none',
        background: '#F9FAFB', cursor: 'pointer', textAlign: 'left',
        transition: 'background 100ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
      onMouseLeave={e => { e.currentTarget.style.background = '#F9FAFB' }}
    >
      {children}
    </button>
  )
}

/* ─── Main Page ─── */
export default function ClientsPage() {
  const { data: clients, loading, insert, update, remove } = useTable<Client>('clients')
  const [allContacts, setAllContacts] = useState<ClientContact[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [contacts, setContacts] = useState<ContactForm[]>([])
  const [saving, setSaving] = useState(false)
  const isMobile = useIsMobile()
  const toast = useToast()

  const fetchContacts = useCallback(async () => {
    const { data } = await supabase.from('client_contacts').select('*').order('created_at')
    if (data) setAllContacts(data as ClientContact[])
  }, [])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  const contactsByClient = allContacts.reduce<Record<string, ClientContact[]>>((acc, c) => {
    ;(acc[c.client_id] ??= []).push(c)
    return acc
  }, {})

  const filtered = [...clients]
    .filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.type.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setContacts([{ ...emptyContact }])
    setModalOpen(true)
  }

  // Open modal when navigated with ?new=true (from Dashboard "+ New" dropdown).
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      openNew()
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function selectClient(client: Client) {
    setSelectedClient(client)
  }

  function openEditForClient(client: Client) {
    setEditing(client)
    setForm({ name: client.name, type: client.type, email: client.email ?? '', phone: client.phone ?? '', address: client.address ?? '', notes: client.notes ?? '' })
    const existing = contactsByClient[client.id] ?? []
    setContacts(existing.length > 0
      ? existing.map(c => ({ id: c.id, name: c.name, role: c.role ?? 'Other', phone: c.phone ?? '', email: c.email ?? '', preferred_contact: c.preferred_contact ?? 'Phone', notes: c.notes ?? '' }))
      : []
    )
    setModalOpen(true)
  }

  function addContact() { setContacts(cs => [...cs, { ...emptyContact }]) }
  function removeContact(i: number) { setContacts(cs => cs.filter((_, idx) => idx !== i)) }
  function updateContact(i: number, field: keyof ContactForm, value: string) {
    setContacts(cs => cs.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Client name is required.'); return }
    setSaving(true)
    try {
      const payload = { ...form, email: form.email || null, phone: form.phone || null, address: form.address || null, notes: form.notes || null }
      let clientId: string
      if (editing) {
        await update(editing.id, payload)
        clientId = editing.id
        await supabase.from('client_contacts').delete().eq('client_id', clientId)
      } else {
        const newClient = await insert(payload)
        clientId = (newClient as Client).id
      }
      const validContacts = contacts.filter(c => c.name.trim())
      if (validContacts.length > 0) {
        const { error } = await supabase.from('client_contacts').insert(
          validContacts.map(c => ({
            client_id: clientId, name: c.name, role: c.role || null, phone: c.phone || null,
            email: c.email || null, preferred_contact: c.preferred_contact || null, notes: c.notes || null,
          })) as never
        )
        if (error) { toast.error(`Contacts error: ${error.message}`); return }
      }
      await fetchContacts()
      setModalOpen(false)
      // Refresh selected client if we edited it
      if (editing && selectedClient?.id === editing.id) {
        const updated = clients.find(c => c.id === editing.id)
        if (updated) setSelectedClient({ ...updated, ...payload } as Client)
      }
      toast.success(editing ? 'Client updated.' : 'Client saved.')
    } catch (err) {
      toast.error(`Failed to save client: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!editing || !confirm('Delete this client and all their contacts?')) return
    try {
      await remove(editing.id)
      await fetchContacts()
      setModalOpen(false)
      if (selectedClient?.id === editing.id) setSelectedClient(null)
      toast.success('Client deleted.')
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  /* ─── MOBILE: full-screen panel ─── */
  if (isMobile && selectedClient) {
    return (
      <div style={{ height: '100%', background: 'white' }}>
        <ClientDetailPanel
          client={selectedClient}
          contacts={contactsByClient[selectedClient.id] ?? []}
          onEdit={() => openEditForClient(selectedClient)}
          onClose={() => setSelectedClient(null)}
          isMobile
        />
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Client' : 'New Client'} wide>
          {renderForm()}
        </Modal>
      </div>
    )
  }

  function renderForm() {
    return (
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        <Input label="Company / Client Name" id="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
        <Select label="Type" id="type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ClientType }))} options={CLIENT_TYPES.map(t => ({ value: t, label: t }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Company Email" id="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <Input label="Company Phone" id="phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        </div>
        <Input label="Address" id="address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        <Textarea label="Notes" id="notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

        {/* Contacts Section */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Contacts
            </h3>
            <Button variant="ghost" size="sm" onClick={addContact}><Plus className="h-3 w-3" /> Add Contact</Button>
          </div>

          {contacts.length === 0 && (
            <p className="text-sm text-gray-400 italic">No contacts yet. Click &quot;Add Contact&quot; to add one.</p>
          )}

          <div className="space-y-4">
            {contacts.map((contact, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Contact #{i + 1}</span>
                  <button onClick={() => removeContact(i)} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-600">Name *</label>
                    <input className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" placeholder="e.g. Kamila" value={contact.name} onChange={e => updateContact(i, 'name', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-600">Role</label>
                    <select className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" value={contact.role} onChange={e => updateContact(i, 'role', e.target.value)}>
                      {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-600"><Phone className="inline h-3 w-3 mr-1" />Phone</label>
                    <input className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" placeholder="(941) 555-0123" value={contact.phone} onChange={e => updateContact(i, 'phone', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-600"><Mail className="inline h-3 w-3 mr-1" />Email</label>
                    <input className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" placeholder="email@example.com" value={contact.email} onChange={e => updateContact(i, 'email', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-600">Preferred</label>
                    <select className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" value={contact.preferred_contact} onChange={e => updateContact(i, 'preferred_contact', e.target.value)}>
                      {PREFERRED_CONTACTS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600">Contact Notes</label>
                  <input className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" placeholder="Optional notes..." value={contact.notes} onChange={e => updateContact(i, 'notes', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between border-t border-gray-200 pt-4">
          {editing && <Button variant="danger" onClick={handleDelete}>Delete</Button>}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
          </div>
        </div>
      </div>
    )
  }

  /* ─── DESKTOP ─── */
  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Client list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <div className="space-y-6 p-6" style={{ flex: 1, overflowY: 'auto' }}>
          <div className="flex items-center justify-end">
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Add Client</Button>
          </div>

          <Card>
            <div className="border-b border-gray-200 px-4 py-3">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-[#4F6CF7] focus:outline-none focus:ring-1 focus:ring-[#4F6CF7]/20"
                  placeholder="Search clients..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            {loading ? <p className="p-6 text-sm text-gray-500">Loading...</p> : (
              <Table
                data={filtered}
                onRowClick={selectClient}
                columns={[
                  { key: 'name', header: 'Name', render: c => (
                    <span style={{ fontWeight: selectedClient?.id === c.id ? 700 : 500, color: selectedClient?.id === c.id ? '#4F6CF7' : '#111827' }}>
                      {c.name}
                    </span>
                  )},
                  { key: 'type', header: 'Type', render: c => <Badge color={typeColors[c.type] as never}>{c.type}</Badge> },
                  ...(!selectedClient ? [
                    { key: 'contacts' as keyof Client, header: 'Contacts', render: (c: Client) => {
                      const cc = contactsByClient[c.id]
                      if (!cc || cc.length === 0) return <span className="text-gray-400">-</span>
                      return (
                        <div className="space-y-0.5">
                          {cc.slice(0, 3).map(contact => (
                            <div key={contact.id} className="flex items-center gap-1.5 text-xs">
                              <span className="font-medium">{contact.name}</span>
                              {contact.role && <Badge color="gray" className="text-micro">{contact.role}</Badge>}
                            </div>
                          ))}
                          {cc.length > 3 && <span className="text-micro text-gray-400">+{cc.length - 3} more</span>}
                        </div>
                      )
                    }},
                    { key: 'email' as keyof Client, header: 'Email', render: (c: Client) => c.email ?? '-' },
                    { key: 'phone' as keyof Client, header: 'Phone', render: (c: Client) => c.phone ?? '-' },
                  ] : []),
                ]}
              />
            )}
          </Card>
        </div>
      </div>

      {/* Detail panel */}
      {selectedClient && (
        <ClientDetailPanel
          client={selectedClient}
          contacts={contactsByClient[selectedClient.id] ?? []}
          onEdit={() => openEditForClient(selectedClient)}
          onClose={() => setSelectedClient(null)}
          isMobile={false}
        />
      )}

      {/* Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Client' : 'New Client'} wide>
        {renderForm()}
      </Modal>
    </div>
  )
}
