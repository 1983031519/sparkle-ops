import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useTable } from '@/hooks/useSupabase'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { DateInput } from '@/components/ui/DateInput'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { Supplier } from '@/lib/database.types'

const ROLES = ['Material Supplier', 'Subcontractor', 'Employee'] as const
const ROLE_COLORS: Record<string, string> = { 'Material Supplier': 'blue', Subcontractor: 'gold', Employee: 'green' }
const DIVISIONS = ['Pavers', 'Stone', 'Both'] as const
const STATUSES = ['Active', 'Inactive'] as const
const CATEGORIES = ['Pavers & Hardscape', 'Stone & Countertop', 'Sand & Base Materials', 'Sealants & Chemicals', 'Equipment & Tools', 'Other']
const TRADES = ['Paver Install', 'Stone Fabrication', 'Stone Install', 'Electrical', 'Plumbing', 'General Labor', 'Other']
const PAY_TYPES_SUB = ['Per Job', 'Hourly', 'Per SF']
const PAY_TYPES_EMP = ['Hourly', 'Salary']
const PAYMENT_METHODS = ['Check', 'Zelle', 'ACH', 'Cash']
const PAYMENT_TERMS = ['Net 15', 'Net 30', 'Net 45', 'COD', 'Prepaid']
const ROLE_TITLES = ['Crew Lead', 'Installer', 'Driver', 'Office', 'Other']

interface VForm {
  record_type: string; roles: string[]; name: string; first_name: string; last_name: string
  contact_name: string; phone: string; email: string; address: string; division: string; status: string; notes: string
  // Supplier fields
  category: string; account_number: string; payment_terms: string
  // Sub fields
  trade: string; ein: string; payment_method: string; requires_1099: boolean; pay_type: string; pay_rate: string
  // Employee fields
  role_title: string; start_date: string
}

const emptyForm: VForm = {
  record_type: 'Company', roles: [], name: '', first_name: '', last_name: '',
  contact_name: '', phone: '', email: '', address: '', division: '', status: 'Active', notes: '',
  category: '', account_number: '', payment_terms: '',
  trade: '', ein: '', payment_method: '', requires_1099: false, pay_type: '', pay_rate: '',
  role_title: '', start_date: '',
}

function displayName(s: Supplier): string {
  if (s.record_type === 'Individual' && (s.first_name || s.last_name)) {
    return [s.first_name, s.last_name].filter(Boolean).join(' ')
  }
  return s.name || 'Unnamed'
}

