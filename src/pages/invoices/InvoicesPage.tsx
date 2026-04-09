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
import { INVOICE_STATUSES, COMPANY, generateInvoiceNumber, fmtDateShort, fmtDate, fmtCurrency, isoDatePart } from '@/lib/constants'
import { useToast } from '@/components/ui/Toast'
import type { Invoice, InvoiceStatus, InvoiceLineItem, Client, Job } from '@/lib/database.types'

const emptyLine: InvoiceLineItem = { description: '', qty: 1, unit: 'ea', unit_price: 0 }

const PAYMENT_TERMS_OPTIONS = [
  '50% Deposit + 50% on Completion',
  '100% Due on Receipt',
  'Net 15',
  'Net 30',
  'Custom',
]

const PAYMENT_METHOD_OPTIONS = [
  'Check',
  'ACH / Bank Transfer',
  'Zelle',
  'Cash',
  'Multiple',
]

const emptyForm = {
  client_id: '', job_id: '', status: 'Unpaid' as InvoiceStatus,
  line_items: [{ ...emptyLine }], notes: '', due_date: '',
  payment_terms: '50% Deposit + 50% on Completion',
  payment_method_used: 'Check',
  payment_method_custom: '',
  has_deposit: false, deposit_received: 0,
}

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
  const [saving, setSaving] = useState(false)
  const toast = useToast()

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
    e.number.toLowerCase().includes(search.toLowerCase())
  )

  function calcTotals(items: InvoiceLineItem[]) {
    const subtotal = items.reduce((s, i) => s + i.qty * i.unit_price, 0)
    return { subtotal, total: subtotal }
  }

  function openNew() { setEditing(null); setForm(emptyForm); setModalOpen(true) }

  function openEdit(inv: Invoice) {
    setEditing(inv)
    const depRcv = inv.deposit_received ?? 0
    const method = inv.payment_method_used ?? ''
    const isCustomMethod = method !== '' && !['Check', 'ACH / Bank Transfer', 'Zelle', 'Cash'].includes(method)
    setForm({
      client_id: inv.client_id, job_id: inv.job_id ?? '', status: inv.status,
      line_items: (inv.line_items as InvoiceLineItem[]).length > 0 ? inv.line_items as InvoiceLineItem[] : [{ ...emptyLine }],
      notes: inv.notes ?? '', due_date: inv.due_date ?? '',
      payment_terms: inv.payment_terms ?? '50% Deposit + 50% on Completion',
      payment_method_used: isCustomMethod ? 'Multiple' : method,
      payment_method_custom: isCustomMethod ? method : '',
      has_deposit: depRcv > 0, deposit_received: depRcv,
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
    if (!form.client_id) { toast.error('Please select a client.'); return }
    setSaving(true)
    try {
      const { subtotal, total } = calcTotals(form.line_items)
      const depositRcv = form.has_deposit ? form.deposit_received : 0
      const methodValue = form.payment_method_used === 'Multiple' ? form.payment_method_custom : form.payment_method_used
      const payload = {
        number: editing?.number ?? generateInvoiceNumber(invoices.length + 1),
        client_id: form.client_id, job_id: form.job_id || null, estimate_id: editing?.estimate_id ?? null,
        status: form.status, line_items: form.line_items, subtotal, total,
        notes: form.notes || null, due_date: form.due_date || null,
        payment_terms: form.payment_terms || null,
        payment_method_used: methodValue || null,
        deposit_received: depositRcv,
        balance_due: total - depositRcv,
      }
      let error: { message: string } | null = null
      if (editing) { const res = await supabase.from('invoices').update(payload as never).eq('id', editing.id); error = res.error }
      else { const res = await supabase.from('invoices').insert(payload as never); error = res.error }
      if (error) { toast.error(`Failed to save invoice: ${error.message}`); return }
      await fetchAll(); setModalOpen(false)
      toast.success(editing ? 'Invoice updated.' : 'Invoice saved.')
    } catch (err) {
      toast.error(`Failed to save invoice: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally { setSaving(false) }
  }

  async function markPaid(inv: Invoice) {
    const { error } = await supabase.from('invoices').update({ status: 'Paid' } as never).eq('id', inv.id)
    if (error) { toast.error(`Failed to mark paid: ${error.message}`); return }
    await fetchAll()
    toast.success('Invoice marked as paid.')
  }

  async function handleDelete() {
    if (!editing || !confirm('Delete this invoice?')) return
    const { error } = await supabase.from('invoices').delete().eq('id', editing.id)
    if (error) { toast.error(`Failed to delete: ${error.message}`); return }
    await fetchAll(); setModalOpen(false)
    toast.success('Invoice deleted.')
  }

  const { subtotal, total } = calcTotals(form.line_items)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-bold text-navy-900">Invoices</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> New Invoice</Button>
      </div>

      <Card>
        <div className="border-b border-stone-100 px-4 py-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input className="w-full rounded-[10px] border border-stone-200 py-2 pl-10 pr-3 text-[13px] placeholder:text-stone-400 focus:border-navy-900 focus:outline-none focus:ring-[3px] focus:ring-navy-900/[0.08]" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? <p className="p-6 text-sm text-stone-500">Loading...</p> : (
          <Table
            data={filtered}
            onRowClick={openEdit}
            columns={[
              { key: 'number', header: '#', render: i => <span className="font-mono text-xs">{i.number}</span> },
              { key: 'client', header: 'Client', render: i => clientMap[i.client_id]?.name ?? '-' },
              { key: 'status', header: 'Status', render: i => <Badge color={statusColor(i.status)}>{i.status}</Badge> },
              { key: 'total', header: 'Total', render: i => fmtCurrency(i.total) },
              { key: 'balance', header: 'Balance Due', render: i => {
                const bal = i.balance_due ?? i.total
                return bal > 0 && i.status !== 'Paid' ? <span className="font-semibold text-danger-600">{fmtCurrency(bal)}</span> : <span className="text-stone-400">-</span>
              }},
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
        <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Client" id="inv-client" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} options={clients.map(c => ({ value: c.id, label: c.name }))} />
            <Select label="Job (optional)" id="inv-job" value={form.job_id} onChange={e => setForm(f => ({ ...f, job_id: e.target.value }))} options={jobs.map(j => ({ value: j.id, label: j.title }))} />
            <Select label="Status" id="inv-status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as InvoiceStatus }))} options={INVOICE_STATUSES.map(s => ({ value: s, label: s }))} />
          </div>
          <DateInput label="Due Date" id="inv-due" value={form.due_date} onChange={v => setForm(f => ({ ...f, due_date: v }))} />

          {/* Line Items */}
          <div>
            <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.5px] text-stone-500">Line Items</label>
            <div className="space-y-2">
              {form.line_items.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5"><input className="w-full h-[36px] rounded-[10px] border border-stone-200 px-2 text-[13px]" placeholder="Description" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} /></div>
                  <div className="col-span-2"><input className="w-full h-[36px] rounded-[10px] border border-stone-200 px-2 text-[13px]" type="number" placeholder="Qty" value={line.qty} onChange={e => updateLine(i, 'qty', Number(e.target.value))} /></div>
                  <div className="col-span-1"><input className="w-full h-[36px] rounded-[10px] border border-stone-200 px-2 text-[13px]" placeholder="Unit" value={line.unit} onChange={e => updateLine(i, 'unit', e.target.value)} /></div>
                  <div className="col-span-2"><input className="w-full h-[36px] rounded-[10px] border border-stone-200 px-2 text-[13px]" type="number" step="0.01" placeholder="Price" value={line.unit_price} onChange={e => updateLine(i, 'unit_price', Number(e.target.value))} /></div>
                  <div className="col-span-1 text-right text-[13px] font-medium">${(line.qty * line.unit_price).toFixed(2)}</div>
                  <div className="col-span-1">{form.line_items.length > 1 && <button type="button" onClick={() => removeLine(i)} className="text-red-500 text-xs hover:underline">X</button>}</div>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={addLine} className="mt-2">+ Add Line</Button>
          </div>

          {/* Totals */}
          <div className="rounded-lg bg-stone-50 p-4 space-y-1 text-right text-sm">
            <div className="flex justify-end gap-8"><span>Subtotal:</span><strong>${subtotal.toFixed(2)}</strong></div>
            <div className="flex justify-end gap-8"><span>Tax (0%):</span><strong>$0.00</strong></div>
            <div className="flex justify-end gap-8 text-base border-t border-stone-200 pt-1"><span>Total:</span><strong>${total.toFixed(2)}</strong></div>
          </div>

          {/* Payment Agreement */}
          <div className="border rounded-lg border-stone-200 p-4 space-y-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.5px] text-stone-500">Payment Agreement</h3>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold uppercase tracking-[0.5px] text-stone-500">Payment Method</label>
              <div className="space-y-1.5">
                {PAYMENT_METHOD_OPTIONS.map(m => (
                  <label key={m} className="flex items-center gap-2.5 cursor-pointer">
                    <input type="radio" name="payment_method" value={m} checked={form.payment_method_used === m} onChange={() => setForm(f => ({ ...f, payment_method_used: m, payment_method_custom: m === 'Multiple' ? f.payment_method_custom : '' }))} className="accent-navy-900" />
                    <span className="text-[13px]">
                      {m === 'Check' && `Check (payable to ${COMPANY.check_payable})`}
                      {m === 'ACH / Bank Transfer' && 'ACH / Bank Transfer'}
                      {m === 'Zelle' && `Zelle (${COMPANY.zelle})`}
                      {m === 'Cash' && 'Cash'}
                      {m === 'Multiple' && 'Multiple (specify below)'}
                    </span>
                  </label>
                ))}
              </div>
              {form.payment_method_used === 'Multiple' && (
                <Input label="Specify Methods" id="inv-pcustom" value={form.payment_method_custom} onChange={e => setForm(f => ({ ...f, payment_method_custom: e.target.value }))} placeholder="e.g. Check + Zelle" />
              )}
            </div>

            {/* Payment Schedule */}
            <Select label="Payment Schedule" id="inv-pterms" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} options={PAYMENT_TERMS_OPTIONS.map(t => ({ value: t, label: t }))} />

            {/* Deposit */}
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.has_deposit} onChange={e => {
                  const checked = e.target.checked
                  setForm(f => ({
                    ...f, has_deposit: checked,
                    deposit_received: checked && f.deposit_received === 0 ? Math.round(total * 50) / 100 : checked ? f.deposit_received : 0,
                  }))
                }} className="accent-navy-900 rounded" />
                <span className="text-[13px] font-medium">Deposit received</span>
              </label>
              {form.has_deposit && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Deposit Amount ($)" id="inv-deposit" type="number" step="0.01" value={form.deposit_received} onChange={e => setForm(f => ({ ...f, deposit_received: Number(e.target.value) }))} />
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-semibold uppercase tracking-[0.5px] text-stone-500">Balance Due</label>
                    <p className="h-[40px] flex items-center text-[18px] font-bold text-navy-900">{fmtCurrency(total - form.deposit_received)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Textarea label="Notes" id="inv-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          <div className="flex justify-between border-t border-stone-200 pt-4">
            {editing && <Button variant="danger" onClick={handleDelete} type="button">Delete</Button>}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)} type="button">Cancel</Button>
              <Button onClick={handleSave} type="button" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
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
  const method = inv.payment_method_used
  const depositAmt = inv.deposit_received ?? 0
  const balanceDue = inv.balance_due ?? inv.total

  return (
    <>
      <div className="mb-4 no-print"><Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button></div>
      <div className="space-y-6 text-sm leading-relaxed">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <img src="/logo-dark.png" alt="Sparkle Stone & Pavers" style={{ width: 160, height: 'auto', display: 'block', marginBottom: 8 }} />
            <p className="text-xs text-stone-500">{COMPANY.address}</p>
            <p className="text-xs text-stone-500">{COMPANY.phone} | {COMPANY.email}</p>
          </div>
          <div className="text-right">
            <h3 className="text-2xl font-bold text-stone-800">INVOICE</h3>
            <p className="font-mono text-sm">{inv.number}</p>
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

        {/* Totals */}
        <div className="ml-auto w-72 space-y-1 text-right">
          <div className="flex justify-between"><span>Subtotal</span><span>${inv.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Tax (0%)</span><span>$0.00</span></div>
          <div className="flex justify-between border-t border-stone-300 pt-1 text-base font-bold"><span>Total</span><span>${inv.total.toFixed(2)}</span></div>
          {depositAmt > 0 && (
            <div className="flex justify-between text-success-600"><span>Deposit Received</span><span>-${depositAmt.toFixed(2)}</span></div>
          )}
          {depositAmt > 0 && (
            <div className="flex justify-between border-t border-stone-300 pt-1 text-lg font-bold text-navy-900"><span>Balance Due</span><span>${balanceDue.toFixed(2)}</span></div>
          )}
        </div>

        {/* Payment Information — only what was agreed */}
        <div className="rounded-lg bg-stone-50 p-4 space-y-1.5">
          <h4 className="font-semibold mb-2">Payment Information</h4>
          {method && <p>Payment Method: <strong>{method}</strong></p>}
          {inv.payment_terms && <p>Payment Terms: <strong>{inv.payment_terms}</strong></p>}
          {/* Show specific info only for the selected method */}
          {method && (method.includes('Check') || method === 'Check') && (
            <p className="text-xs text-stone-600">Check payable to: {COMPANY.check_payable}</p>
          )}
          {method && (method.includes('Zelle') || method === 'Zelle') && (
            <p className="text-xs text-stone-600">Zelle: {COMPANY.zelle}</p>
          )}
          {method && (method.includes('ACH') || method === 'ACH / Bank Transfer') && (
            <p className="text-xs text-stone-600">ACH / Bank Transfer — contact office for details</p>
          )}
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
