import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Printer, ArrowRight, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { DateInput } from '@/components/ui/DateInput'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge, statusColor } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { InlineClientCreate } from '@/components/InlineClientCreate'
import { ProjectPhotoUpload } from '@/components/ProjectPhotoUpload'
import { useToast } from '@/components/ui/Toast'
import {
  COMPANY, DEFAULT_WARRANTY, TERMS_AND_CONDITIONS, JOB_DIVISIONS,
  generateProjectNumber, fmtCurrency, fmtDate, futureISO, isoDatePart,
} from '@/lib/constants'
import type { Project, ProjectPhase, Client } from '@/lib/database.types'

const STATUSES = ['Draft', 'Sent', 'Approved', 'In Progress', 'Completed', 'Cancelled']
const PAY_SCHEDULES = ['50% Deposit + 50% Completion', '30% / 40% / 30%', 'Custom']

interface PhaseForm {
  id?: string; order_num: number; title: string; description: string; timeline: string
  value: string; show_value: boolean; status: string; notes: string; photos: string[]
}
const emptyPhase = (n: number): PhaseForm => ({ order_num: n, title: '', description: '', timeline: '', value: '', show_value: false, status: 'Pending', notes: '', photos: [] })

interface PForm {
  client_id: string; title: string; site_address: string; division: string; status: string
  description: string; total_value: string; payment_schedule: string; payment_terms: string
  deposit_percent: string; mid_percent: string; final_percent: string
  accepted_payment_methods: string[]; warranty: string; notes: string; valid_until: string
  project_photos: string[]
}
const emptyForm: PForm = {
  client_id: '', title: '', site_address: '', division: 'Pavers', status: 'Draft',
  description: '', total_value: '', payment_schedule: '30% / 40% / 30%', payment_terms: '',
  deposit_percent: '30', mid_percent: '40', final_percent: '30',
  accepted_payment_methods: ['Check', 'ACH', 'Zelle'], warranty: DEFAULT_WARRANTY,
  notes: '', valid_until: futureISO(30),
  project_photos: [],
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState<PForm>(emptyForm)
  const [phases, setPhases] = useState<PhaseForm[]>([emptyPhase(1)])
  const [previewProject, setPreviewProject] = useState<Project | null>(null)
  const [previewPhases, setPreviewPhases] = useState<ProjectPhase[]>([])
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [pRes, cRes] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
    ])
    setProjects((pRes.data ?? []) as Project[])
    setClients((cRes.data ?? []) as Client[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]))
  const filtered = projects.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.number.toLowerCase().includes(search.toLowerCase()) || (p.client_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || p.status === statusFilter
    return matchSearch && matchStatus
  })

  function openNew() {
    setEditing(null); setForm({ ...emptyForm, valid_until: futureISO(30) }); setPhases([emptyPhase(1)]); setModalOpen(true)
  }

  async function openEdit(proj: Project) {
    setEditing(proj)
    setForm({
      client_id: proj.client_id ?? '', title: proj.title, site_address: proj.site_address ?? '',
      division: proj.division ?? 'Pavers', status: proj.status, description: proj.description ?? '',
      total_value: String(proj.total_value || ''), payment_schedule: proj.payment_schedule ?? '30% / 40% / 30%',
      payment_terms: proj.payment_terms ?? '', deposit_percent: String(proj.deposit_percent),
      mid_percent: String(proj.mid_percent), final_percent: String(proj.final_percent),
      accepted_payment_methods: proj.accepted_payment_methods ?? ['Check', 'ACH', 'Zelle'],
      warranty: proj.warranty ?? DEFAULT_WARRANTY, notes: proj.notes ?? '', valid_until: proj.valid_until ?? '',
      project_photos: [],  // TODO: load from storage if needed
    })
    const { data } = await supabase.from('project_phases').select('*').eq('project_id', proj.id).order('order_num')
    const ph = (data ?? []) as ProjectPhase[]
    setPhases(ph.length > 0 ? ph.map(p => ({
      id: p.id, order_num: p.order_num, title: p.title, description: p.description ?? '',
      timeline: p.timeline ?? '', value: p.value != null ? String(p.value) : '', show_value: p.show_value,
      status: p.status, notes: p.notes ?? '', photos: (p.photos as string[]) ?? [],
    })) : [emptyPhase(1)])
    setModalOpen(true)
  }

  function addPhase() { setPhases(ps => [...ps, emptyPhase(ps.length + 1)]) }
  function removePhase(i: number) { setPhases(ps => ps.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, order_num: idx + 1 }))) }
  function updatePhase(i: number, field: keyof PhaseForm, value: unknown) { setPhases(ps => ps.map((p, idx) => idx === i ? { ...p, [field]: value } : p)) }
  function movePhase(i: number, dir: -1 | 1) {
    setPhases(ps => { const arr = [...ps]; const j = i + dir; if (j < 0 || j >= arr.length) return arr; [arr[i], arr[j]] = [arr[j], arr[i]]; return arr.map((p, idx) => ({ ...p, order_num: idx + 1 })) })
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error('Project title is required.'); return }
    if (!form.client_id) { toast.error('Please select a client.'); return }
    setSaving(true)
    try {
      const client = clientMap[form.client_id]
      const tv = Number(form.total_value) || 0
      const payload = {
        number: editing?.number ?? generateProjectNumber(projects.length + 1),
        client_id: form.client_id, client_name: client?.name ?? null,
        title: form.title, site_address: form.site_address || null,
        division: form.division || 'Pavers', status: form.status,
        description: form.description || null, total_value: tv,
        payment_schedule: form.payment_schedule || null, payment_terms: form.payment_terms || null,
        deposit_percent: Number(form.deposit_percent) || 30,
        mid_percent: Number(form.mid_percent) || 40,
        final_percent: Number(form.final_percent) || 30,
        accepted_payment_methods: form.accepted_payment_methods,
        warranty: form.warranty || null, notes: form.notes || null,
        valid_until: form.valid_until || null,
        date: editing ? undefined : new Date().toISOString().split('T')[0],
      }

      let projectId: string
      if (editing) {
        await supabase.from('projects').update(payload as never).eq('id', editing.id)
        projectId = editing.id
        await supabase.from('project_phases').delete().eq('project_id', projectId)
      } else {
        const { data, error } = await supabase.from('projects').insert(payload as never).select().single()
        if (error) { toast.error(`Failed: ${error.message}`); return }
        projectId = (data as Project).id
      }

      const validPhases = phases.filter(p => p.title.trim())
      if (validPhases.length > 0) {
        const { error } = await supabase.from('project_phases').insert(
          validPhases.map(p => ({
            project_id: projectId, order_num: p.order_num, title: p.title,
            description: p.description || null, timeline: p.timeline || null,
            value: p.value ? Number(p.value) : null, show_value: p.show_value,
            status: p.status, notes: p.notes || null, photos: p.photos ?? [],
          })) as never
        )
        if (error) toast.error(`Phases: ${error.message}`)
      }
      await fetchAll(); setModalOpen(false)
      toast.success(editing ? 'Project updated.' : 'Project saved.')
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!editing || !confirm('Delete this project and all phases?')) return
    const { error } = await supabase.from('projects').delete().eq('id', editing.id)
    if (error) { toast.error(error.message); return }
    await fetchAll(); setModalOpen(false); toast.success('Project deleted.')
  }

  async function convertToJob(proj: Project) {
    const { data: ph } = await supabase.from('project_phases').select('*').eq('project_id', proj.id).order('order_num')
    const checklist = ((ph ?? []) as ProjectPhase[]).map(p => ({ text: `Phase ${p.order_num} — ${p.title}: ${p.timeline ?? 'TBD'}`, done: false }))
    const { error } = await supabase.from('jobs').insert({
      title: proj.title, client_id: proj.client_id, division: proj.division || 'Pavers',
      status: 'Scheduled', address: proj.site_address || null, site_address: proj.site_address || null,
      notes: proj.description || null, total: proj.total_value,
      project_id: proj.id, checklist, photos: [],
    } as never)
    if (error) { toast.error(error.message); return }
    await supabase.from('projects').update({ status: 'Approved' } as never).eq('id', proj.id)
    await fetchAll(); toast.success('Job created from project.')
  }

  async function openPreview(proj: Project) {
    const { data } = await supabase.from('project_phases').select('*').eq('project_id', proj.id).order('order_num')
    setPreviewProject(proj); setPreviewPhases((data ?? []) as ProjectPhase[]); setPreviewOpen(true)
  }

  const tv = Number(form.total_value) || 0
  const dep = tv * (Number(form.deposit_percent) / 100)
  const mid = tv * (Number(form.mid_percent) / 100)
  const fin = tv * (Number(form.final_percent) / 100)

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0D1B3D', letterSpacing: -0.5 }}>Projects</h1>
        <Button onClick={openNew}><Plus size={16} strokeWidth={1.5} /> New Project</Button>
      </div>

      <Card>
        <div className="border-b border-stone-100 px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input className="w-full rounded-[10px] border border-stone-200 py-2 pl-10 pr-3 text-[13px] placeholder:text-stone-400 focus:border-navy-900 focus:outline-none" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 flex-wrap">
            {['All', ...STATUSES].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${statusFilter === s ? 'bg-navy-900 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>{s}</button>
            ))}
          </div>
        </div>
        {loading ? <p className="p-6 text-sm text-stone-500">Loading...</p> : (
          <Table data={filtered} onRowClick={openEdit} columns={[
            { key: 'number', header: '#', render: p => <span className="font-mono text-xs">{p.number}</span> },
            { key: 'client', header: 'Client', render: p => p.client_name ?? '-' },
            { key: 'title', header: 'Title', render: p => p.title },
            { key: 'division', header: 'Div', render: p => <Badge color={p.division === 'Stone' ? 'blue' : 'orange'}>{p.division ?? '-'}</Badge> },
            { key: 'status', header: 'Status', render: p => <Badge color={statusColor(p.status)}>{p.status}</Badge> },
            { key: 'total', header: 'Value', render: p => fmtCurrency(p.total_value) },
            { key: 'actions', header: '', render: p => (
              <div className="flex gap-2" onClick={ev => ev.stopPropagation()}>
                {p.status === 'Approved' && <Button variant="gold" size="sm" onClick={() => convertToJob(p)}><ArrowRight size={14} strokeWidth={1.5} /> Job</Button>}
                <Button variant="ghost" size="sm" onClick={() => openPreview(p)}><Printer size={14} strokeWidth={1.5} /></Button>
              </div>
            )},
          ]} />
        )}
      </Card>

      {/* FORM MODAL */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Project' : 'New Project Proposal'} wide>
        <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
          <Input label="Project Title" id="p-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="e.g. Commercial Pool Remodeling — Full Scope" />
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select label="Client" id="p-client" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} options={clients.map(c => ({ value: c.id, label: c.name }))} />
            </div>
            <InlineClientCreate onCreated={c => { setClients(cs => [...cs, c]); setForm(f => ({ ...f, client_id: c.id })) }} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Site Address" id="p-site" value={form.site_address} onChange={e => setForm(f => ({ ...f, site_address: e.target.value }))} />
            <Select label="Division" id="p-div" value={form.division} onChange={e => setForm(f => ({ ...f, division: e.target.value }))} options={[...JOB_DIVISIONS, 'Both'].map(d => ({ value: d, label: d }))} />
            <Select label="Status" id="p-status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} options={STATUSES.map(s => ({ value: s, label: s }))} />
          </div>
          <DateInput label="Valid Until" id="p-valid" value={form.valid_until} onChange={v => setForm(f => ({ ...f, valid_until: v }))} />
          <Textarea label="Project Description" id="p-desc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

          {/* PROJECT PHOTOS */}
          {editing && (
            <div className="border rounded-[12px] border-stone-200 p-4">
              <ProjectPhotoUpload
                folder={editing.id}
                photos={form.project_photos}
                onPhotosChange={urls => setForm(f => ({ ...f, project_photos: urls }))}
                maxPhotos={6}
                label="Site Overview / Existing Conditions"
              />
            </div>
          )}
          {!editing && <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Save the project first to upload site photos.</p>}

          {/* PHASES */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6B7280', marginBottom: 12 }}>Project Phases</p>
            <div className="space-y-3">
              {phases.map((ph, i) => (
                <div key={i} className="rounded-[12px] border border-stone-200 bg-stone-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0D1B3D' }}>Phase {ph.order_num}</span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => movePhase(i, -1)} disabled={i === 0} className="p-1 text-stone-400 hover:text-stone-600 disabled:opacity-30"><ChevronUp size={14} /></button>
                      <button type="button" onClick={() => movePhase(i, 1)} disabled={i === phases.length - 1} className="p-1 text-stone-400 hover:text-stone-600 disabled:opacity-30"><ChevronDown size={14} /></button>
                      {phases.length > 1 && <button type="button" onClick={() => removePhase(i)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}
                    </div>
                  </div>
                  <Input label="Phase Title" id={`ph-title-${i}`} value={ph.title} onChange={e => updatePhase(i, 'title', e.target.value)} placeholder="e.g. Demolition & Site Prep" />
                  <Textarea label="Description" id={`ph-desc-${i}`} value={ph.description} onChange={e => updatePhase(i, 'description', e.target.value)} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input label="Timeline" id={`ph-time-${i}`} value={ph.timeline} onChange={e => updatePhase(i, 'timeline', e.target.value)} placeholder="e.g. 3-5 business days" />
                    <div>
                      <label className="flex items-center gap-2 mb-1.5">
                        <input type="checkbox" checked={ph.show_value} onChange={e => updatePhase(i, 'show_value', e.target.checked)} className="accent-navy-900 rounded" />
                        <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6B7280' }}>Show Value</span>
                      </label>
                      {ph.show_value && <Input id={`ph-val-${i}`} type="number" step="0.01" value={ph.value} onChange={e => updatePhase(i, 'value', e.target.value)} placeholder="$0.00" />}
                    </div>
                    <Select label="Phase Status" id={`ph-st-${i}`} value={ph.status} onChange={e => updatePhase(i, 'status', e.target.value)} options={['Pending', 'In Progress', 'Completed'].map(s => ({ value: s, label: s }))} />
                  </div>
                  {/* Phase Photos */}
                  {editing && (
                    <ProjectPhotoUpload
                      folder={`${editing.id}/phase-${ph.order_num}`}
                      photos={ph.photos}
                      onPhotosChange={urls => updatePhase(i, 'photos', urls)}
                      maxPhotos={4}
                      label={`Phase ${ph.order_num} Photos`}
                    />
                  )}
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={addPhase} className="mt-3">+ Add Phase</Button>
          </div>

          {/* FINANCIAL */}
          <div className="border rounded-[12px] border-stone-200 p-4 space-y-3">
            <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6B7280' }}>Financial</p>
            <Input label="Total Project Value ($)" id="p-total" type="number" step="0.01" value={form.total_value} onChange={e => setForm(f => ({ ...f, total_value: e.target.value }))} />
            <Select label="Payment Schedule" id="p-sched" value={form.payment_schedule} onChange={e => setForm(f => ({ ...f, payment_schedule: e.target.value }))} options={PAY_SCHEDULES.map(s => ({ value: s, label: s }))} />
            {form.payment_schedule === '30% / 40% / 30%' || form.payment_schedule === 'Custom' ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <Input label="Deposit %" id="p-dep" type="number" value={form.deposit_percent} onChange={e => setForm(f => ({ ...f, deposit_percent: e.target.value }))} />
                <Input label="Mid-project %" id="p-mid" type="number" value={form.mid_percent} onChange={e => setForm(f => ({ ...f, mid_percent: e.target.value }))} />
                <Input label="Final %" id="p-fin" type="number" value={form.final_percent} onChange={e => setForm(f => ({ ...f, final_percent: e.target.value }))} />
              </div>
            ) : null}
            {tv > 0 && (
              <div className="rounded-lg bg-stone-50 p-3 text-sm space-y-1">
                <p>Deposit: <strong>{fmtCurrency(dep)}</strong></p>
                <p>Mid-project: <strong>{fmtCurrency(mid)}</strong></p>
                <p>Final: <strong>{fmtCurrency(fin)}</strong></p>
              </div>
            )}
            <div className="space-y-1.5">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6B7280' }}>Payment Methods</label>
              <div className="flex flex-wrap gap-4">
                {['Check', 'ACH', 'Zelle', 'Cash'].map(m => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.accepted_payment_methods.includes(m)} onChange={e => setForm(f => ({ ...f, accepted_payment_methods: e.target.checked ? [...f.accepted_payment_methods, m] : f.accepted_payment_methods.filter(x => x !== m) }))} className="accent-navy-900 rounded" />
                    <span className="text-[13px]">{m}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <Textarea label="Warranty" id="p-warranty" value={form.warranty} onChange={e => setForm(f => ({ ...f, warranty: e.target.value }))} />
          <Textarea label="Notes" id="p-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          <div className="flex justify-between border-t border-stone-200 pt-4">
            {editing && <Button variant="danger" onClick={handleDelete} type="button">Delete</Button>}
            <div className="ml-auto flex gap-2">
              {editing && editing.status === 'Approved' && <Button variant="gold" onClick={() => { convertToJob(editing); setModalOpen(false) }} type="button"><ArrowRight size={14} /> Convert to Job</Button>}
              <Button variant="secondary" onClick={() => setModalOpen(false)} type="button">Cancel</Button>
              <Button onClick={handleSave} type="button" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* PREVIEW MODAL */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Project Proposal Preview" wide>
        {previewProject && <ProjectPreview project={previewProject} phases={previewPhases} client={previewProject.client_id ? clientMap[previewProject.client_id] : undefined} />}
      </Modal>
    </div>
  )
}

/* ─── Printable Project Preview ─── */
function ProjectPreview({ project: p, phases, client }: { project: Project; phases: ProjectPhase[]; client?: Client }) {
  const dep = p.total_value * (p.deposit_percent / 100)
  const mid = p.total_value * (p.mid_percent / 100)
  const fin = p.total_value * (p.final_percent / 100)

  return (
    <>
      <div className="mb-4 no-print"><Button onClick={() => window.print()}><Printer size={14} strokeWidth={1.5} /> Print</Button></div>
      <div className="space-y-6 text-sm leading-relaxed">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <img src="/logo-dark.png" alt="Sparkle" style={{ width: 160, height: 'auto', display: 'block', marginBottom: 8 }} />
            <p className="text-xs text-stone-500">{COMPANY.address}</p>
            <p className="text-xs text-stone-500">{COMPANY.phone} | {COMPANY.email}</p>
          </div>
          <div className="text-right">
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0D1B3D' }}>PROJECT PROPOSAL</h3>
            <p className="font-mono text-sm">{p.number}</p>
            <p className="text-stone-500">Date: {fmtDate(p.date ?? isoDatePart(p.created_at))}</p>
            {p.valid_until && <p className="text-stone-500">Valid Until: {fmtDate(p.valid_until)}</p>}
          </div>
        </div>

        {/* Client + Site */}
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-stone-50 p-4">
          <div>
            <p className="text-xs font-semibold uppercase text-stone-500">Prepared For</p>
            <p className="font-medium">{client?.name ?? p.client_name ?? 'N/A'}</p>
            {client?.address && <p className="text-stone-600">{client.address}</p>}
            {client?.phone && <p className="text-stone-600">{client.phone}</p>}
          </div>
          <div>
            {p.site_address && <><p className="text-xs font-semibold uppercase text-stone-500">Job Site</p><p>{p.site_address}</p></>}
            {p.division && <p className="mt-1"><span className="text-xs font-semibold text-stone-500">Division:</span> {p.division}</p>}
          </div>
        </div>

        <h4 style={{ fontSize: 16, fontWeight: 700, color: '#0D1B3D' }}>{p.title}</h4>
        {p.description && <p className="text-stone-700 whitespace-pre-wrap">{p.description}</p>}

        {/* Phases */}
        {phases.map(ph => (
          <div key={ph.id} className="border-t-2 border-stone-200 pt-4 phase-section">
            <h5 style={{ fontSize: 14, fontWeight: 700, color: '#0D1B3D', marginBottom: 8 }}>
              PHASE {ph.order_num} — {ph.title}
            </h5>
            {ph.description && <p className="text-stone-700 whitespace-pre-wrap mb-2">{ph.description}</p>}
            {/* Phase photos */}
            {(ph.photos as string[])?.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '8px 0' }}>
                {(ph.photos as string[]).map((url, pi) => (
                  <img key={pi} src={url} alt="" style={{ width: '100%', borderRadius: 8, objectFit: 'cover', aspectRatio: '4/3' }} />
                ))}
              </div>
            )}
            <div className="flex gap-6 text-xs text-stone-500">
              {ph.timeline && <p>Timeline: <strong className="text-stone-700">{ph.timeline}</strong></p>}
              {ph.show_value && ph.value != null && <p>Value: <strong className="text-stone-700">{fmtCurrency(ph.value)}</strong></p>}
            </div>
          </div>
        ))}

        {/* Financial */}
        <hr style={{ border: 'none', borderTop: '2px solid #D1D5DB', margin: '8px 0' }} />
        <div className="pt-4 print-break-before">
          <h5 style={{ fontSize: 14, fontWeight: 700, color: '#0D1B3D', marginBottom: 8 }}>Financial Summary</h5>
          <div className="ml-auto w-80 space-y-1 text-right">
            <div className="flex justify-between text-base font-bold"><span>Total Project Value</span><span>{fmtCurrency(p.total_value)}</span></div>
          </div>
          <div className="mt-3 rounded-lg bg-stone-50 p-4 space-y-1">
            <p className="font-semibold mb-2">Payment Schedule</p>
            <p>Deposit ({p.deposit_percent}%): <strong>{fmtCurrency(dep)}</strong> — due upon signing</p>
            <p>Mid-project ({p.mid_percent}%): <strong>{fmtCurrency(mid)}</strong> — due upon phase completion</p>
            <p>Final ({p.final_percent}%): <strong>{fmtCurrency(fin)}</strong> — due upon project completion</p>
            <p className="mt-2 text-xs text-stone-600">Payment Methods: {(p.accepted_payment_methods ?? []).join(' · ')}</p>
            <p className="text-xs text-stone-500">Check payable to: {COMPANY.check_payable}</p>
            <p className="text-xs text-stone-500">Zelle: {COMPANY.zelle}</p>
          </div>
        </div>

        {/* Warranty */}
        {p.warranty && <div><h5 className="font-semibold mb-1">Warranty</h5><p className="text-stone-700">{p.warranty}</p></div>}

        {/* Terms */}
        <div>
          <h5 className="font-semibold mb-1">Terms & Conditions</h5>
          <ol className="list-decimal list-inside space-y-1 text-xs text-stone-600">
            {TERMS_AND_CONDITIONS.map((t, i) => <li key={i}>{t}</li>)}
          </ol>
        </div>

        {p.notes && <div><h5 className="font-semibold mb-1">Notes</h5><p className="text-stone-600">{p.notes}</p></div>}

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 mt-8 pt-4 border-t border-stone-200">
          <div>
            <p className="text-xs font-semibold uppercase text-stone-500 mb-8">Authorized By</p>
            <div className="border-b border-stone-400 mb-1" />
            <p className="text-sm">{COMPANY.signatory} — {COMPANY.legal_name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-stone-500 mb-8">Accepted By</p>
            <div className="border-b border-stone-400 mb-1" />
            <p className="text-sm">Client Printed Name, Signature & Date</p>
          </div>
        </div>

        <div className="mt-4 text-center text-[10px] text-stone-400 border-t border-stone-100 pt-2">
          {COMPANY.legal_name} | {COMPANY.tagline} | {COMPANY.address} | {COMPANY.phone} | {COMPANY.email}
        </div>
      </div>
    </>
  )
}
