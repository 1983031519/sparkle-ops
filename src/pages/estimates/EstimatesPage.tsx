import { useState, useEffect, useRef } from 'react'
import { Plus, Search, Printer } from 'lucide-react'
import { useTable } from '@/hooks/useSupabase'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge, statusColor } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ESTIMATE_STATUSES, COMPANY } from '@/lib/constants'
import type { Estimate, EstimateStatus, EstimateLineItem, Client, Job } from '@/lib/database.types'

const emptyLine: EstimateLineItem = { description: '', qty: 1, unit: 'ea', unit_price: 0 }
const emptyForm = { client_id: '', job_id: '', status: 'Draft' as EstimateStatus, line_items: [{ ...emptyLine }], tax_rate: 7, notes: '', valid_until: '' }

export default function EstimatesPage() {
  const { data: estimates, loading, insert, update, remove, fetch: refetch } = useTable<Estimate>('estimates')
  const [clients, setClients] = useState<Client[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [editing, setEditing] = useState<Estimate | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [previewEstimate, setPreviewEstimate] = useState<Estimate | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients(data ?? []))
    supabase.from('jobs').select('*').order('title').then(({ data }) => setJobs(data ?? []))
  }, [])

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]))
  const filtered = estimates.filter(e => (clientMap[e.client_id] ?? '').toLowerCase().includes(search.toLowerCase()) || e.estimate_number.toLowerCase().includes(search.toLowerCase()))

  function calcTotals(items: EstimateLineItem[], taxRate: number) {
    const subtotal = items.reduce((s, i) => s + i.qty * i.unit_price, 0)
    const tax_amount = subtotal * (taxRate / 100)
    return { subtotal, tax_amount, total: subtotal + tax_amount }
  }

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(est: Estimate) {
    setEditing(est)
    setForm({
      client_id: est.client_id, job_id: est.job_id ?? '', status: est.status,
      line_items: (est.line_items as EstimateLineItem[]).length > 0 ? est.line_items as EstimateLineItem[] : [{ ...emptyLine }],
      tax_rate: est.tax_rate, notes: est.notes ?? '', valid_until: est.valid_until ?? '',
    })
    setModalOpen(true)
  }

  function openPreview(est: Estimate) {
    setPreviewEstimate(est)
    setPreviewOpen(true)
  }

  function addLine() { setForm(f => ({ ...f, line_items: [...f.line_items, { ...emptyLine }] })) }
  function removeLine(i: number) { setForm(f => ({ ...f, line_items: f.line_items.filter((_, idx) => idx !== i) })) }
  function updateLine(i: number, field: keyof EstimateLineItem, value: string | number) {
    setForm(f => ({ ...f, line_items: f.line_items.map((l, idx) => idx === i ? { ...l, [field]: value } : l) }))
  }

  async function handleSave() {
    const { subtotal, tax_amount, total } = calcTotals(form.line_items, form.tax_rate)
    const count = estimates.length + 1
    const payload = {
      estimate_number: editing?.estimate_number ?? `EST-${String(count).padStart(4, '0')}`,
      client_id: form.client_id, job_id: form.job_id || null, status: form.status,
      line_items: form.line_items, subtotal, tax_rate: form.tax_rate, tax_amount, total,
      notes: form.notes || null, valid_until: form.valid_until || null,
    }
    if (editing) await update(editing.id, payload)
    else await insert(payload)
    setModalOpen(false)
    refetch()
  }

  async function handleDelete() {
    if (editing && confirm('Delete this estimate?')) { await remove(editing.id); setModalOpen(false) }
  }

  const { subtotal, tax_amount, total } = calcTotals(form.line_items, form.tax_rate)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Estimates / Proposals</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> New Estimate</Button>
      </div>

      <Card>
        <div className="border-b border-stone-100 px-4 py-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input className="w-full rounded-lg border border-stone-300 py-2 pl-10 pr-3 text-sm placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" placeholder="Search estimates..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? <p className="p-6 text-sm text-stone-500">Loading...</p> : (
          <Table
            data={filtered}
            onRowClick={openEdit}
            columns={[
              { key: 'number', header: '#', render: e => <span className="font-mono text-xs">{e.estimate_number}</span> },
              { key: 'client', header: 'Client', render: e => clientMap[e.client_id] ?? '-' },
              { key: 'status', header: 'Status', render: e => <Badge color={statusColor(e.status)}>{e.status}</Badge> },
              { key: 'total', header: 'Total', render: e => `$${e.total.toLocaleString()}` },
              { key: 'valid', header: 'Valid Until', render: e => e.valid_until ?? '-' },
              { key: 'actions', header: '', render: e => (
                <Button variant="ghost" size="sm" onClick={(ev) => { ev.stopPropagation(); openPreview(e) }}>
                  <Printer className="h-4 w-4" />
                </Button>
              )},
            ]}
          />
        )}
      </Card>

      {/* Form Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Estimate' : 'New Estimate'} wide>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Client" id="est-client" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} options={clients.map(c => ({ value: c.id, label: c.name }))} />
            <Select label="Job (optional)" id="est-job" value={form.job_id} onChange={e => setForm(f => ({ ...f, job_id: e.target.value }))} options={jobs.map(j => ({ value: j.id, label: j.title }))} />
            <Select label="Status" id="est-status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as EstimateStatus }))} options={ESTIMATE_STATUSES.map(s => ({ value: s, label: s }))} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">Line Items</label>
            <div className="space-y-2">
              {form.line_items.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <input className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm" placeholder="Description" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <input className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm" type="number" placeholder="Qty" value={line.qty} onChange={e => updateLine(i, 'qty', Number(e.target.value))} />
                  </div>
                  <div className="col-span-1">
                    <input className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm" placeholder="Unit" value={line.unit} onChange={e => updateLine(i, 'unit', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <input className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm" type="number" placeholder="Price" value={line.unit_price} onChange={e => updateLine(i, 'unit_price', Number(e.target.value))} />
                  </div>
                  <div className="col-span-1 text-right text-sm font-medium">${(line.qty * line.unit_price).toFixed(2)}</div>
                  <div className="col-span-1">
                    {form.line_items.length > 1 && <button onClick={() => removeLine(i)} className="text-red-500 text-sm hover:underline">X</button>}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={addLine} className="mt-2">+ Add Line</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Tax Rate (%)" id="tax_rate" type="number" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: Number(e.target.value) }))} />
            <Input label="Valid Until" id="valid_until" type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} />
            <div className="space-y-1 text-right text-sm pt-5">
              <p>Subtotal: <strong>${subtotal.toFixed(2)}</strong></p>
              <p>Tax: <strong>${tax_amount.toFixed(2)}</strong></p>
              <p className="text-base">Total: <strong>${total.toFixed(2)}</strong></p>
            </div>
          </div>

          <Textarea label="Notes" id="est-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          <div className="flex justify-between pt-2">
            {editing && <Button variant="danger" onClick={handleDelete}>Delete</Button>}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Print Preview Modal */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Estimate Preview" wide>
        {previewEstimate && (
          <>
            <div className="mb-4 no-print">
              <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
            </div>
            <div ref={printRef} className="space-y-6 text-sm">
              <div className="flex justify-between">
                <div>
                  <h2 className="text-xl font-bold text-brand-700">{COMPANY.brand}</h2>
                  <p className="text-xs text-stone-500">{COMPANY.legal_name}</p>
                  <p className="text-xs text-stone-500">{COMPANY.address}</p>
                  <p className="text-xs text-stone-500">{COMPANY.phone} | {COMPANY.email}</p>
                </div>
                <div className="text-right">
                  <h3 className="text-lg font-bold">ESTIMATE</h3>
                  <p className="font-mono">{previewEstimate.estimate_number}</p>
                  <p className="text-stone-500">Date: {previewEstimate.created_at?.split('T')[0]}</p>
                  {previewEstimate.valid_until && <p className="text-stone-500">Valid Until: {previewEstimate.valid_until}</p>}
                </div>
              </div>

              <div>
                <p className="font-semibold">Bill To:</p>
                <p>{clientMap[previewEstimate.client_id] ?? 'N/A'}</p>
              </div>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-stone-300">
                    <th className="py-2 text-left">Description</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Unit</th>
                    <th className="py-2 text-right">Unit Price</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(previewEstimate.line_items as EstimateLineItem[]).map((item, i) => (
                    <tr key={i} className="border-b border-stone-100">
                      <td className="py-2">{item.description}</td>
                      <td className="py-2 text-right">{item.qty}</td>
                      <td className="py-2 text-right">{item.unit}</td>
                      <td className="py-2 text-right">${item.unit_price.toFixed(2)}</td>
                      <td className="py-2 text-right">${(item.qty * item.unit_price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="ml-auto w-64 space-y-1 text-right">
                <div className="flex justify-between"><span>Subtotal</span><span>${previewEstimate.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tax ({previewEstimate.tax_rate}%)</span><span>${previewEstimate.tax_amount.toFixed(2)}</span></div>
                <div className="flex justify-between border-t border-stone-300 pt-1 text-base font-bold"><span>Total</span><span>${previewEstimate.total.toFixed(2)}</span></div>
              </div>

              {previewEstimate.notes && <div><p className="font-semibold">Notes:</p><p className="text-stone-600">{previewEstimate.notes}</p></div>}

              <div className="mt-8 border-t border-stone-200 pt-4">
                <p className="text-xs text-stone-400">Authorized by: {COMPANY.signatory} | {COMPANY.brand}</p>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