export default function VendorsPage() {
  const { data: vendors, loading, insert, update, remove } = useTable<Supplier>('suppliers')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('Active')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<VForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const hasRole = (r: string) => form.roles.includes(r)
  const toggleRole = (r: string) => setForm(f => ({
    ...f, roles: f.roles.includes(r) ? f.roles.filter(x => x !== r) : [...f.roles, r],
  }))

  const filtered = vendors.filter(v => {
    const name = displayName(v).toLowerCase()
    const matchSearch = name.includes(search.toLowerCase()) || (v.trade ?? '').toLowerCase().includes(search.toLowerCase()) || (v.category ?? '').toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'All' || (v.roles ?? []).includes(roleFilter)
    const matchStatus = statusFilter === 'All' || (v.status ?? 'Active') === statusFilter
    return matchSearch && matchRole && matchStatus
  })

  function openNew() { setEditing(null); setForm(emptyForm); setModalOpen(true) }

  function openEdit(v: Supplier) {
    setEditing(v)
    setForm({
      record_type: v.record_type ?? 'Company', roles: (v.roles as string[]) ?? [],
      name: v.name ?? '', first_name: v.first_name ?? '', last_name: v.last_name ?? '',
      contact_name: v.contact_name ?? '', phone: v.phone ?? '', email: v.email ?? '',
      address: v.address ?? '', division: v.division ?? '', status: v.status ?? 'Active', notes: v.notes ?? '',
      category: v.category ?? '', account_number: v.account_number ?? '', payment_terms: v.payment_terms ?? '',
      trade: v.trade ?? '', ein: v.ein ?? '', payment_method: v.payment_method ?? '',
      requires_1099: v.requires_1099 ?? false, pay_type: v.pay_type ?? '', pay_rate: v.pay_rate != null ? String(v.pay_rate) : '',
      role_title: v.role_title ?? '', start_date: v.start_date ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    const isIndividual = form.record_type === 'Individual'
    if (isIndividual && !form.first_name.trim() && !form.last_name.trim()) { toast.error('First or last name is required.'); return }
    if (!isIndividual && !form.name.trim()) { toast.error('Company name is required.'); return }

    setSaving(true)
    try {
      const computedName = isIndividual ? [form.first_name, form.last_name].filter(Boolean).join(' ') : form.name
      const payload: Record<string, unknown> = {
        name: computedName, record_type: form.record_type, roles: form.roles,
        first_name: isIndividual ? form.first_name || null : null,
        last_name: isIndividual ? form.last_name || null : null,
        contact_name: form.contact_name || null, phone: form.phone || null,
        email: form.email || null, address: form.address || null,
        division: form.division || null, status: form.status, notes: form.notes || null,
        category: hasRole('Material Supplier') ? form.category || null : null,
        account_number: hasRole('Material Supplier') ? form.account_number || null : null,
        payment_terms: hasRole('Material Supplier') ? form.payment_terms || null : null,
        trade: hasRole('Subcontractor') || hasRole('Employee') ? form.trade || null : null,
        ein: hasRole('Subcontractor') ? form.ein || null : null,
        payment_method: hasRole('Subcontractor') ? form.payment_method || null : null,
        requires_1099: hasRole('Subcontractor') ? form.requires_1099 : false,
        pay_type: (hasRole('Subcontractor') || hasRole('Employee')) ? form.pay_type || null : null,
        pay_rate: (hasRole('Subcontractor') || hasRole('Employee')) && form.pay_rate ? Number(form.pay_rate) : null,
        role_title: hasRole('Employee') ? form.role_title || null : null,
        start_date: hasRole('Employee') ? form.start_date || null : null,
      }
      if (editing) await update(editing.id, payload as Partial<Supplier>)
      else await insert(payload as Partial<Supplier>)
      setModalOpen(false)
      toast.success(editing ? 'Record updated.' : 'Record saved.')
    } catch (err) {
      toast.error(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!editing || !confirm('Delete this record?')) return
    try { await remove(editing.id); setModalOpen(false); toast.success('Record deleted.') }
    catch (err) { toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`) }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-bold text-navy-900">Vendors & Team</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Add Record</Button>
      </div>

      <Card>
        <div className="border-b border-stone-100 px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input className="w-full rounded-[10px] border border-stone-200 py-2 pl-10 pr-3 text-[13px] placeholder:text-stone-400 focus:border-navy-900 focus:outline-none focus:ring-[3px] focus:ring-navy-900/[0.08]" placeholder="Search vendors & team..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1">
            {['All', ...ROLES].map(r => (
              <button key={r} onClick={() => setRoleFilter(r)} className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${roleFilter === r ? 'bg-navy-900 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>{r}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {['Active', 'Inactive', 'All'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${statusFilter === s ? 'bg-navy-900 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>{s}</button>
            ))}
          </div>
        </div>
        {loading ? <p className="p-6 text-sm text-stone-500">Loading...</p> : (
          <Table
            data={filtered}
            onRowClick={openEdit}
            columns={[
              { key: 'name', header: 'Name', render: v => (
                <div>
                  <span className="font-medium">{displayName(v)}</span>
                  <span className="ml-1.5 text-[10px] text-stone-400">{v.record_type === 'Individual' ? 'Individual' : 'Company'}</span>
                </div>
              )},
              { key: 'roles', header: 'Roles', render: v => (
                <div className="flex flex-wrap gap-1">
                  {((v.roles as string[]) ?? []).map(r => <Badge key={r} color={(ROLE_COLORS[r] ?? 'gray') as never}>{r}</Badge>)}
                </div>
              )},
              { key: 'trade', header: 'Trade / Category', render: v => v.trade ?? v.category ?? '-' },
              { key: 'phone', header: 'Phone', render: v => v.phone ?? '-' },
              { key: 'division', header: 'Division', render: v => v.division ?? '-' },
              { key: 'status', header: 'Status', render: v => <Badge color={(v.status ?? 'Active') === 'Active' ? 'green' : 'gray'}>{v.status ?? 'Active'}</Badge> },
            ]}
          />
        )}
      </Card>

      {/* FORM MODAL */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Record' : 'New Vendor / Team Member'} wide>
        <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">

          {/* Record Type */}
          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold uppercase tracking-[0.5px] text-stone-500">Record Type</label>
            <div className="flex gap-4">
              {['Company', 'Individual'].map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="record_type" value={t} checked={form.record_type === t} onChange={() => setForm(f => ({ ...f, record_type: t }))} className="accent-navy-900" />
                  <span className="text-[13px] font-medium">{t}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Roles */}
          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold uppercase tracking-[0.5px] text-stone-500">Roles (select all that apply)</label>
            <div className="flex gap-4">
              {ROLES.map(r => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={hasRole(r)} onChange={() => toggleRole(r)} className="accent-navy-900 rounded" />
                  <span className="text-[13px] font-medium">{r}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Name */}
          {form.record_type === 'Company' ? (
            <Input label="Company Name" id="v-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="First Name" id="v-first" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required />
              <Input label="Last Name" id="v-last" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>
          )}

          {/* Common */}
          {form.record_type === 'Company' && (
            <Input label="Contact Person" id="v-contact" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone" id="v-phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <Input label="Email" id="v-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <Input label="Address" id="v-addr" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Division" id="v-div" value={form.division} onChange={e => setForm(f => ({ ...f, division: e.target.value }))} options={DIVISIONS.map(d => ({ value: d, label: d }))} />
            <Select label="Status" id="v-status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} options={STATUSES.map(s => ({ value: s, label: s }))} />
          </div>

          {/* === MATERIAL SUPPLIER FIELDS === */}
          {hasRole('Material Supplier') && (
            <div className="border rounded-lg border-blue-200 bg-blue-50/30 p-4 space-y-3">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.5px] text-blue-700">Material Supplier Details</h3>
              <Select label="Category" id="v-cat" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} options={CATEGORIES.map(c => ({ value: c, label: c }))} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Account #" id="v-acct" value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} />
                <Select label="Payment Terms" id="v-terms" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} options={PAYMENT_TERMS.map(t => ({ value: t, label: t }))} />
              </div>
            </div>
          )}

          {/* === SUBCONTRACTOR FIELDS === */}
          {hasRole('Subcontractor') && (
            <div className="border rounded-lg border-gold-500/30 bg-gold-100/30 p-4 space-y-3">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.5px] text-gold-500">Subcontractor Details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Trade" id="v-trade" value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} options={TRADES.map(t => ({ value: t, label: t }))} />
                <Input label="EIN / Tax ID" id="v-ein" value={form.ein} onChange={e => setForm(f => ({ ...f, ein: e.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Select label="Payment Method" id="v-pmethod" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))} />
                <Select label="Pay Type" id="v-ptype-sub" value={form.pay_type} onChange={e => setForm(f => ({ ...f, pay_type: e.target.value }))} options={PAY_TYPES_SUB.map(p => ({ value: p, label: p }))} />
                <Input label="Rate ($)" id="v-rate-sub" type="number" step="0.01" value={form.pay_rate} onChange={e => setForm(f => ({ ...f, pay_rate: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.requires_1099} onChange={e => setForm(f => ({ ...f, requires_1099: e.target.checked }))} className="accent-navy-900 rounded" />
                <span className="text-[13px] font-medium">Requires 1099</span>
              </label>
            </div>
          )}

          {/* === EMPLOYEE FIELDS === */}
          {hasRole('Employee') && (
            <div className="border rounded-lg border-green-200 bg-green-50/30 p-4 space-y-3">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.5px] text-green-700">Employee Details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Role / Title" id="v-roletitle" value={form.role_title} onChange={e => setForm(f => ({ ...f, role_title: e.target.value }))} options={ROLE_TITLES.map(r => ({ value: r, label: r }))} />
                <Select label="Trade" id="v-trade-emp" value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} options={TRADES.map(t => ({ value: t, label: t }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <DateInput label="Start Date" id="v-startdate" value={form.start_date} onChange={v => setForm(f => ({ ...f, start_date: v }))} />
                <Select label="Pay Type" id="v-ptype-emp" value={form.pay_type} onChange={e => setForm(f => ({ ...f, pay_type: e.target.value }))} options={PAY_TYPES_EMP.map(p => ({ value: p, label: p }))} />
                <Input label={form.pay_type === 'Salary' ? 'Annual Salary ($)' : 'Hourly Rate ($)'} id="v-rate-emp" type="number" step="0.01" value={form.pay_rate} onChange={e => setForm(f => ({ ...f, pay_rate: e.target.value }))} />
              </div>
            </div>
          )}

          <Textarea label="Notes" id="v-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          <div className="flex justify-between border-t border-stone-200 pt-4">
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
