import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useTable } from '@/hooks/useSupabase'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { Supplier } from '@/lib/database.types'

const emptyForm = { name: '', contact_name: '', email: '', phone: '', address: '', notes: '' }

export default function SuppliersPage() {
  const { data: suppliers, loading, insert, update, remove } = useTable<Supplier>('suppliers')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  function openNew() { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(supplier: Supplier) {
    setEditing(supplier)
    setForm({ name: supplier.name, contact_name: supplier.contact_name ?? '', email: supplier.email ?? '', phone: supplier.phone ?? '', address: supplier.address ?? '', notes: supplier.notes ?? '' })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Supplier name is required.'); return }
    setSaving(true)
    try {
      const payload = { ...form, contact_name: form.contact_name || null, email: form.email || null, phone: form.phone || null, address: form.address || null, notes: form.notes || null }
      if (editing) await update(editing.id, payload)
      else await insert(payload)
      setModalOpen(false)
      toast.success(editing ? 'Supplier updated.' : 'Supplier saved.')
    } catch (err) {
      toast.error(`Failed to save supplier: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!editing || !confirm('Delete this supplier?')) return
    try {
      await remove(editing.id); setModalOpen(false)
      toast.success('Supplier deleted.')
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Suppliers / Vendors</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Add Supplier</Button>
      </div>

      <Card>
        <div className="border-b border-stone-100 px-4 py-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input className="w-full rounded-lg border border-stone-300 py-2 pl-10 pr-3 text-sm placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? <p className="p-6 text-sm text-stone-500">Loading...</p> : (
          <Table
            data={filtered}
            onRowClick={openEdit}
            columns={[
              { key: 'name', header: 'Company', render: s => <span className="font-medium">{s.name}</span> },
              { key: 'contact', header: 'Contact', render: s => s.contact_name ?? '-' },
              { key: 'email', header: 'Email', render: s => s.email ?? '-' },
              { key: 'phone', header: 'Phone', render: s => s.phone ?? '-' },
            ]}
          />
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Supplier' : 'New Supplier'}>
        <div className="space-y-4">
          <Input label="Company Name" id="sup-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Input label="Contact Name" id="sup-contact" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Email" id="sup-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="Phone" id="sup-phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <Input label="Address" id="sup-address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          <Textarea label="Notes" id="sup-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <div className="flex justify-between pt-2">
            {editing && <Button variant="danger" onClick={handleDelete}>Delete</Button>}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
