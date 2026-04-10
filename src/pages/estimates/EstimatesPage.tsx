import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Printer, ArrowRight, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { DateInput } from '@/components/ui/DateInput'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge, statusColor } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { FlowIndicator } from '@/components/FlowIndicator'
import { InlineClientCreate } from '@/components/InlineClientCreate'
import { SendDocumentModal } from '@/components/SendDocumentModal'
import {
  ESTIMATE_STATUSES, JOB_DIVISIONS, COMPANY, DEFAULT_WARRANTY, TERMS_AND_CONDITIONS,
  generateEstimateNumber,
} from '@/lib/constants'
import type { Estimate, EstimateStatus, EstimateLineItem, Client, Job, Invoice, MaterialsSpecified } from '@/lib/database.types'
import { fmtDate, fmtCurrency, futureISO, isoDatePart } from '@/lib/constants'
import { useToast } from '@/components/ui/Toast'

const emptyLine: EstimateLineItem = { description: '', qty: 1, unit: 'ea', unit_price: 0 }
const emptyMaterials: MaterialsSpecified = { paver_type: '', paver_size: '', paver_color: '', sand_type: '', sealant: '', other: '' }

interface EstForm {
  client_id: string; status: EstimateStatus; division: string; attn: string; site_address: string; re_line: string
  scope_of_work: string; materials: MaterialsSpecified; start_date: string; end_date: string
  line_items: EstimateLineItem[]; warranty: string; notes: string; valid_until: string
  payment_terms: string; accepted_payment_methods: string[]
}

const plus30 = futureISO(30)

const emptyForm: EstForm = {
  client_id: '', status: 'Draft', division: 'Pavers', attn: '', site_address: '', re_line: '',
  scope_of_work: '', materials: { ...emptyMaterials }, start_date: '', end_date: '',
  line_items: [{ ...emptyLine }], warranty: DEFAULT_WARRANTY, notes: '', valid_until: plus30,
  payment_terms: '50% deposit + 50% on completion', accepted_payment_methods: ['Check', 'ACH', 'Zelle'],
}

