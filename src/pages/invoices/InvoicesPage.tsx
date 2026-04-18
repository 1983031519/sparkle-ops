import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Printer, CheckCircle, Mail, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { DateInput } from '@/components/ui/DateInput'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge, statusColor } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { DeleteConfirmDialog, DeleteWarningDialog } from '@/components/ui/DeleteDialogs'
import { SendDocumentModal } from '@/components/SendDocumentModal'
import { INVOICE_STATUSES, COMPANY, fmtDateShort, fmtDate, fmtCurrency, isoDatePart } from '@/lib/constants'
import { useToast } from '@/components/ui/Toast'
import { useDebounce } from '@/hooks/useDebounce'
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

const todayISO = () => new Date().toISOString().split('T')[0]
const addDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + days); return d.toISOString().split('T')[0]
}

const emptyForm = {
  client_id: '', job_id: '', status: 'Unpaid' as InvoiceStatus,
  site_address: '', invoice_date: todayISO(),
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
  const [viewedDocIds, setViewedDocIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [editing, setEditing] = useState<Invoice | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [previewInv, setPreviewInv] = useState<Invoice | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletePaidWarning, setDeletePaidWarning] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [markPaidTarget, setMarkPaidTarget] = useState<Invoice | null>(null)
  const [markPaidDate, setMarkPaidDate] = useState('')
  const [markPaidMethod, setMarkPaidMethod] = useState('Check')
  const [markingPaid, setMarkingPaid] = useState(false)
  const toast = useToast()

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [iRes, cRes, jRes, vRes] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name, email, phone, address, city, state').order('name'),
      supabase.from('jobs').select('id, title, client_id, estimate_id, re_line, site_address'),
      supabase.from('document_links').select('document_id').eq('document_type', 'invoice').not('viewed_at', 'is', null),
    ])
    setInvoices((iRes.data ?? []) as Invoice[])
    setClients((cRes.data ?? []) as Client[])
    setJobs((jRes.data ?? []) as Job[])
    setViewedDocIds(new Set((vRes.data ?? []).map((r: { document_id: string }) => r.document_id)))
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const debouncedSearch = useDebounce(search, 250)

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients])
  const jobMap    = useMemo(() => Object.fromEntries(jobs.map(j => [j.id, j])), [jobs])

  const filtered = useMemo(() => {
    const list = invoices.filter(e =>
      (clientMap[e.client_id]?.name ?? '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      e.number.toLowerCase().includes(debouncedSearch.toLowerCase())
    )
    // Sort: unpaid/overdue first, then by date descending
    return list.sort((a, b) => {
      const aUnpaid = a.status === 'Unpaid' || a.status === 'Overdue' ? 0 : 1
      const bUnpaid = b.status === 'Unpaid' || b.status === 'Overdue' ? 0 : 1
      if (aUnpaid !== bUnpaid) return aUnpaid - bUnpaid
      return (b.date ?? b.created_at).localeCompare(a.date ?? a.created_at)
    })
  }, [invoices, clientMap, debouncedSearch])

  function calcTotals(items: InvoiceLineItem[]) {
    const subtotal = items.reduce((s, i) => s + i.qty * i.unit_price, 0)
    return { subtotal, total: subtotal }
  }

  function openNew() { setEditing(null); setForm({ ...emptyForm, invoice_date: todayISO(), due_date: addDays(todayISO(), 14) }); setModalOpen(true) }

  // Open modal when navigated with ?new=true (from Dashboard "+ New" dropdown).
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      openNew()
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function openEdit(inv: Invoice) {
    setEditing(inv)
    const depRcv = inv.deposit_received ?? 0
    const method = inv.payment_method_used ?? ''
    const isCustomMethod = method !== '' && !['Check', 'ACH / Bank Transfer', 'Zelle', 'Cash'].includes(method)
    setForm({
      client_id: inv.client_id, job_id: inv.job_id ?? '', status: inv.status,
      site_address: inv.site_address ?? '', invoice_date: inv.date ?? todayISO(),
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

  async function nextInvoiceNumber(): Promise<string> {
    const now = new Date()
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const { data } = await supabase
      .from('invoices')
      .select('number')
      .like('number', `${prefix}-%`)
      .order('number', { ascending: false })
      .limit(1)
    let seq = 1
    if (data && data.length > 0) {
      const last = (data[0] as { number: string }).number
      const parts = last.split('-')
      const lastSeq = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(lastSeq)) seq = lastSeq + 1
    }
    return `${prefix}-${String(seq).padStart(3, '0')}`
  }

  async function handleSave() {
    if (!form.client_id) { toast.error('Please select a client.'); return }
    setSaving(true)
    try {
      const { subtotal, total } = calcTotals(form.line_items)
      const depositRcv = form.has_deposit ? form.deposit_received : 0
      const methodValue = form.payment_method_used === 'Multiple' ? form.payment_method_custom : form.payment_method_used
      const invoiceNumber = editing?.number ?? await nextInvoiceNumber()
      const payload = {
        number: invoiceNumber,
        client_id: form.client_id, job_id: form.job_id || null, estimate_id: editing?.estimate_id ?? null,
        status: form.status, date: form.invoice_date || todayISO(), site_address: form.site_address || null,
        line_items: form.line_items, subtotal, total,
        notes: form.notes || null, due_date: form.due_date || null,
        payment_terms: form.payment_terms || null,
        payment_method_used: methodValue || null,
        deposit_received: depositRcv,
        balance_due: total - depositRcv,
      }
      if (editing) {
        const { data: updated, error } = await supabase.from('invoices').update(payload as never).eq('id', editing.id).select().single()
        if (error) { toast.error(`Failed to save invoice: ${error.message}`); return }
        setInvoices(prev => prev.map(i => i.id === editing.id ? updated as Invoice : i))
      } else {
        const { data: created, error } = await supabase.from('invoices').insert(payload as never).select().single()
        if (error) { toast.error(`Failed to save invoice: ${error.message}`); return }
        setInvoices(prev => [created as Invoice, ...prev])
      }
      setModalOpen(false)
      toast.success(editing ? 'Invoice updated.' : 'Invoice saved.')
    } catch (err) {
      toast.error(`Failed to save invoice: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally { setSaving(false) }
  }

  function openMarkPaid(inv: Invoice) {
    setMarkPaidTarget(inv)
    setMarkPaidDate(new Date().toISOString().split('T')[0])
    setMarkPaidMethod('Check')
  }

  async function confirmMarkPaid() {
    if (!markPaidTarget) return
    setMarkingPaid(true)
    const { error } = await supabase.from('invoices').update({
      status: 'Paid',
      paid_at: markPaidDate ? `${markPaidDate}T00:00:00Z` : new Date().toISOString(),
      payment_method_used: markPaidMethod,
      balance_due: 0,
    } as never).eq('id', markPaidTarget.id)
    setMarkingPaid(false)
    if (error) { toast.error(`Failed to mark paid: ${error.message}`); return }
    setInvoices(prev => prev.map(i => i.id === markPaidTarget.id ? { ...i, status: 'Paid' as const, payment_method_used: markPaidMethod, paid_at: markPaidDate, balance_due: 0 } : i))
    setMarkPaidTarget(null)
    toast.success('Invoice marked as paid.')
  }

  function handleDeleteClick() {
    if (!editing) return
    if (editing.status === 'Paid') {
      setDeletePaidWarning(true)
      return
    }
    setDeleteConfirmOpen(true)
  }

  async function executeDelete() {
    if (!editing) return
    setDeleting(true)
    const { error } = await supabase.from('invoices').delete().eq('id', editing.id)
    setDeleting(false)
    if (error) { toast.error(`Failed to delete: ${error.message}`); return }
    setInvoices(prev => prev.filter(i => i.id !== editing.id))
    setDeleteConfirmOpen(false)
    setModalOpen(false)
    toast.success('Invoice deleted.')
  }

  const { subtotal, total } = calcTotals(form.line_items)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-end">
        <Button onClick={openNew}><Plus className="h-4 w-4" /> New Invoice</Button>
      </div>

      <Card>
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input className="w-full rounded-[10px] border border-gray-200 py-2 pl-10 pr-3 text-[13px] placeholder:text-gray-400 focus:border-[#4F6CF7] focus:outline-none focus:ring-[3px] focus:ring-[#4F6CF7]/[0.12]" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? <p className="p-6 text-sm text-gray-500">Loading...</p> : (
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
                return bal > 0 && i.status !== 'Paid' ? <span className="font-semibold text-danger-600">{fmtCurrency(bal)}</span> : <span className="text-gray-400">-</span>
              }},
              { key: 'due', header: 'Due Date', render: i => fmtDateShort(i.due_date) },
              { key: 'viewed', header: '', render: i => viewedDocIds.has(i.id) ? <span style={{ fontSize: 10, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', padding: '2px 7px', borderRadius: 10, border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>Viewed</span> : null },
              { key: 'actions', header: '', render: i => (
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  {i.status !== 'Paid' && <Button variant="ghost" size="sm" onClick={() => openMarkPaid(i)} title="Mark Paid"><CheckCircle className="h-4 w-4 text-green-600" /></Button>}
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
            <Select label="Job (optional)" id="inv-job" value={form.job_id} onChange={e => {
              const jobId = e.target.value
              const selectedJob = jobs.find(j => j.id === jobId)
              setForm(f => ({
                ...f,
                job_id: jobId,
                site_address: (selectedJob as any)?.site_address ?? f.site_address,
              }))
            }} options={jobs.map(j => ({ value: j.id, label: j.title }))} />
            <Select label="Status" id="inv-status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as InvoiceStatus }))} options={INVOICE_STATUSES.map(s => ({ value: s, label: s }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateInput label="Invoice Date" id="inv-date" value={form.invoice_date} onChange={v => {
              setForm(f => {
                // Auto-suggest due date: if due_date is empty or was auto-set, update it to invoice_date + 14 days
                const autoSuggest = !f.due_date || f.due_date === addDays(f.invoice_date, 14)
                return { ...f, invoice_date: v, due_date: autoSuggest && v ? addDays(v, 14) : f.due_date }
              })
            }} />
            <DateInput label="Due Date" id="inv-due" value={form.due_date} onChange={v => setForm(f => ({ ...f, due_date: v }))} />
          </div>
          <Input label="Job Site Address" id="inv-site" value={form.site_address} onChange={e => setForm(f => ({ ...f, site_address: e.target.value }))} placeholder="Address where work was performed" />

          {/* Line Items */}
          <div>
            <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.5px] text-gray-500">Line Items</label>
            <div className="space-y-2">
              {form.line_items.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5"><input className="w-full h-[36px] rounded-[10px] border border-gray-200 px-2 text-[13px]" placeholder="Description" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} /></div>
                  <div className="col-span-2"><input className="w-full h-[36px] rounded-[10px] border border-gray-200 px-2 text-[13px]" type="number" placeholder="Qty" value={line.qty} onChange={e => updateLine(i, 'qty', Number(e.target.value))} /></div>
                  <div className="col-span-1"><input className="w-full h-[36px] rounded-[10px] border border-gray-200 px-2 text-[13px]" placeholder="Unit" value={line.unit} onChange={e => updateLine(i, 'unit', e.target.value)} /></div>
                  <div className="col-span-2"><input className="w-full h-[36px] rounded-[10px] border border-gray-200 px-2 text-[13px]" type="number" step="0.01" placeholder="Price" value={line.unit_price} onChange={e => updateLine(i, 'unit_price', Number(e.target.value))} /></div>
                  <div className="col-span-1 text-right text-[13px] font-medium">${(line.qty * line.unit_price).toFixed(2)}</div>
                  <div className="col-span-1">{form.line_items.length > 1 && <button type="button" onClick={() => removeLine(i)} className="text-red-500 text-xs hover:underline">X</button>}</div>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={addLine} className="mt-2">+ Add Line</Button>
          </div>

          {/* Totals */}
          <div className="rounded-lg bg-gray-50 p-4 space-y-1 text-right text-sm">
            <div className="flex justify-end gap-8"><span>Subtotal:</span><strong>${subtotal.toFixed(2)}</strong></div>
            <div className="flex justify-end gap-8"><span>Tax (0%):</span><strong>$0.00</strong></div>
            <div className="flex justify-end gap-8 text-base border-t border-gray-200 pt-1"><span>Total:</span><strong>${total.toFixed(2)}</strong></div>
          </div>

          {/* Payment Agreement */}
          <div className="border rounded-lg border-gray-200 p-4 space-y-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.5px] text-gray-500">Payment Agreement</h3>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold uppercase tracking-[0.5px] text-gray-500">Payment Method</label>
              <div className="space-y-1.5">
                {PAYMENT_METHOD_OPTIONS.map(m => (
                  <label key={m} className="flex items-center gap-2.5 cursor-pointer">
                    <input type="radio" name="payment_method" value={m} checked={form.payment_method_used === m} onChange={() => setForm(f => ({ ...f, payment_method_used: m, payment_method_custom: m === 'Multiple' ? f.payment_method_custom : '' }))} className="accent-blue-600" />
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
                }} className="accent-blue-600 rounded" />
                <span className="text-[13px] font-medium">Deposit received</span>
              </label>
              {form.has_deposit && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Deposit Amount ($)" id="inv-deposit" type="number" step="0.01" value={form.deposit_received} onChange={e => setForm(f => ({ ...f, deposit_received: Number(e.target.value) }))} />
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-semibold uppercase tracking-[0.5px] text-gray-500">Balance Due</label>
                    <p className="h-[40px] flex items-center text-[18px] font-bold text-[#111827]">{fmtCurrency(total - form.deposit_received)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Textarea label="Notes" id="inv-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          <div className="flex justify-between border-t border-gray-200 pt-4">
            {editing && <Button variant="danger" onClick={handleDeleteClick} type="button"><Trash2 className="h-4 w-4" /> Delete</Button>}
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

      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={executeDelete}
        title={`Delete Invoice ${editing?.number ?? ''}?`}
        message="This action cannot be undone."
        loading={deleting}
      />

      <DeleteWarningDialog
        open={deletePaidWarning}
        onClose={() => setDeletePaidWarning(false)}
        title="Cannot Delete Paid Invoice"
        message="Paid invoices cannot be deleted to preserve your financial records. Archive or void the invoice instead."
      />

      {/* Mark as Paid Modal */}
      <Modal open={!!markPaidTarget} onClose={() => setMarkPaidTarget(null)} title={`Mark Invoice ${markPaidTarget?.number ?? ''} as Paid`}>
        <div className="space-y-5">
          <DateInput label="Payment Date" id="paid-date" value={markPaidDate} onChange={v => setMarkPaidDate(v)} />

          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-gray-500 mb-2">Payment Method</p>
            <div className="space-y-1.5">
              {['Check', 'Zelle', 'Cash', 'ACH', 'Other'].map(m => (
                <label key={m} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="radio" name="paid-method" value={m} checked={markPaidMethod === m} onChange={() => setMarkPaidMethod(m)} className="accent-blue-600" />
                  <span className="text-[13px]">{m}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-[13px]">
            <div className="flex justify-between"><span className="text-gray-500">Invoice Total</span><span className="font-semibold text-[#111827]">{fmtCurrency(markPaidTarget?.total ?? 0)}</span></div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
            <Button variant="secondary" type="button" onClick={() => setMarkPaidTarget(null)} disabled={markingPaid}>Cancel</Button>
            <Button type="button" onClick={confirmMarkPaid} disabled={markingPaid}>
              <CheckCircle className="h-4 w-4" />
              {markingPaid ? 'Saving...' : 'Confirm Payment'}
            </Button>
          </div>
        </div>
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

  const PDF_OPTS = {
    margin: [0.4, 0.5, 0.4, 0.5] as [number, number, number, number],
    image: { type: 'jpeg' as const, quality: 0.92 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const },
  }

  async function handlePrint() {
    const el = document.querySelector('.print-area') as HTMLElement | null
    if (!el) return
    const html2pdf = (await import('html2pdf.js')).default
    html2pdf().set({ ...PDF_OPTS, filename: `Invoice — ${inv.number}.pdf` }).from(el).save()
  }

  const [sendOpen, setSendOpen] = useState(false)
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  async function handleSendClick() {
    const el = document.querySelector('.print-area') as HTMLElement | null
    setGeneratingPdf(true)
    try {
      if (el) {
        const html2pdf = (await import('html2pdf.js')).default
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dataUri: string = await (html2pdf() as any).set(PDF_OPTS).from(el).outputPdf('datauristring')
        setPdfBase64(dataUri.split(',')[1])
      }
    } catch {
      setPdfBase64(null)
    } finally {
      setGeneratingPdf(false)
      setSendOpen(true)
    }
  }

  return (
    <>
      <div className="mb-4 no-print flex items-center gap-2">
        <Button onClick={handlePrint}><Printer className="h-4 w-4" /> Download PDF</Button>
        <Button variant="gold" type="button" onClick={handleSendClick} disabled={generatingPdf}>
          <Mail className="h-4 w-4" /> {generatingPdf ? 'Preparing...' : 'Send to Client'}
        </Button>
      </div>
      <SendDocumentModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        type="invoice"
        documentId={inv.id}
        clientEmail={client?.email}
        pdfBase64={pdfBase64 ?? undefined}
        documentData={{
          number: inv.number,
          date: fmtDate(inv.date ?? isoDatePart(inv.created_at)),
          total: inv.total,
          clientName: client?.name ?? '',
        }}
      />
      <div className="print-area" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 13, lineHeight: 1.65, color: '#333' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 16, borderBottom: '1px solid #e0e0e0', marginBottom: 20 }}>
          <div>
            <img src="/logo-dark.png" alt="Sparkle" style={{ width: 160, height: 'auto', display: 'block', marginBottom: 8 }} />
            <p style={{ fontSize: 11, color: '#666' }}>{COMPANY.address}</p>
            <p style={{ fontSize: 11, color: '#666' }}>{COMPANY.phone} | {COMPANY.email}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>INVOICE</h3>
            <p style={{ fontFamily: 'monospace', fontSize: 13, color: '#555', margin: '4px 0' }}>{inv.number}</p>
            <p style={{ fontSize: 12, color: '#666' }}>Date: {fmtDate(inv.date ?? isoDatePart(inv.created_at))}</p>
            {inv.due_date && <p style={{ fontSize: 12, color: '#666' }}>Due: {fmtDate(inv.due_date)}</p>}
            <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: inv.status === 'Paid' ? '#f0fdf4' : inv.status === 'Overdue' ? '#fff1f2' : '#fffbeb', color: inv.status === 'Paid' ? '#16a34a' : inv.status === 'Overdue' ? '#e11d48' : '#d97706', border: `1px solid ${inv.status === 'Paid' ? '#bbf7d0' : inv.status === 'Overdue' ? '#fecdd3' : '#fde68a'}` }}>{inv.status}</span>
          </div>
        </div>

        {/* Bill To */}
        <div style={{ background: '#f5f4f2', border: '1px solid #e8e6e2', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9a8f82', margin: '0 0 4px' }}>Bill To</p>
          <p style={{ fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{client?.name ?? 'N/A'}</p>
          {client?.address && <p style={{ color: '#555', margin: '2px 0' }}>{client.address}</p>}
          {client?.phone && <p style={{ color: '#555', margin: '2px 0' }}>{client.phone}</p>}
          {client?.email && <p style={{ color: '#555', margin: '2px 0' }}>{client.email}</p>}
        </div>

        {inv.site_address && <p style={{ marginBottom: 6 }}><span style={{ fontWeight: 600, color: '#111827' }}>Job Site:</span> {inv.site_address}</p>}

        {job?.re_line && <p style={{ marginBottom: 12 }}><span style={{ fontWeight: 600, color: '#111827' }}>RE:</span> {job.re_line}</p>}

        {/* Line Items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead><tr style={{ borderBottom: '2px solid #d1d5db', textAlign: 'left' }}><th style={{ padding: '8px 4px' }}>Description</th><th style={{ padding: '8px 4px', textAlign: 'right' }}>Qty</th><th style={{ padding: '8px 4px', textAlign: 'right' }}>Unit</th><th style={{ padding: '8px 4px', textAlign: 'right' }}>Unit Price</th><th style={{ padding: '8px 4px', textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #ebebeb', background: item.is_change_order ? '#fffbeb' : 'transparent' }}>
                <td style={{ padding: '8px 4px' }}>{item.description}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{item.qty}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{item.unit}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>${item.unit_price.toFixed(2)}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>${(item.qty * item.unit_price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ marginLeft: 'auto', width: 280, textAlign: 'right', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>Subtotal</span><span>${inv.subtotal.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>Tax (0%)</span><span>$0.00</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #111827', paddingTop: 4, marginTop: 4, fontSize: 15, fontWeight: 700, color: '#111827' }}><span>Total</span><span>${inv.total.toFixed(2)}</span></div>
          {depositAmt > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#16a34a' }}><span>Deposit Received</span><span>-${depositAmt.toFixed(2)}</span></div>}
          {depositAmt > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #111827', paddingTop: 4, marginTop: 4, fontSize: 17, fontWeight: 700, color: '#111827' }}><span>Balance Due</span><span>${balanceDue.toFixed(2)}</span></div>}
        </div>

        {/* Payment */}
        <div style={{ background: '#f5f4f2', border: '1px solid #e8e6e2', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Payment Information</h4>
          {method && <p style={{ color: '#333' }}>Payment Method: <strong>{method}</strong></p>}
          {inv.payment_terms && <p style={{ color: '#333' }}>Payment Terms: <strong>{inv.payment_terms}</strong></p>}
          {method && method.includes('Check') && <p style={{ fontSize: 11, color: '#888', marginTop: 6 }}>Check payable to: {COMPANY.check_payable}</p>}
          {method && method.includes('Zelle') && <p style={{ fontSize: 11, color: '#888' }}>Zelle: {COMPANY.zelle}</p>}
          {method && method.includes('ACH') && <p style={{ fontSize: 11, color: '#888' }}>ACH / Bank Transfer — contact office for details</p>}
        </div>

        {inv.notes && <div style={{ marginBottom: 16 }}><h4 style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Notes</h4><p style={{ color: '#555' }}>{inv.notes}</p></div>}

        {/* Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 40, paddingTop: 20, borderTop: '1px solid #e0e0e0' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9a8f82', marginBottom: 40 }}>Authorized By</p>
            <div style={{ borderTop: '1.5px solid #111827', marginBottom: 4 }} />
            <p style={{ fontSize: 13, color: '#1a1a1a' }}>{COMPANY.signatory} — {COMPANY.legal_name}</p>
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9a8f82', marginBottom: 40 }}>Received By</p>
            <div style={{ borderTop: '1.5px solid #111827', marginBottom: 4 }} />
            <p style={{ fontSize: 13, color: '#1a1a1a' }}>Client Signature & Date</p>
          </div>
        </div>

        <div style={{ marginTop: 24, paddingTop: 12, borderTop: '1px solid #ebebeb', textAlign: 'center', fontSize: 10, color: '#aaa' }}>
          {COMPANY.legal_name} | {COMPANY.tagline} | {COMPANY.address} | {COMPANY.phone} | {COMPANY.email}
        </div>
      </div>
    </>
  )
}
