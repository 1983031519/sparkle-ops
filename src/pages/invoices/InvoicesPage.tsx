import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Printer, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { DateInput } from '@/components/ui/DateInput'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge, statusColor } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { INVOICE_STATUSES, COMPANY, paymentMethodsForClient, generateInvoiceNumber, fmtDateShort, fmtDate, fmtCurrency, isoDatePart } from '@/lib/constants'
import type { Invoice, InvoiceStatus, InvoiceLineItem, Client, Job } from '@/lib/database.types'

const emptyLine: InvoiceLineItem = { description: '', qty: 1, unit: 'ea', unit_price: 0 }
const emptyForm = { client_id: '', job_id: '', status: 'Draft' as InvoiceStatus, line_items: [{ ...emptyLine }], tax_rate: 0, notes: '', due_date: '' }

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [editing, setEditing] = useState<Invoice | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [previewInv, setPreviewInv] = useState<Invoice | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [iRes, cRes, jRes] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('jobs').select('*'),
    ])
    setInvoices((iRes.data ?? []) as Invoice[])
    setClients((cRes.data ?? []) as Client[])
    setJobs((jRes.data ?? []) as Job[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]))
  const jobMap = Object.fromEntries(jobs.map(j => [j.id, j]))

  const filtered = invoices.filter(e =>
    (clientMap[e.client_id]?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    e.invoice_number.toLowerCase().includes(search.toLowerCase())
  )

  function calcTotals(items: InvoiceLineItem[], taxRate: number) {
    const subtotal = items.reduce((s, i) => s + i.qty * i.unit_price, 0)
    const tax_amount = subtotal * (taxRate / 100)
    return { subtotal, tax_amount, total: subtotal + tax_amount }
  }

  function openNew() { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(inv: Invoice) {
    setEditing(inv)
    setForm({
      client_id: inv.client_id, job_id: inv.job_id ?? '', status: inv.status,
      line_items: (inv.line_items as InvoiceLineItem[]).length > 0 ? inv.line_items as InvoiceLineItem[] : [{ ...emptyLine }],
      tax_rate: inv.tax_rate, notes: inv.notes ?? '', due_date: inv.due_date ?? '',
    })
    setModalOpen(true)
  }
  function openPreview(inv: Invoice) { setPreviewInv(inv); setPreviewOpen(true) }

  function addLine() { setForm(f => ({ ...f, line_items: [...f.line_items, { ...emptyLine }] })) }
  function removeLine(i: number) { setForm(f => ({ ...f, line_items: f.line_items.filter((_, idx) => idx !== i) })) }
  function updateLine(i: number, field: keyof InvoiceLineItem, value: string | number) {
    setForm(f => ({ ...f, line_items: f.line_items.map((l, idx) => idx === i ? { ...l, [field]: value } : l) }))
  }

  async function handleSave() {
    const { subtotal, tax_amount, total } = calcTotals(form.line_items, form.tax_rate)
    const payload = {
      invoice_number: editing?.invoice_number ?? generateInvoiceNumber(invoices.length + 1),
      client_id: form.client_id, job_id: form.job_id || null, estimate_id: editing?.estimate_id ?? null,
      status: form.status, line_items: form.line_items, subtotal, tax_rate: form.tax_rate, tax_amount, total,
      notes: form.notes || null, due_date: form.due_date || null,
      paid_date: form.status === 'Paid' ? new Date().toISOString().split('T')[0] : null,
    }
    if (editing) await supabase.from('invoices').update(payload as never).eq('id', editing.id)
    else await supabase.from('invoices').insert(payload as never)
    await fetchAll(); setModalOpen(false)
  }

  async function markPaid(inv: Invoice) {
    await supabase.from('invoices').update({ status: 'Paid', paid_date: new Date().toISOString().split('T')[0] } as never).eq('id', inv.id)
    await fetchAll()
  }

  async function handleDelete() {
    if (editing && confirm('Delete this invoice?')) {
      await supabase.from('invoices').delete().eq('id', editing.id)
      await fetchAll(); setModalOpen(false)
    }
  }

  const { subtotal, tax_amount, total } = calcTotals(form.line_items, form.tax_rate)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> New Invoice</Button>
      </div>

      <Card>
        <div className="border-b border-stone-100 px-4 py-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input className="w-full rounded-lg border border-stone-300 py-2 pl-10 pr-3 text-sm placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? <p className="p-6 text-sm text-stone-500">Loading...</p> : (
          <Table
            data={filtered}
            onRowClick={openEdit}
            columns={[
              { key: 'number', header: '#', render: i => <span className="font-mono text-xs">{i.invoice_number}</span> },
              { key: 'client', header: 'Client', render: i => clientMap[i.client_id]?.name ?? '-' },
              { key: 'status', header: 'Status', render: i => <Badge color={statusColor(i.status)}>{i.status}</Badge> },
              { key: 'total', header: 'Total', render: i => fmtCurrency(i.total) },
              { key: 'due', header: 'Due Date', render: i => fmtDateShort(i.due_date) },
              { key: 'actions', header: '', render: i => (
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  {i.status !== 'Paid' && <Button variant="ghost" size="sm" onClick={() => markPaid(i)} title="Mark Paid"><CheckCircle className="h-4 w-4 text-green-600" /></Button>}
                  <Button variant="ghost" size="sm" onClick={() => openPreview(i)}><Printer className="h-4 w-4" /></Button>
                </div>
              )},
            ]}
          />
        )}
      </Card>

      {/* FORM MODAL */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Invoice' : 'New Invoice'} wide>
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Client" id="inv-client" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} options={clients.map(c => ({ value: c.id, label: c.name }))} />
            <Select label="Job (optional)" id="inv-job" value={form.job_id} onChange={e => setForm(f => ({ ...f, job_id: e.target.value }))} options={jobs.map(j => ({ value: j.id, label: j.title }))} />
            <Select label="Status" id="inv-status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as InvoiceStatus }))} options={INVOICE_STATUSES.map(s => ({ value: s, label: s }))} />
          </div>
          <DateInput label="Due Date" id="inv-due" value={form.due_date} onChange={v => setForm(f => ({ ...f, due_date: v }))} />

          <div>
            <label className="mb-2 block text-sm font-semibold text-stone-700">Line Items</label>
            <div className="space-y-2">
              {form.line_items.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5"><input className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm" placeholder="Description" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} /></div>
                  <div className="col-span-2"><input className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm" type="number" placeholder="Qty" value={line.qty} onChange={e => updateLine(i, 'qty', Number(e.target.value))} /></div>
                  <div className="col-span-1"><input className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm" placeholder="Unit" value={line.unit} onChange={e => updateLine(i, 'unit', e.target.value)} /></div>
                  <div className="col-span-2"><input className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm" type="number" step="0.01" placeholder="Price" value={line.unit_price} onChange={e => updateLine(i, 'unit_price', Number(e.target.value))} /></div>
                  <div className="col-span-1 text-right text-sm font-medium">${(line.qty * line.unit_price).toFixed(2)}</div>
                  <div className="col-span-1">{form.line_items.length > 1 && <button type="button" onClick={() => removeLine(i)} className="text-red-500 text-sm hover:underline">X</button>}</div>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={addLine} className="mt-2">+ Add Line</Button>
          </div>

          <div className="rounded-lg bg-stone-50 p-4 space-y-1 text-right text-sm">
            <div className="flex justify-end gap-8"><span>Subtotal:</span><strong>${subtotal.toFixed(2)}</strong></div>
            <div className="flex justify-end gap-8"><span>Tax ({form.tax_rate}%):</span><strong>${tax_amount.toFixed(2)}</strong></div>
            <div className="flex justify-end gap-8 text-base border-t border-stone-200 pt-1"><span>Total Due:</span><strong>${total.toFixed(2)}</strong></div>
          </div>

          <Textarea label="Notes" id="inv-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          <div className="flex justify-between border-t border-stone-200 pt-4">
            {editing && <Button variant="danger" onClick={handleDelete} type="button">Delete</Button>}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)} type="button">Cancel</Button>
              <Button onClick={handleSave} type="button">{editing ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* PRINT PREVIEW */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Invoice Preview" wide>
        {previewInv && <InvoicePreview inv={previewInv} client={clientMap[previewInv.client_id]} job={previewInv.job_id ? jobMap[previewInv.job_id] : undefined} />}
      </Modal>
    </div>
  )
}

