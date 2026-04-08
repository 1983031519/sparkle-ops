import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useTable } from '@/hooks/useSupabase'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { CLIENT_TYPES } from '@/lib/constants'
import type { Client, ClientType } from '@/lib/database.types'

const typeColors: Record<string, string> = {
  Homeowner: 'blue', HOA: 'purple', Builder: 'orange', Company: 'green', Commercial: 'yellow', 'Property Manager': 'gray',
}

const emptyForm = { name: '', type: 'Homeowner' as ClientType, email: '', phone: '', address: '', notes: '' }

export default function ClientsPage() {
  const { data: clients, loading, insert, update, remove } = useTable<Client>('clients')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState(emptyForm)

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.type.toLowerCase().includes(search.toLowerCase())
  )

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(client: Client) {
    setEditing(client)
    setForm({ name: client.name, type: client.type, email: client.email ?? '', phone: client.phone ?? '', address: client.address ?? '', notes: client.notes ?? '' })
    setModalOpen(true)
  }

  async function handleSave() {
    const payload = { ...form, email: form.email || null, phone: form.phone || null, address: form.address || null, notes: form.notes || null }
    if (editing) {
      await update(editing.id, payload)
    } else {
      await insert(payload)
    }
    setModalOpen(false)
  }

  async function handleDelete() {
    if (editing && confirm('Delete this client?')) {
      await remove(editing.id)
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
              { key: 'email', header: 'Email', render: c => c.email ?? '-' },
              { key: 'phone', header: 'Phone', render: c => c.phone ?? '-' },
              { key: 'address', header: 'Address', render: c => c.address ?? '-', className: 'max-w-[200px] truncate' },
            ]}
          />
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Client' : 'New Client'}>
        <div className="space-y-4">
          <Input label="Name" id="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Select
            label="Type"
            id="type"
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value as ClientType }))}
            options={CLIENT_TYPES.map(t => ({ value: t, label: t }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Email" id="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="Phone" id="phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <Input label="Address" id="address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          <Textarea label="Notes" id="notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <div className="flex justify-between pt-2">
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