export default function EstimatesPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [editing, setEditing] = useState<Estimate | null>(null)
  const [form, setForm] = useState<EstForm>(emptyForm)
  const [previewEst, setPreviewEst] = useState<Estimate | null>(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [eRes, cRes, jRes, iRes] = await Promise.all([
      supabase.from('estimates').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('jobs').select('*'),
      supabase.from('invoices').select('*'),
    ])
    setEstimates((eRes.data ?? []) as Estimate[])
    setClients((cRes.data ?? []) as Client[])
    setJobs((jRes.data ?? []) as Job[])
    setInvoices((iRes.data ?? []) as Invoice[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]))
  const jobByEstimate = Object.fromEntries(jobs.filter(j => j.estimate_id).map(j => [j.estimate_id!, j]))
  const invByJob = Object.fromEntries(invoices.filter(i => i.job_id).map(i => [i.job_id!, i]))

  const filtered = estimates.filter(e => {
    const cl = clientMap[e.client_id]
    return (cl?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      e.number.toLowerCase().includes(search.toLowerCase())
  })

  function calcTotals(items: EstimateLineItem[]) {
    const subtotal = items.reduce((s, i) => s + i.qty * i.unit_price, 0)
    return { subtotal, total: subtotal } // Tax always 0% for Sparkle
  }

  function openNew() {
    setEditing(null)
    setForm({ ...emptyForm, valid_until: futureISO(30) })
    setModalOpen(true)
  }

  function openEdit(est: Estimate) {
    setEditing(est)
    const mats = (est.materials_specified ?? emptyMaterials) as MaterialsSpecified
    setForm({
      client_id: est.client_id, status: est.status, division: est.division ?? 'Pavers',
      attn: est.attn ?? '', site_address: est.site_address ?? '', re_line: est.re_line ?? '',
      scope_of_work: est.scope_of_work ?? '', materials: mats,
      start_date: est.start_date ?? '', end_date: est.end_date ?? '',
      line_items: (est.line_items as EstimateLineItem[]).length > 0 ? est.line_items as EstimateLineItem[] : [{ ...emptyLine }],
      warranty: est.warranty ?? DEFAULT_WARRANTY,
      notes: est.notes ?? '', valid_until: est.valid_until ?? '',
      payment_terms: est.payment_terms ?? '50% deposit + 50% on completion',
      accepted_payment_methods: est.accepted_payment_methods ?? ['Check', 'ACH', 'Zelle'],
    })
    setModalOpen(true)
  }

  function addLine() { setForm(f => ({ ...f, line_items: [...f.line_items, { ...emptyLine }] })) }
  function removeLine(i: number) { setForm(f => ({ ...f, line_items: f.line_items.filter((_, idx) => idx !== i) })) }
  function updateLine(i: number, field: keyof EstimateLineItem, value: string | number) {
    setForm(f => ({ ...f, line_items: f.line_items.map((l, idx) => idx === i ? { ...l, [field]: value } : l) }))
  }
  function setMat(field: keyof MaterialsSpecified, value: string) {
    setForm(f => ({ ...f, materials: { ...f.materials, [field]: value } }))
  }

  async function handleSave() {
    // Validation
    if (!form.client_id) {
      toast.error('Please select a client before saving.')
      return
    }

    setSaving(true)
    try {
      const subtotal = form.line_items.reduce((s, i) => s + i.qty * i.unit_price, 0)
      const total = subtotal // Tax is always 0% for Sparkle
      const deposit_amount = total * 0.5
      const balance_amount = total - deposit_amount

      const estNum = editing?.number ?? generateEstimateNumber(estimates.length + 1)
      const payload = {
        number: estNum,
        estimate_number: estNum,
        client_id: form.client_id,
        status: form.status,
        division: form.division || 'Pavers',
        attn: form.attn || null,
        site_address: form.site_address || null,
        re_line: form.re_line || null,
        scope_of_work: form.scope_of_work || null,
        materials_specified: form.materials,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        line_items: form.line_items,
        subtotal,
        total,
        deposit_amount,
        balance_amount,
        warranty: form.warranty || null,
        notes: form.notes || null,
        valid_until: form.valid_until || null,
        payment_terms: form.payment_terms || null,
        accepted_payment_methods: form.accepted_payment_methods,
      }

      let error: { message: string } | null = null

      if (editing) {
        const res = await supabase.from('estimates').update(payload as never).eq('id', editing.id)
        error = res.error
      } else {
        const res = await supabase.from('estimates').insert(payload as never)
        error = res.error
      }

      if (error) {
        console.error('Supabase estimate save error:', error)
        toast.error(`Failed to save estimate: ${error.message}`)
        return
      }

      await fetchAll()
      setModalOpen(false)
      toast.success(editing ? 'Estimate updated successfully.' : 'Estimate saved successfully.')
    } catch (err) {
      console.error('Unexpected error saving estimate:', err)
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing || !confirm('Delete this estimate?')) return
    const { error } = await supabase.from('estimates').delete().eq('id', editing.id)
    if (error) {
      console.error('Supabase delete error:', error)
      toast.error(`Failed to delete: ${error.message}`)
      return
    }
    await fetchAll()
    setModalOpen(false)
    toast.success('Estimate deleted.')
  }

  async function convertToJob(est: Estimate) {
    const client = clientMap[est.client_id]
    const { error } = await supabase.from('jobs').insert({
      title: est.re_line || `${client?.name ?? 'Job'} — ${est.division ?? 'Pavers'}`,
      client_id: est.client_id, division: est.division || 'Pavers', status: 'Scheduled',
      address: est.site_address || client?.address || null,
      site_address: est.site_address || null, re_line: est.re_line || null,
      notes: est.scope_of_work || null, total: est.total,
      estimate_id: est.id, start_date: est.start_date || null,
      checklist: [], photos: [],
    } as never)
    if (error) {
      console.error('Convert to job error:', error)
      toast.error(`Failed to convert: ${error.message}`)
      return
    }
    await supabase.from('estimates').update({ status: 'Approved' } as never).eq('id', est.id)
    await fetchAll()
    toast.success('Job created from estimate.')
  }

  function openPreview(est: Estimate) { setPreviewEst(est); setPreviewOpen(true) }
  function getClientForEst(est: Estimate) { return clientMap[est.client_id] }
  const { subtotal, total } = calcTotals(form.line_items)
  const deposit = total * 0.5

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
              { key: 'number', header: '#', render: e => <span className="font-mono text-xs">{e.number}</span> },
              { key: 'client', header: 'Client', render: e => clientMap[e.client_id]?.name ?? '-' },
              { key: 'division', header: 'Div', render: e => <Badge color={e.division === 'Pavers' ? 'orange' : 'blue'}>{e.division ?? '-'}</Badge> },
              { key: 'status', header: 'Status', render: e => <Badge color={statusColor(e.status)}>{e.status}</Badge> },
              { key: 'total', header: 'Total', render: e => fmtCurrency(e.total) },
              { key: 'flow', header: 'Flow', render: e => {
                const job = jobByEstimate[e.id]
                const hasInvoice = job ? !!invByJob[job.id] : false
                return <FlowIndicator steps={[
                  { label: 'Estimate', status: 'done' },
                  { label: 'Job', status: job ? 'done' : e.status === 'Approved' ? 'active' : 'pending' },
                  { label: 'Invoice', status: hasInvoice ? 'done' : 'pending' },
                ]} />
              }},
              { key: 'actions', header: '', render: e => (
                <div className="flex gap-2" onClick={ev => ev.stopPropagation()}>
                  {e.status === 'Approved' && !jobByEstimate[e.id] && (
                    <Button variant="gold" size="sm" onClick={() => convertToJob(e)}>
                      <ArrowRight className="h-3 w-3" /> Convert to Job
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => openPreview(e)}><Printer className="h-4 w-4" /></Button>
                </div>
              )},
            ]}
          />
        )}
      </Card>

      {/* FORM MODAL */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Estimate' : 'New Estimate'} wide>
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {/* Header */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Status" id="est-status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as EstimateStatus }))} options={ESTIMATE_STATUSES.map(s => ({ value: s, label: s }))} />
            <Select label="Division" id="est-div" value={form.division} onChange={e => setForm(f => ({ ...f, division: e.target.value }))} options={JOB_DIVISIONS.map(d => ({ value: d, label: d }))} />
            <DateInput label="Valid Until" id="est-valid" value={form.valid_until} onChange={v => setForm(f => ({ ...f, valid_until: v }))} />
          </div>
          {/* Client */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select label="Client" id="est-client" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} options={clients.map(c => ({ value: c.id, label: c.name }))} />
            </div>
            <InlineClientCreate onCreated={(c) => { setClients(cs => [...cs, c]); setForm(f => ({ ...f, client_id: c.id })) }} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Attn (Contact Name)" id="est-attn" value={form.attn} onChange={e => setForm(f => ({ ...f, attn: e.target.value }))} placeholder="e.g. Kamila" />
            <Input label="Job Site Address" id="est-site" value={form.site_address} onChange={e => setForm(f => ({ ...f, site_address: e.target.value }))} />
          </div>
          <Input label="RE: (Service — Address)" id="est-re" value={form.re_line} onChange={e => setForm(f => ({ ...f, re_line: e.target.value }))} placeholder="e.g. Pool deck paver installation — 123 Main St" />

          {/* Scope */}
          <Textarea label="Scope of Work" id="est-scope" value={form.scope_of_work} onChange={e => setForm(f => ({ ...f, scope_of_work: e.target.value }))} />

          {/* Materials */}
          <div className="border rounded-lg border-stone-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-stone-700">Materials Specified</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input label="Paver/Stone Type" id="mat-type" value={form.materials.paver_type ?? ''} onChange={e => setMat('paver_type', e.target.value)} />
              <Input label="Size" id="mat-size" value={form.materials.paver_size ?? ''} onChange={e => setMat('paver_size', e.target.value)} />
              <Input label="Color" id="mat-color" value={form.materials.paver_color ?? ''} onChange={e => setMat('paver_color', e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input label="Sand Type" id="mat-sand" value={form.materials.sand_type ?? ''} onChange={e => setMat('sand_type', e.target.value)} />
              <Input label="Sealant" id="mat-seal" value={form.materials.sealant ?? ''} onChange={e => setMat('sealant', e.target.value)} />
              <Input label="Other Materials" id="mat-other" value={form.materials.other ?? ''} onChange={e => setMat('other', e.target.value)} />
            </div>
          </div>

          {/* Timeline */}
          <div className="grid gap-4 sm:grid-cols-2">
            <DateInput label="Estimated Start Date" id="est-start" value={form.start_date} onChange={v => setForm(f => ({ ...f, start_date: v }))} />
            <DateInput label="Estimated Completion Date" id="est-end" value={form.end_date} onChange={v => setForm(f => ({ ...f, end_date: v }))} />
          </div>

          {/* Line Items */}
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

          {/* Totals */}
          <div className="rounded-lg bg-stone-50 p-4 space-y-1 text-right text-sm">
            <div className="flex justify-end gap-8"><span>Subtotal:</span><strong>${subtotal.toFixed(2)}</strong></div>
            <div className="flex justify-end gap-8"><span>Tax (0%):</span><strong>$0.00</strong></div>
            <div className="flex justify-end gap-8 text-base border-t border-stone-200 pt-1 mt-1"><span>Total:</span><strong>${total.toFixed(2)}</strong></div>
            <div className="flex justify-end gap-8 text-xs text-stone-500"><span>Deposit (50%):</span><span>${deposit.toFixed(2)}</span></div>
            <div className="flex justify-end gap-8 text-xs text-stone-500"><span>Balance (50%):</span><span>${(total - deposit).toFixed(2)}</span></div>
          </div>

          {/* Payment Terms */}
          <div className="border rounded-lg border-stone-200 p-4 space-y-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.5px] text-stone-500">Payment Terms</h3>
            <Select label="Payment Schedule" id="est-pterms" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} options={[
              { value: '50% deposit + 50% on completion', label: '50% Deposit + 50% on Completion' },
              { value: '100% on completion', label: '100% on Completion' },
              { value: '100% upfront', label: '100% Upfront' },
              { value: 'Custom', label: 'Custom' },
            ]} />
            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold uppercase tracking-[0.5px] text-stone-500">Accepted Payment Methods</label>
              <div className="flex flex-wrap gap-4">
                {['Check', 'ACH', 'Zelle', 'Cash'].map(m => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.accepted_payment_methods.includes(m)} onChange={e => {
                      setForm(f => ({ ...f, accepted_payment_methods: e.target.checked ? [...f.accepted_payment_methods, m] : f.accepted_payment_methods.filter(x => x !== m) }))
                    }} className="accent-navy-900 rounded" />
                    <span className="text-[13px]">{m}{m === 'Check' ? ` (payable to ${COMPANY.check_payable})` : m === 'Zelle' ? ` (${COMPANY.zelle})` : ''}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <Textarea label="Warranty" id="est-warranty" value={form.warranty} onChange={e => setForm(f => ({ ...f, warranty: e.target.value }))} />
          <Textarea label="Notes" id="est-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          <div className="flex justify-between border-t border-stone-200 pt-4">
            {editing && <Button variant="danger" onClick={handleDelete} type="button">Delete</Button>}
            <div className="ml-auto flex gap-2">
              {editing && editing.status === 'Approved' && !jobByEstimate[editing.id] && (
                <Button variant="gold" onClick={() => { convertToJob(editing); setModalOpen(false) }} type="button">
                  <ArrowRight className="h-4 w-4" /> Convert to Job
                </Button>
              )}
              <Button variant="secondary" onClick={() => setModalOpen(false)} type="button">Cancel</Button>
              <Button onClick={handleSave} type="button" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* PRINT PREVIEW MODAL */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Proposal Preview" wide>
        {previewEst && <ProposalPreview est={previewEst} client={getClientForEst(previewEst)} />}
      </Modal>
    </div>
  )
}

