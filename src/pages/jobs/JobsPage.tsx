import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, ArrowRight, CheckSquare, Square, Trash2, PlusCircle, ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { DateInput } from '@/components/ui/DateInput'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge, statusColor } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { FlowIndicator } from '@/components/FlowIndicator'
import { PhotoUpload } from '@/components/PhotoUpload'
import { JobCosting } from '@/components/JobCosting'
import { JOB_DIVISIONS, JOB_STATUSES, CHANGE_ORDER_STATUSES, CHANGE_ORDER_REASONS, fmtDateShort, fmtCurrency } from '@/lib/constants'
import { useToast } from '@/components/ui/Toast'
import type { Job, JobDivision, JobStatus, Client, ChangeOrder, ChangeOrderStatus, ChecklistItem, Estimate, Invoice, Supplier } from '@/lib/database.types'

const emptyForm = {
  title: '', client_id: '', division: 'Pavers' as JobDivision, status: 'Lead' as JobStatus,
  address: '', site_address: '', re_line: '', start_date: '', notes: '', total: 0,
  assigned_to: '', materials_used: '',
}

const emptyCO = { description: '', reason: 'Area increase', qty: 1, unit: 'job', unit_price: 0, status: 'Pending Client Approval' as ChangeOrderStatus }

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [teamMembers, setTeamMembers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Job | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [newCheckItem, setNewCheckItem] = useState('')
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([])
  const [coModalOpen, setCoModalOpen] = useState(false)
  const [coForm, setCoForm] = useState(emptyCO)
  const [photos, setPhotos] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [jRes, cRes, eRes, iRes, tRes] = await Promise.all([
      supabase.from('jobs').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('estimates').select('*'),
      supabase.from('invoices').select('*'),
      supabase.from('suppliers').select('*').eq('status', 'Active').order('name'),
    ])
    setJobs((jRes.data ?? []) as Job[])
    setClients((cRes.data ?? []) as Client[])
    setEstimates((eRes.data ?? []) as Estimate[])
    setInvoices((iRes.data ?? []) as Invoice[])
    // Filter to employees and subcontractors
    const allVendors = (tRes.data ?? []) as Supplier[]
    setTeamMembers(allVendors.filter(v => {
      const roles = (v.roles as string[]) ?? []
      return roles.includes('Employee') || roles.includes('Subcontractor')
    }))
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]))
  const estMap = Object.fromEntries(estimates.map(e => [e.id, e]))
  const invByJob = Object.fromEntries(invoices.filter(i => i.job_id).map(i => [i.job_id!, i]))

  const filtered = jobs.filter(j =>
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.division.toLowerCase().includes(search.toLowerCase()) ||
    j.status.toLowerCase().includes(search.toLowerCase())
  )

  function openNew() { setEditing(null); setForm(emptyForm); setChecklist([]); setChangeOrders([]); setPhotos([]); setModalOpen(true) }

  async function openEdit(job: Job) {
    setEditing(job)
    setForm({
      title: job.title, client_id: job.client_id, division: job.division, status: job.status,
      address: job.address ?? '', site_address: job.site_address ?? '', re_line: job.re_line ?? '',
      start_date: job.start_date ?? '', notes: job.notes ?? '', total: job.total,
      assigned_to: job.assigned_to ?? '', materials_used: job.materials_used ?? '',
    })
    setChecklist((job.checklist as ChecklistItem[]) ?? [])
    setPhotos((job.photos as string[]) ?? [])
    // Fetch change orders
    const { data } = await supabase.from('change_orders').select('*').eq('job_id', job.id).order('created_at')
    setChangeOrders((data ?? []) as ChangeOrder[])
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error('Job title is required.'); return }
    if (!form.client_id) { toast.error('Please select a client.'); return }
    setSaving(true)
    try {
      const payload = {
        ...form, address: form.address || null, site_address: form.site_address || null,
        re_line: form.re_line || null, start_date: form.start_date || null,
        notes: form.notes || null, assigned_to: form.assigned_to || null,
        materials_used: form.materials_used || null, checklist,
        end_date: form.status === 'Completed' ? new Date().toISOString().split('T')[0] : null,
      }
      let error: { message: string } | null = null
      if (editing) {
        const res = await supabase.from('jobs').update(payload as never).eq('id', editing.id)
        error = res.error
      } else {
        const res = await supabase.from('jobs').insert({ ...payload, estimate_id: null, photos: [] } as never)
        error = res.error
      }
      if (error) { toast.error(`Failed to save job: ${error.message}`); return }
      await fetchAll()
      setModalOpen(false)
      toast.success(editing ? 'Job updated.' : 'Job saved.')
    } catch (err) {
      toast.error(`Failed to save job: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!editing || !confirm('Delete this job?')) return
    const { error } = await supabase.from('jobs').delete().eq('id', editing.id)
    if (error) { toast.error(`Failed to delete: ${error.message}`); return }
    await fetchAll(); setModalOpen(false)
    toast.success('Job deleted.')
  }

  // Checklist
  function addCheckItem() {
    if (!newCheckItem.trim()) return
    setChecklist(cl => [...cl, { text: newCheckItem.trim(), done: false }])
    setNewCheckItem('')
  }
  function toggleCheckItem(i: number) { setChecklist(cl => cl.map((c, idx) => idx === i ? { ...c, done: !c.done } : c)) }
  function removeCheckItem(i: number) { setChecklist(cl => cl.filter((_, idx) => idx !== i)) }

  // Change Orders
  async function saveCO() {
    if (!editing) return
    if (!coForm.description.trim()) { toast.error('Change order description is required.'); return }
    const total = coForm.qty * coForm.unit_price
    const { error } = await supabase.from('change_orders').insert({
      job_id: editing.id, date: new Date().toISOString().split('T')[0],
      description: coForm.description, reason: coForm.reason,
      qty: coForm.qty, unit: coForm.unit, unit_price: coForm.unit_price, total, status: coForm.status,
    } as never)
    if (error) { toast.error(`Failed to save change order: ${error.message}`); return }
    const { data } = await supabase.from('change_orders').select('*').eq('job_id', editing.id).order('created_at')
    setChangeOrders((data ?? []) as ChangeOrder[])
    setCoForm(emptyCO); setCoModalOpen(false)
    toast.success('Change order saved.')
  }

  async function updateCOStatus(co: ChangeOrder, status: ChangeOrderStatus) {
    const { error } = await supabase.from('change_orders').update({ status } as never).eq('id', co.id)
    if (error) { toast.error(`Failed to update: ${error.message}`); return }
    setChangeOrders(cos => cos.map(c => c.id === co.id ? { ...c, status } : c))
    toast.success(`Change order ${status.toLowerCase()}.`)
  }

  async function deleteCO(co: ChangeOrder) {
    const { error } = await supabase.from('change_orders').delete().eq('id', co.id)
    if (error) { toast.error(`Failed to delete: ${error.message}`); return }
    setChangeOrders(cos => cos.filter(c => c.id !== co.id))
  }

  // Generate Invoice from Job
  async function generateInvoice(job: Job) {
    const est = job.estimate_id ? estMap[job.estimate_id] : null
    const baseLine = est
      ? (est.line_items as { description: string; qty: number; unit: string; unit_price: number }[])
      : [{ description: job.title, qty: 1, unit: 'job', unit_price: job.total }]

    // Fetch approved change orders
    const { data: cos } = await supabase.from('change_orders').select('*').eq('job_id', job.id).eq('status', 'Approved')
    const coLines = ((cos ?? []) as ChangeOrder[]).map((co, i) => ({
      description: `Change Order #${i + 1} — ${co.description}`,
      qty: co.qty, unit: co.unit, unit_price: co.unit_price, is_change_order: true,
    }))

    const allLines = [...baseLine, ...coLines]
    const subtotal = allLines.reduce((s, l) => s + l.qty * l.unit_price, 0)
    const now = new Date()
    const dueDate = new Date(now)
    dueDate.setDate(dueDate.getDate() + 30)

    const invCount = invoices.length + 1
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')

    const { error } = await supabase.from('invoices').insert({
      number: `${y}-${m}${d}-${String(invCount).padStart(3, '0')}`,
      client_id: job.client_id, job_id: job.id, estimate_id: job.estimate_id || null,
      status: 'Unpaid', line_items: allLines, subtotal, total: subtotal,
      notes: null, due_date: dueDate.toISOString().split('T')[0],
    } as never)
    if (error) { toast.error(`Failed to generate invoice: ${error.message}`); return }
    await fetchAll()
    toast.success('Invoice generated from job.')
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Add Job</Button>
      </div>

      <Card>
        <div className="border-b border-stone-100 px-4 py-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input className="w-full rounded-lg border border-stone-300 py-2 pl-10 pr-3 text-sm placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? <p className="p-6 text-sm text-stone-500">Loading...</p> : (
          <Table
            data={filtered}
            onRowClick={openEdit}
            columns={[
              { key: 'title', header: 'Job Title', render: j => <span className="font-medium">{j.title}</span> },
              { key: 'client', header: 'Client', render: j => clientMap[j.client_id] ?? '-' },
              { key: 'division', header: 'Div', render: j => <Badge color={j.division === 'Pavers' ? 'orange' : 'blue'}>{j.division}</Badge> },
              { key: 'status', header: 'Status', render: j => <Badge color={statusColor(j.status)}>{j.status}</Badge> },
              { key: 'photos', header: 'Photos', render: j => {
                const count = (j.photos as string[])?.length ?? 0
                return count > 0 ? <span className="inline-flex items-center gap-1 text-xs text-stone-500"><ImageIcon className="h-3 w-3" />{count}</span> : <span className="text-stone-300">-</span>
              }},
              { key: 'date', header: 'Scheduled', render: j => fmtDateShort(j.start_date) },
              { key: 'amount', header: 'Amount', render: j => fmtCurrency(j.total) },
              { key: 'flow', header: 'Flow', render: j => {
                const hasEst = !!j.estimate_id
                const hasInv = !!invByJob[j.id]
                return <FlowIndicator steps={[
                  { label: 'Estimate', status: hasEst ? 'done' : 'none' },
                  { label: 'Job', status: j.status === 'Completed' ? 'done' : 'active' },
                  { label: 'Invoice', status: hasInv ? 'done' : 'pending' },
                ]} />
              }},
              { key: 'actions', header: '', render: j => (
                <div className="flex gap-2" onClick={ev => ev.stopPropagation()}>
                  {!invByJob[j.id] && (j.status === 'In Progress' || j.status === 'Completed') && (
                    <Button variant="primary" size="sm" onClick={() => generateInvoice(j)}>
                      <ArrowRight className="h-3 w-3" /> Generate Invoice
                    </Button>
                  )}
                </div>
              )},
            ]}
          />
        )}
      </Card>

      {/* JOB FORM MODAL */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Job' : 'New Job'} wide>
        <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
          {/* Flow indicator at top */}
          {editing && (
            <div className="rounded-lg bg-stone-50 p-3 flex items-center justify-between">
              <FlowIndicator steps={[
                { label: 'Estimate', status: editing.estimate_id ? 'done' : 'none' },
                { label: 'Job', status: editing.status === 'Completed' ? 'done' : 'active' },
                { label: 'Invoice', status: invByJob[editing.id] ? 'done' : 'pending' },
              ]} />
              {!invByJob[editing.id] && (editing.status === 'In Progress' || editing.status === 'Completed') && (
                <Button size="sm" onClick={() => { generateInvoice(editing); setModalOpen(false) }}>Generate Invoice</Button>
              )}
            </div>
          )}

          <Input label="Job Title" id="title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          <Select label="Client" id="client_id" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} options={clients.map(c => ({ value: c.id, label: c.name }))} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Division" id="division" value={form.division} onChange={e => setForm(f => ({ ...f, division: e.target.value as JobDivision }))} options={JOB_DIVISIONS.map(d => ({ value: d, label: d }))} />
            <Select label="Status" id="status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as JobStatus }))} options={JOB_STATUSES.map(s => ({ value: s, label: s }))} />
            <DateInput label="Scheduled Date" id="start_date" value={form.start_date} onChange={v => setForm(f => ({ ...f, start_date: v }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Job Address" id="address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            <Input label="Total Amount ($)" id="total" type="number" value={form.total} onChange={e => setForm(f => ({ ...f, total: Number(e.target.value) }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Assigned Technician" id="assigned_to" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} options={teamMembers.map(t => {
              const name = t.record_type === 'Individual' && (t.first_name || t.last_name)
                ? [t.first_name, t.last_name].filter(Boolean).join(' ')
                : t.name
              const detail = t.trade ?? t.role_title ?? ((t.roles as string[]) ?? []).join(', ')
              return { value: name, label: detail ? `${name} — ${detail}` : name }
            })} />
            <Input label="RE: Line" id="re_line" value={form.re_line} onChange={e => setForm(f => ({ ...f, re_line: e.target.value }))} />
          </div>
          <Textarea label="Description" id="notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <Textarea label="Materials Used" id="materials_used" value={form.materials_used} onChange={e => setForm(f => ({ ...f, materials_used: e.target.value }))} />

          {/* Checklist */}
          <div className="border rounded-lg border-stone-200 p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-2">Checklist</h3>
            <div className="space-y-1">
              {checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <button type="button" onClick={() => toggleCheckItem(i)}>
                    {item.done ? <CheckSquare className="h-4 w-4 text-green-600" /> : <Square className="h-4 w-4 text-stone-400" />}
                  </button>
                  <span className={item.done ? 'line-through text-stone-400' : ''}>{item.text}</span>
                  <button type="button" onClick={() => removeCheckItem(i)} className="ml-auto"><Trash2 className="h-3 w-3 text-red-400" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input className="flex-1 rounded-lg border border-stone-300 px-2 py-1.5 text-sm" placeholder="Add checklist item..." value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCheckItem())} />
              <Button variant="ghost" size="sm" type="button" onClick={addCheckItem}><PlusCircle className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Change Orders (only when editing) */}
          {editing && (
            <div className="border rounded-lg border-stone-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-stone-700">Change Orders</h3>
                <Button variant="ghost" size="sm" type="button" onClick={() => { setCoForm(emptyCO); setCoModalOpen(true) }}><Plus className="h-3 w-3" /> Add Change Order</Button>
              </div>
              {changeOrders.length === 0 ? <p className="text-xs text-stone-400">No change orders.</p> : (
                <div className="space-y-2">
                  {changeOrders.map((co, i) => (
                    <div key={co.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">CO #{i + 1}</span> — {co.description}
                        <span className="ml-2 text-xs text-stone-500">({co.reason})</span>
                        <span className="ml-2 font-medium">${co.total.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge color={co.status === 'Approved' ? 'green' : co.status === 'Declined' ? 'red' : 'yellow'}>{co.status}</Badge>
                        {co.status === 'Pending Client Approval' && (
                          <>
                            <Button variant="ghost" size="sm" type="button" onClick={() => updateCOStatus(co, 'Approved')}>Approve</Button>
                            <Button variant="ghost" size="sm" type="button" onClick={() => updateCOStatus(co, 'Declined')}>Decline</Button>
                          </>
                        )}
                        <button type="button" onClick={() => deleteCO(co)}><Trash2 className="h-3 w-3 text-red-400" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Photos */}
          {editing ? (
            <PhotoUpload jobId={editing.id} photos={photos} onPhotosChange={setPhotos} />
          ) : (
            <div className="border rounded-lg border-stone-200 p-4">
              <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2 mb-2">
                <ImageIcon className="h-4 w-4" /> Photos
              </h3>
              <p className="text-xs text-stone-400 italic">Save the job first, then you can upload photos.</p>
            </div>
          )}

          {/* Job Costing — only when editing */}
          {editing && (
            <JobCosting
              jobId={editing.id}
              jobRevenue={invByJob[editing.id]?.total ?? 0}
            />
          )}

          <div className="flex justify-between border-t border-stone-200 pt-4">
            {editing && <Button variant="danger" onClick={handleDelete} type="button">Delete</Button>}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)} type="button">Cancel</Button>
              <Button onClick={handleSave} type="button" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Change Order Modal */}
      <Modal open={coModalOpen} onClose={() => setCoModalOpen(false)} title="Add Change Order">
        <div className="space-y-4">
          <Input label="Description" id="co-desc" value={coForm.description} onChange={e => setCoForm(f => ({ ...f, description: e.target.value }))} required />
          <Select label="Reason" id="co-reason" value={coForm.reason} onChange={e => setCoForm(f => ({ ...f, reason: e.target.value }))} options={CHANGE_ORDER_REASONS.map(r => ({ value: r, label: r }))} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Qty" id="co-qty" type="number" value={coForm.qty} onChange={e => setCoForm(f => ({ ...f, qty: Number(e.target.value) }))} />
            <Input label="Unit" id="co-unit" value={coForm.unit} onChange={e => setCoForm(f => ({ ...f, unit: e.target.value }))} />
            <Input label="Unit Price ($)" id="co-price" type="number" step="0.01" value={coForm.unit_price} onChange={e => setCoForm(f => ({ ...f, unit_price: Number(e.target.value) }))} />
          </div>
          <p className="text-right text-sm font-medium">Total: ${(coForm.qty * coForm.unit_price).toFixed(2)}</p>
          <Select label="Status" id="co-status" value={coForm.status} onChange={e => setCoForm(f => ({ ...f, status: e.target.value as ChangeOrderStatus }))} options={CHANGE_ORDER_STATUSES.map(s => ({ value: s, label: s }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCoModalOpen(false)} type="button">Cancel</Button>
            <Button onClick={saveCO} type="button">Save Change Order</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
