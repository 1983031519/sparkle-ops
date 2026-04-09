import { useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { CLIENT_TYPES } from '@/lib/constants'
import type { Client, ClientType } from '@/lib/database.types'

interface Props {
  onCreated: (client: Client) => void
}

export function InlineClientCreate({ onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'Homeowner' as ClientType, email: '', phone: '', address: '' })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('clients').insert({
      name: form.name, type: form.type,
      email: form.email || null, phone: form.phone || null, address: form.address || null, notes: null,
    } as never).select().single()
    setSaving(false)
    if (!error && data) {
      onCreated(data as Client)
      setOpen(false)
      setForm({ name: '', type: 'Homeowner', email: '', phone: '', address: '' })
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} type="button">
        <Plus className="h-3 w-3" /> New Client
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Quick Add Client">
        <div className="space-y-3">
          <Input label="Client Name" id="qc-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Select label="Type" id="qc-type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ClientType }))} options={CLIENT_TYPES.map(t => ({ value: t, label: t }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Phone" id="qc-phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <Input label="Email" id="qc-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <Input label="Address" id="qc-addr" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)} type="button">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} type="button">{saving ? 'Saving...' : 'Create Client'}</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
