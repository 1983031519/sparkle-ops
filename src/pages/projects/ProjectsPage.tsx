import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, Printer, ArrowRight, Trash2, ChevronUp, ChevronDown, Mail } from 'lucide-react'
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
import { SendDocumentModal } from '@/components/SendDocumentModal'
import { useToast } from '@/components/ui/Toast'
import { useDebounce } from '@/hooks/useDebounce'
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
  const [viewedDocIds, setViewedDocIds] = useState<Set<string>>(new Set())
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
    const [pRes, cRes, vRes] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name, email, phone, address').order('name'),
      supabase.from('document_links').select('document_id').eq('document_type', 'project').not('viewed_at', 'is', null),
    ])
    setProjects((pRes.data ?? []) as Project[])
    setClients((cRes.data ?? []) as Client[])
    setViewedDocIds(new Set((vRes.data ?? []).map((r: { document_id: string }) => r.document_id)))
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const debouncedSearch = useDebounce(search, 250)

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients])
  const filtered  = useMemo(() => projects.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(debouncedSearch.toLowerCase()) || p.number.toLowerCase().includes(debouncedSearch.toLowerCase()) || (p.client_name ?? '').toLowerCase().includes(debouncedSearch.toLowerCase())
    const matchStatus = statusFilter === 'All' || p.status === statusFilter
    return matchSearch && matchStatus
  }), [projects, debouncedSearch, statusFilter])

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
      project_photos: (proj.photos as string[]) ?? [],
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
        const { data: updated, error } = await supabase.from('projects').update(payload as never).eq('id', editing.id).select().single()
        if (error) { toast.error(`Failed: ${error.message}`); return }
        projectId = editing.id
        setProjects(prev => prev.map(p => p.id === editing.id ? updated as Project : p))
        await supabase.from('project_phases').delete().eq('project_id', projectId)
      } else {
        const { data, error } = await supabase.from('projects').insert(payload as never).select().single()
        if (error) { toast.error(`Failed: ${error.message}`); return }
        projectId = (data as Project).id
        setProjects(prev => [data as Project, ...prev])
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
      setModalOpen(false)
      toast.success(editing ? 'Project updated.' : 'Project saved.')
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!editing || !confirm('Delete this project and all phases?')) return
    const { error } = await supabase.from('projects').delete().eq('id', editing.id)
    if (error) { toast.error(error.message); return }
    setProjects(prev => prev.filter(p => p.id !== editing.id))
    setModalOpen(false)
    toast.success('Project deleted.')
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
    setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, status: 'Approved' } : p))
    toast.success('Job created from project.')
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
      <div className="flex items-center justify-end">
        <Button onClick={openNew}><Plus className="h-4 w-4" strokeWidth={1.5} /> New Project</Button>
      </div>

      <Card>
        <div className="border-b border-gray-100 px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input className="w-full rounded-[10px] border border-gray-200 py-2 pl-10 pr-3 text-[13px] placeholder:text-gray-400 focus:border-[#4F6CF7] focus:outline-none focus:ring-[3px] focus:ring-[#4F6CF7]/[0.12]" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 flex-wrap">
            {['All', ...STATUSES].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${statusFilter === s ? 'bg-[#4F6CF7] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{s}</button>
            ))}
          </div>
        </div>
        {loading ? <p className="p-6 text-sm text-gray-500">Loading...</p> : (
          <Table data={filtered} onRowClick={openEdit} columns={[
            { key: 'number', header: '#', render: p => <span className="font-mono text-xs">{p.number}</span> },
            { key: 'client', header: 'Client', render: p => p.client_name ?? '-' },
            { key: 'title', header: 'Title', render: p => p.title },
            { key: 'division', header: 'Div', render: p => <Badge color={p.division === 'Stone' ? 'blue' : 'orange'}>{p.division ?? '-'}</Badge> },
            { key: 'status', header: 'Status', render: p => <Badge color={statusColor(p.status)}>{p.status}</Badge> },
            { key: 'total', header: 'Value', render: p => fmtCurrency(p.total_value) },
            { key: 'viewed', header: '', render: p => viewedDocIds.has(p.id) ? <span style={{ fontSize: 10, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', padding: '2px 7px', borderRadius: 10, border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>Viewed</span> : null },
            { key: 'actions', header: '', render: p => (
              <div className="flex gap-2" onClick={ev => ev.stopPropagation()}>
                {p.status === 'Approved' && <Button variant="gold" size="sm" onClick={() => convertToJob(p)}><ArrowRight className="h-4 w-4" strokeWidth={1.5} /> Job</Button>}
                <Button variant="ghost" size="sm" onClick={() => openPreview(p)}><Printer className="h-4 w-4" strokeWidth={1.5} /></Button>
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
            <div className="border rounded-[12px] border-gray-200 p-4">
              <ProjectPhotoUpload
                folder={editing.id}
                photos={form.project_photos}
                onPhotosChange={urls => setForm(f => ({ ...f, project_photos: urls }))}
                persistTo={{ table: 'projects', id: editing.id, column: 'photos' }}
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
                <div key={i} className="rounded-[12px] border border-gray-200 bg-gray-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Phase {ph.order_num}</span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => movePhase(i, -1)} disabled={i === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronUp className="h-4 w-4" strokeWidth={1.5} /></button>
                      <button type="button" onClick={() => movePhase(i, 1)} disabled={i === phases.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronDown className="h-4 w-4" strokeWidth={1.5} /></button>
                      {phases.length > 1 && <button type="button" onClick={() => removePhase(i)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" strokeWidth={1.5} /></button>}
                    </div>
                  </div>
                  <Input label="Phase Title" id={`ph-title-${i}`} value={ph.title} onChange={e => updatePhase(i, 'title', e.target.value)} placeholder="e.g. Demolition & Site Prep" />
                  <Textarea label="Description" id={`ph-desc-${i}`} value={ph.description} onChange={e => updatePhase(i, 'description', e.target.value)} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input label="Timeline" id={`ph-time-${i}`} value={ph.timeline} onChange={e => updatePhase(i, 'timeline', e.target.value)} placeholder="e.g. 3-5 business days" />
                    <div>
                      <label className="flex items-center gap-2 mb-1.5">
                        <input type="checkbox" checked={ph.show_value} onChange={e => updatePhase(i, 'show_value', e.target.checked)} className="accent-blue-600 rounded" />
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
                      persistTo={ph.id ? { table: 'project_phases', id: ph.id, column: 'photos' } : undefined}
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
          <div className="border rounded-[12px] border-gray-200 p-4 space-y-3">
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
              <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
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
                    <input type="checkbox" checked={form.accepted_payment_methods.includes(m)} onChange={e => setForm(f => ({ ...f, accepted_payment_methods: e.target.checked ? [...f.accepted_payment_methods, m] : f.accepted_payment_methods.filter(x => x !== m) }))} className="accent-blue-600 rounded" />
                    <span className="text-[13px]">{m}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <Textarea label="Warranty" id="p-warranty" value={form.warranty} onChange={e => setForm(f => ({ ...f, warranty: e.target.value }))} />
          <Textarea label="Notes" id="p-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          <div className="flex justify-between border-t border-gray-200 pt-4">
            {editing && <Button variant="danger" onClick={handleDelete} type="button">Delete</Button>}
            <div className="ml-auto flex gap-2">
              {editing && editing.status === 'Approved' && <Button variant="gold" onClick={() => { convertToJob(editing); setModalOpen(false) }} type="button"><ArrowRight className="h-4 w-4" strokeWidth={1.5} /> Convert to Job</Button>}
              <Button variant="secondary" onClick={() => setModalOpen(false)} type="button">Cancel</Button>
              <Button onClick={handleSave} type="button" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* PREVIEW MODAL */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Project Proposal Preview" wide>
        {previewProject && <ProjectPreview project={previewProject} phases={previewPhases} client={previewProject.client_id ? clientMap[previewProject.client_id] : undefined} onSent={() => {
          setProjects(prev => prev.map(p => p.id === previewProject.id ? { ...p, status: 'Sent' } : p))
        }} />}
      </Modal>
    </div>
  )
}

/* ─── Resize helper ─── */
function resizeImageUrl(url: string, maxWidth = 800): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = () => resolve(url) // fallback to original
    img.src = url
  })
}

/* ─── Printable Project Preview ─── */
function ProjectPreview({ project: p, phases, client, onSent }: { project: Project; phases: ProjectPhase[]; client?: Client; onSent?: () => void }) {
  const dep = p.total_value * (p.deposit_percent / 100)
  const mid = p.total_value * (p.mid_percent / 100)
  const fin = p.total_value * (p.final_percent / 100)

  const sitePhotosRaw = (p.photos as string[]) ?? []
  const [sitePhotos, setSitePhotos] = useState<string[]>([])
  const [phasePhotos, setPhasePhotos] = useState<Record<string, string[]>>({})
  const [imagesReady, setImagesReady] = useState(false)

  // Resize all photos on mount
  useEffect(() => {
    let cancelled = false
    async function resize() {
      const resizedSite = await Promise.all(sitePhotosRaw.map(u => resizeImageUrl(u)))
      const resizedPhases: Record<string, string[]> = {}
      for (const ph of phases) {
        const urls = (ph.photos as string[]) ?? []
        if (urls.length > 0) {
          resizedPhases[ph.id] = await Promise.all(urls.map(u => resizeImageUrl(u)))
        }
      }
      if (!cancelled) {
        setSitePhotos(resizedSite)
        setPhasePhotos(resizedPhases)
        setImagesReady(true)
      }
    }
    resize()
    return () => { cancelled = true }
  }, [sitePhotosRaw, phases])

  const PDF_OPTS = {
    margin: [0.4, 0.5, 0.4, 0.5] as [number, number, number, number],
    image: { type: 'jpeg' as const, quality: 0.92 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as string[], avoid: '.phase-section' },
  }

  const hasPhotos = sitePhotosRaw.length > 0 || phases.some(ph => ((ph.photos as string[]) ?? []).length > 0)

  async function handlePrint() {
    const el = document.querySelector('.print-area') as HTMLElement | null
    if (!el) return
    const html2pdf = (await import('html2pdf.js')).default
    html2pdf().set({ ...PDF_OPTS, filename: `Project Proposal — ${p.number}.pdf` }).from(el).save()
  }

  const [sendOpen, setSendOpen] = useState(false)
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  async function handleSendClick() {
    // Wait for images if there are any — same guard as Download button
    if (hasPhotos && !imagesReady) { setSendOpen(true); return }
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
      <div className="mb-4 no-print flex items-center gap-3">
        <Button onClick={handlePrint} disabled={hasPhotos && !imagesReady}>
          <Printer className="h-4 w-4" strokeWidth={1.5} /> {hasPhotos && !imagesReady ? 'Preparing images...' : 'Download PDF'}
        </Button>
        <Button variant="gold" type="button" onClick={handleSendClick} disabled={generatingPdf || (hasPhotos && !imagesReady)}>
          <Mail className="h-4 w-4" strokeWidth={1.5} /> {generatingPdf ? 'Preparing...' : 'Send to Client'}
        </Button>
      </div>
      <SendDocumentModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        type="project"
        documentId={p.id}
        clientEmail={client?.email}
        pdfBase64={pdfBase64 ?? undefined}
        documentData={{
          number: p.number,
          date: fmtDate(isoDatePart(p.created_at)),
          total: p.total_value,
          clientName: client?.name ?? p.client_name ?? '',
        }}
        onSent={onSent}
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
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>PROJECT PROPOSAL</h3>
            <p style={{ fontFamily: 'monospace', fontSize: 13, color: '#555', margin: '4px 0' }}>{p.number}</p>
            <p style={{ fontSize: 12, color: '#666' }}>Date: {fmtDate(p.date ?? isoDatePart(p.created_at))}</p>
            {p.valid_until && <p style={{ fontSize: 12, color: '#666' }}>Valid Until: {fmtDate(p.valid_until)}</p>}
          </div>
        </div>

        {/* Client + Site */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: '#f5f4f2', border: '1px solid #e8e6e2', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9a8f82', margin: '0 0 4px' }}>Prepared For</p>
            <p style={{ fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{client?.name ?? p.client_name ?? 'N/A'}</p>
            {client?.address && <p style={{ color: '#555', margin: '2px 0' }}>{client.address}</p>}
            {client?.phone && <p style={{ color: '#555', margin: '2px 0' }}>{client.phone}</p>}
          </div>
          <div>
            {p.site_address && <><p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9a8f82', margin: '0 0 4px' }}>Job Site</p><p style={{ margin: 0 }}>{p.site_address}</p></>}
            {p.division && <p style={{ marginTop: 6, fontSize: 12 }}><span style={{ color: '#9a8f82', fontWeight: 600 }}>Division:</span> {p.division}</p>}
          </div>
        </div>

        <h4 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>{p.title}</h4>
        {p.description && <p style={{ color: '#444', whiteSpace: 'pre-wrap', marginBottom: 16 }}>{p.description}</p>}

        {/* Site photos */}
        {sitePhotos.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9a8f82', marginBottom: 8 }}>Site Photos</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {sitePhotos.map((url, i) => <img key={i} src={url} alt="" style={{ width: '100%', maxHeight: 280, borderRadius: 6, objectFit: 'cover' }} />)}
            </div>
          </div>
        )}

        {/* Phases */}
        {phases.map(ph => (
          <div key={ph.id} className="phase-section" style={{ borderTop: '1px solid #ebebeb', paddingTop: 16, marginTop: 8 }}>
            <h5 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 8 }}>PHASE {ph.order_num} — {ph.title}</h5>
            {ph.description && <p style={{ color: '#444', whiteSpace: 'pre-wrap', marginBottom: 8 }}>{ph.description}</p>}
            {(phasePhotos[ph.id] ?? (ph.photos as string[]))?.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9a8f82', marginBottom: 4 }}>Phase Photos</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(phasePhotos[ph.id] ?? (ph.photos as string[])).map((url, pi) => <img key={pi} src={url} alt="" style={{ width: '100%', maxHeight: 280, borderRadius: 6, objectFit: 'cover' }} />)}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
              {ph.timeline && <p style={{ color: '#9a8f82' }}>Timeline: <strong style={{ color: '#444' }}>{ph.timeline}</strong></p>}
              {ph.show_value && ph.value != null && <p style={{ color: '#9a8f82' }}>Value: <strong style={{ color: '#444' }}>{fmtCurrency(ph.value)}</strong></p>}
            </div>
          </div>
        ))}

        {/* Financial */}
        <div className="financial-summary" style={{ borderTop: '1px solid #e0e0e0', paddingTop: 20, marginTop: 16 }}>
          <h5 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Financial Summary</h5>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111827', color: 'white', padding: '10px 16px', borderRadius: 4, fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
            <span>Total Project Value</span><span>{fmtCurrency(p.total_value)}</span>
          </div>
          <div style={{ background: '#f5f4f2', border: '1px solid #e8e6e2', borderRadius: 8, padding: 16 }}>
            <p style={{ fontWeight: 600, color: '#333', marginBottom: 8 }}>Payment Schedule</p>
            <p style={{ color: '#333', fontSize: 13 }}>Deposit ({p.deposit_percent}%): <strong>{fmtCurrency(dep)}</strong> — due upon signing</p>
            <p style={{ color: '#333', fontSize: 13 }}>Mid-project ({p.mid_percent}%): <strong>{fmtCurrency(mid)}</strong> — due upon phase completion</p>
            <p style={{ color: '#333', fontSize: 13 }}>Final ({p.final_percent}%): <strong>{fmtCurrency(fin)}</strong> — due upon project completion</p>
            <p style={{ marginTop: 10, fontSize: 12, color: '#555' }}>Payment Methods: {(p.accepted_payment_methods ?? []).join(' · ')}</p>
            <p style={{ fontSize: 11, color: '#888' }}>Check payable to: {COMPANY.check_payable}</p>
            <p style={{ fontSize: 11, color: '#888' }}>Zelle: {COMPANY.zelle}</p>
          </div>
        </div>

        {/* Warranty */}
        {p.warranty && <div style={{ marginTop: 20 }}><h5 style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Warranty</h5><p style={{ color: '#555', lineHeight: 1.7 }}>{p.warranty}</p></div>}

        {/* Terms */}
        <div style={{ marginTop: 16 }}>
          <h5 style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 6 }}>Terms & Conditions</h5>
          <ol style={{ paddingLeft: 18, margin: 0 }}>
            {TERMS_AND_CONDITIONS.map((t, i) => <li key={i} style={{ fontSize: 12, color: '#555', lineHeight: 1.7, marginBottom: 2 }}>{t}</li>)}
          </ol>
        </div>

        {p.notes && <div style={{ marginTop: 16 }}><h5 style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Notes</h5><p style={{ color: '#555' }}>{p.notes}</p></div>}

        {/* Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 40, paddingTop: 20, borderTop: '1px solid #e0e0e0' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9a8f82', marginBottom: 40 }}>Authorized By</p>
            <div style={{ borderTop: '1.5px solid #111827', marginBottom: 4 }} />
            <p style={{ fontSize: 13, color: '#1a1a1a' }}>{COMPANY.signatory} — {COMPANY.legal_name}</p>
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9a8f82', marginBottom: 40 }}>Accepted By</p>
            <div style={{ borderTop: '1.5px solid #111827', marginBottom: 4 }} />
            <p style={{ fontSize: 13, color: '#1a1a1a' }}>Client Printed Name, Signature & Date</p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 24, paddingTop: 12, borderTop: '1px solid #ebebeb', textAlign: 'center', fontSize: 10, color: '#aaa' }}>
          {COMPANY.legal_name} | {COMPANY.tagline} | {COMPANY.address} | {COMPANY.phone} | {COMPANY.email}
        </div>
      </div>
    </>
  )
}
