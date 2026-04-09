import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, UserPlus, Trash2, Phone, Mail } from 'lucide-react'
import { useTable } from '@/hooks/useSupabase'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { CLIENT_TYPES, CONTACT_ROLES, PREFERRED_CONTACTS } from '@/lib/constants'
import type { Client, ClientType, ClientContact } from '@/lib/database.types'

const typeColors: Record<string, string> = {
  Homeowner: 'blue', HOA: 'purple', Builder: 'orange', Company: 'green', Commercial: 'yellow', 'Property Manager': 'gray',
}

interface ContactForm { id?: string; name: string; role: string; phone: string; email: string; preferred_contact: string; notes: string }
const emptyContact: ContactForm = { name: '', role: 'Owner', phone: '', email: '', preferred_contact: 'Phone', notes: '' }
const emptyForm = { name: '', type: 'Homeowner' as ClientType, email: '', phone: '', address: '', notes: '' }

export default function ClientsPage() {
  const { data: clients, loading, insert, update, remove } = useTable<Client>('clients')
  const [allContacts, setAllContacts] = useState<ClientContact[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [contacts, setContacts] = useState<ContactForm[]>([])

  const fetchContacts = useCallback(async () => {
    const { data } = await supabase.from('client_contacts').select('*').order('created_at')
    if (data) setAllContacts(data as ClientContact[])
  }, [])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  const contactsByClient = allContacts.reduce<Record<string, ClientContact[]>>((acc, c) => {
    ;(acc[c.client_id] ??= []).push(c)
    return acc
  }, {})

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.type.toLowerCase().includes(search.toLowerCase())
  )

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setContacts([{ ...emptyContact }])
    setModalOpen(true)
  }

  function openEdit(client: Client) {
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
    const payload = { ...form, email: form.email || null, phone: form.phone || null, address: form.address || null, notes: form.notes || null }
    let clientId: string
    if (editing) {
      await update(editing.id, payload)
      clientId = editing.id
      // Delete existing contacts and re-insert
      await supabase.from('client_contacts').delete().eq('client_id', clientId)
    } else {
      const newClient = await insert(payload)
      clientId = (newClient as Client).id
    }

    // Insert contacts
    const validContacts = contacts.filter(c => c.name.trim())
    if (validContacts.length > 0) {
      await supabase.from('client_contacts').insert(
        validContacts.map(c => ({
          client_id: clientId,
          name: c.name,
          role: c.role || null,
          phone: c.phone || null,
          email: c.email || null,
          preferred_contact: c.preferred_contact || null,
          notes: c.notes || null,
        }))
      )
    }

    await fetchContacts()
    setModalOpen(false)
  }

  async function handleDelete() {
    if (editing && confirm('Delete this client and all their contacts?')) {
      await remove(editing.id)
      await fetchContacts()
      setModalOpen(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Add Client</Button>
      </div>

      <Card>
        <div className="border-b border-stone-100 px-4 py-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              className="w-full rounded-lg border border-stone-300 py-2 pl-10 pr-3 text-sm placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Search clients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        {loading ? <p className="p-6 text-sm text-stone-500">Loading...</p> : (
          <Table
            data={filtered}
            onRowClick={openEdit}
            columns={[
              { key: 'name', header: 'Name', render: c => <span className="font-medium">{c.name}</span> },
              { key: 'type', header: 'Type', render: c => <Badge color={typeColors[c.type] as never}>{c.type}</Badge> },
              { key: 'contacts', header: 'Contacts', render: c => {
                const cc = contactsByClient[c.id]
                if (!cc || cc.length === 0) return <span className="text-stone-400">-</span>
                return (
                  <div className="space-y-0.5">
                    {cc.slice(0, 3).map(contact => (
                      <div key={contact.id} className="flex items-center gap-1.5 text-xs">
                        <span className="font-medium">{contact.name}</span>
                        {contact.role && <Badge color="gray" className="text-[10px]">{contact.role}</Badge>}
                      </div>
                    ))}
                    {cc.length > 3 && <span className="text-[10px] text-stone-400">+{cc.length - 3} more</span>}
                  </div>
                )
              }},
              { key: 'email', header: 'Email', render: c => c.email ?? '-' },
              { key: 'phone', header: 'Phone', render: c => c.phone ?? '-' },
              { key: 'address', header: 'Address', render: c => c.address ?? '-', className: 'max-w-[200px] truncate' },
            ]}
          />
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Client' : 'New Client'} wide>
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Client Info */}
          <Input label="Company / Client Name" id="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Select
            label="Type"
            id="type"
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value as ClientType }))}
            options={CLIENT_TYPES.map(t => ({ value: t, label: t }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Company Email" id="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="Company Phone" id="phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <Input label="Address" id="address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          <Textarea label="Notes" id="notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          {/* Contacts Section */}
          <div className="border-t border-stone-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-stone-800 flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Contacts
              </h3>
              <Button variant="ghost" size="sm" onClick={addContact}><Plus className="h-3 w-3" /> Add Contact</Button>
            </div>

            {contacts.length === 0 && (
              <p className="text-sm text-stone-400 italic">No contacts yet. Click "Add Contact" to add one.</p>
            )}

            <div className="space-y-4">
              {contacts.map((contact, i) => (
                <div key={i} className="rounded-lg border border-stone-200 bg-stone-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-stone-500">Contact #{i + 1}</span>
                    <button onClick={() => removeContact(i)} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-stone-600">Name *</label>
                      <input className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm" placeholder="e.g. Kamila" value={contact.name} onChange={e => updateContact(i, 'name', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-stone-600">Role</label>
                      <select className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm" value={contact.role} onChange={e => updateContact(i, 'role', e.target.value)}>
                        {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-stone-600"><Phone className="inline h-3 w-3 mr-1" />Phone</label>
                      <input className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm" placeholder="(941) 555-0123" value={contact.phone} onChange={e => updateContact(i, 'phone', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-stone-600"><Mail className="inline h-3 w-3 mr-1" />Email</label>
                      <input className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm" placeholder="email@example.com" value={contact.email} onChange={e => updateContact(i, 'email', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-stone-600">Preferred</label>
                      <select className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm" value={contact.preferred_contact} onChange={e => updateContact(i, 'preferred_contact', e.target.value)}>
                        {PREFERRED_CONTACTS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-stone-600">Contact Notes</label>
                    <input className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm" placeholder="Optional notes..." value={contact.notes} onChange={e => updateContact(i, 'notes', e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between border-t border-stone-200 pt-4">
            {editing && <Button variant="danger" onClick={handleDelete}>Delete</Button>}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