/* ─── Printable Proposal Preview ─── */
function ProposalPreview({ est, client }: { est: Estimate; client?: Client }) {
  const mats = (est.materials_specified ?? {}) as MaterialsSpecified
  const items = est.line_items as EstimateLineItem[]
  const deposit = est.deposit_amount ?? est.total * 0.5
  const balance = est.balance_amount ?? est.total * 0.5

  async function handlePrint() {
    const el = document.querySelector('.print-area') as HTMLElement | null
    if (!el) return
    const html2pdf = (await import('html2pdf.js')).default
    html2pdf().set({
      margin: [0.4, 0.5, 0.4, 0.5],
      filename: `Proposal — ${est.number}.pdf`,
      image: { type: 'jpeg', quality: 0.92 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'], before: '.financial-summary' },
    }).from(el).save()
  }

  const [sendOpen, setSendOpen] = useState(false)

  return (
    <>
      <div className="mb-4 no-print flex items-center gap-2">
        <Button onClick={handlePrint}><Printer className="h-4 w-4" /> Download PDF</Button>
        <Button variant="gold" type="button" onClick={() => setSendOpen(true)}>
          <Mail className="h-4 w-4" /> Send to Client
        </Button>
      </div>
      <SendDocumentModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        type="estimate"
        clientEmail={client?.email}
        documentData={{
          number: est.number,
          date: fmtDate(isoDatePart(est.created_at)),
          total: est.total,
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
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1a2744', margin: 0 }}>PROPOSAL</h3>
            <p style={{ fontFamily: 'monospace', fontSize: 13, color: '#555', margin: '4px 0' }}>{est.number}</p>
            <p style={{ fontSize: 12, color: '#666' }}>Date: {fmtDate(isoDatePart(est.created_at))}</p>
            {est.valid_until && <p style={{ fontSize: 12, color: '#666' }}>Valid Until: {fmtDate(est.valid_until)}</p>}
          </div>
        </div>

        {/* Client info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: '#f5f4f2', border: '1px solid #e8e6e2', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9a8f82', margin: '0 0 4px' }}>Prepared For</p>
            <p style={{ fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{client?.name ?? 'N/A'}</p>
            {est.attn && <p style={{ color: '#555', margin: '2px 0' }}>Attn: {est.attn}</p>}
            {client?.address && <p style={{ color: '#555', margin: '2px 0' }}>{client.address}</p>}
            {client?.phone && <p style={{ color: '#555', margin: '2px 0' }}>{client.phone}</p>}
          </div>
          <div>
            {est.site_address && <><p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9a8f82', margin: '0 0 4px' }}>Job Site</p><p style={{ margin: 0 }}>{est.site_address}</p></>}
            {est.division && <p style={{ marginTop: 6, fontSize: 12 }}><span style={{ color: '#9a8f82', fontWeight: 600 }}>Division:</span> {est.division}</p>}
          </div>
        </div>

        {est.re_line && <p style={{ marginBottom: 12 }}><span style={{ fontWeight: 600, color: '#1a2744' }}>RE:</span> {est.re_line}</p>}

        {est.scope_of_work && (
          <div style={{ marginBottom: 16 }}><h4 style={{ fontSize: 13, fontWeight: 600, color: '#1a2744', marginBottom: 4 }}>Scope of Work</h4><p style={{ color: '#444', whiteSpace: 'pre-wrap' }}>{est.scope_of_work}</p></div>
        )}

        {Object.values(mats).some(v => v) && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: '#1a2744', marginBottom: 6 }}>Materials Specified</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 12 }}>
              {mats.paver_type && <p><span style={{ color: '#9a8f82' }}>Type:</span> {mats.paver_type}</p>}
              {mats.paver_size && <p><span style={{ color: '#9a8f82' }}>Size:</span> {mats.paver_size}</p>}
              {mats.paver_color && <p><span style={{ color: '#9a8f82' }}>Color:</span> {mats.paver_color}</p>}
              {mats.sand_type && <p><span style={{ color: '#9a8f82' }}>Sand:</span> {mats.sand_type}</p>}
              {mats.sealant && <p><span style={{ color: '#9a8f82' }}>Sealant:</span> {mats.sealant}</p>}
              {mats.other && <p><span style={{ color: '#9a8f82' }}>Other:</span> {mats.other}</p>}
            </div>
          </div>
        )}

        {(est.start_date || est.end_date) && (
          <div style={{ marginBottom: 16 }}><h4 style={{ fontSize: 13, fontWeight: 600, color: '#1a2744', marginBottom: 4 }}>Timeline</h4>
            <p style={{ color: '#444' }}>
              {est.start_date && <>Estimated Start: <strong>{fmtDate(est.start_date)}</strong></>}
              {est.start_date && est.end_date && ' — '}
              {est.end_date && <>Estimated Completion: <strong>{fmtDate(est.end_date)}</strong></>}
            </p>
          </div>
        )}

        {/* Line Items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead><tr style={{ borderBottom: '2px solid #d1d5db', textAlign: 'left' }}><th style={{ padding: '8px 4px' }}>Description</th><th style={{ padding: '8px 4px', textAlign: 'right' }}>Qty</th><th style={{ padding: '8px 4px', textAlign: 'right' }}>Unit</th><th style={{ padding: '8px 4px', textAlign: 'right' }}>Unit Price</th><th style={{ padding: '8px 4px', textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #ebebeb' }}>
                <td style={{ padding: '8px 4px' }}>{item.description}</td><td style={{ padding: '8px 4px', textAlign: 'right' }}>{item.qty}</td><td style={{ padding: '8px 4px', textAlign: 'right' }}>{item.unit}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>${item.unit_price.toFixed(2)}</td><td style={{ padding: '8px 4px', textAlign: 'right' }}>${(item.qty * item.unit_price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginLeft: 'auto', width: 240, textAlign: 'right', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>Subtotal</span><span>${est.subtotal.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>Tax (0%)</span><span>$0.00</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #1a2744', paddingTop: 4, marginTop: 4, fontSize: 15, fontWeight: 700, color: '#1a2744' }}><span>Total</span><span>${est.total.toFixed(2)}</span></div>
        </div>

        {/* Payment Terms */}
        <div style={{ background: '#f5f4f2', border: '1px solid #e8e6e2', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: '#1a2744', marginBottom: 8 }}>Payment Terms</h4>
          <p style={{ fontWeight: 600, color: '#333' }}>{est.payment_terms || '50% deposit + 50% on completion'}</p>
          <p style={{ color: '#333', marginTop: 4 }}>Deposit: <strong>${deposit.toFixed(2)}</strong> — Balance: <strong>${balance.toFixed(2)}</strong></p>
          <p style={{ marginTop: 10, fontSize: 12, color: '#555' }}>Accepted Payment Methods: {(est.accepted_payment_methods ?? ['Check', 'ACH', 'Zelle']).join(' · ')}</p>
          <p style={{ fontSize: 11, color: '#888' }}>Check payable to: {COMPANY.check_payable}</p>
          <p style={{ fontSize: 11, color: '#888' }}>Zelle: {COMPANY.zelle}</p>
        </div>

        {est.warranty && <div style={{ marginBottom: 16 }}><h4 style={{ fontSize: 13, fontWeight: 600, color: '#1a2744', marginBottom: 4 }}>Warranty</h4><p style={{ color: '#555', lineHeight: 1.7 }}>{est.warranty}</p></div>}

        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: '#1a2744', marginBottom: 6 }}>Terms & Conditions</h4>
          <ol style={{ paddingLeft: 18, margin: 0 }}>
            {TERMS_AND_CONDITIONS.map((t, i) => <li key={i} style={{ fontSize: 12, color: '#555', lineHeight: 1.7, marginBottom: 2 }}>{t}</li>)}
          </ol>
        </div>

        {est.notes && <div style={{ marginBottom: 16 }}><h4 style={{ fontSize: 13, fontWeight: 600, color: '#1a2744', marginBottom: 4 }}>Notes</h4><p style={{ color: '#555' }}>{est.notes}</p></div>}

        {/* Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 40, paddingTop: 20, borderTop: '1px solid #e0e0e0' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9a8f82', marginBottom: 40 }}>Authorized By</p>
            <div style={{ borderTop: '1.5px solid #1a2744', marginBottom: 4 }} />
            <p style={{ fontSize: 13, color: '#1a1a1a' }}>{COMPANY.signatory} — {COMPANY.legal_name}</p>
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9a8f82', marginBottom: 40 }}>Accepted By</p>
            <div style={{ borderTop: '1.5px solid #1a2744', marginBottom: 4 }} />
            <p style={{ fontSize: 13, color: '#1a1a1a' }}>Client Printed Name, Signature & Date</p>
          </div>
        </div>

        <div style={{ marginTop: 24, paddingTop: 12, borderTop: '1px solid #ebebeb', textAlign: 'center', fontSize: 10, color: '#aaa' }}>
          {COMPANY.legal_name} | {COMPANY.tagline} | {COMPANY.address} | {COMPANY.phone} | {COMPANY.email}
        </div>
      </div>
    </>
  )
}