/* ─── Professional Invoice Preview ─── */
function InvoicePreview({ inv, client, job }: { inv: Invoice; client?: Client; job?: Job }) {
  const items = inv.line_items as InvoiceLineItem[]
  const methods = paymentMethodsForClient(client?.type ?? 'Homeowner')

  return (
    <>
      <div className="mb-4 no-print"><Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button></div>
      <div className="space-y-6 text-sm leading-relaxed">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-brand-700">{COMPANY.legal_name}</h2>
            <p className="text-xs text-stone-500">{COMPANY.tagline}</p>
            <p className="text-xs text-stone-500">{COMPANY.address}</p>
            <p className="text-xs text-stone-500">{COMPANY.phone} | {COMPANY.email}</p>
          </div>
          <div className="text-right">
            <h3 className="text-2xl font-bold text-stone-800">INVOICE</h3>
            <p className="font-mono text-sm">{inv.invoice_number}</p>
            <p className="text-stone-500">Date: {fmtDate(isoDatePart(inv.created_at))}</p>
            {inv.due_date && <p className="text-stone-500">Due: {fmtDate(inv.due_date)}</p>}
            <Badge color={statusColor(inv.status)}>{inv.status}</Badge>
          </div>
        </div>

        {/* Bill To */}
        <div className="rounded-lg bg-stone-50 p-4">
          <p className="text-xs font-semibold uppercase text-stone-500">Bill To</p>
          <p className="font-medium">{client?.name ?? 'N/A'}</p>
          {client?.address && <p className="text-stone-600">{client.address}</p>}
          {client?.phone && <p className="text-stone-600">{client.phone}</p>}
          {client?.email && <p className="text-stone-600">{client.email}</p>}
        </div>

        {/* RE line */}
        {job?.re_line && <p><span className="font-semibold">RE:</span> {job.re_line}</p>}

        {/* Line Items */}
        <table className="w-full border-collapse">
          <thead><tr className="border-b-2 border-stone-300 text-left"><th className="py-2">Description</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Unit</th><th className="py-2 text-right">Unit Price</th><th className="py-2 text-right">Amount</th></tr></thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className={`border-b border-stone-100 ${item.is_change_order ? 'bg-yellow-50' : ''}`}>
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
          <div className="flex justify-between"><span>Subtotal</span><span>${inv.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Tax ({inv.tax_rate}%)</span><span>${inv.tax_amount.toFixed(2)}</span></div>
          <div className="flex justify-between border-t border-stone-300 pt-1 text-base font-bold"><span>Total Due</span><span>${inv.total.toFixed(2)}</span></div>
        </div>

        {/* Payment Methods */}
        <div className="rounded-lg bg-stone-50 p-4">
          <h4 className="font-semibold mb-1">Payment Methods</h4>
          <p>{methods}</p>
          <p className="text-xs text-stone-500 mt-1">Check payable to: {COMPANY.check_payable}</p>
        </div>

        {inv.notes && <div><h4 className="font-semibold mb-1">Notes</h4><p className="text-stone-600">{inv.notes}</p></div>}

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 mt-8 pt-4 border-t border-stone-200">
          <div>
            <p className="text-xs font-semibold uppercase text-stone-500 mb-8">Authorized By</p>
            <div className="border-b border-stone-400 mb-1" />
            <p className="text-sm">{COMPANY.signatory} — {COMPANY.legal_name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-stone-500 mb-8">Received By</p>
            <div className="border-b border-stone-400 mb-1" />
            <p className="text-sm">Client Signature & Date</p>
          </div>
        </div>

        <div className="mt-4 text-center text-[10px] text-stone-400 border-t border-stone-100 pt-2">
          {COMPANY.legal_name} | {COMPANY.tagline} | {COMPANY.address} | {COMPANY.phone} | {COMPANY.email}
        </div>
      </div>
    </>
  )
}
