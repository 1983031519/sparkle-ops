import { useState, useEffect } from 'react'
import { Plus, Search } from 'lucide-react'
import { useTable } from '@/hooks/useSupabase'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge, statusColor } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { JOB_DIVISIONS, JOB_STATUSES } from '@/lib/constants'
import type { Job, JobDivision, JobStatus, Client } from '@/lib/database.types'

const emptyForm = { title: '', client_id: '', division: 'Pavers' as JobDivision, status: 'Lead' as JobStatus, address: '', scheduled_date: '', description: '', total_amount: 0 }

export default function JobsPage() {
  const { data: jobs, loading, insert, update, remove } = useTable<Job>('jobs')
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Job | null>(null)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients(data ?? []))
  }, [])

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]))

  const filtered = jobs.filter(j =>
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.division.toLowerCase().includes(search.toLowerCase()) ||
    j.status.toLowerCase().includes(search.toLowerCase())
  )

  function openNew() { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(job: Job) {
    setEditing(job)
    setForm({
      title: job.title, client_id: job.client_id, division: job.division, status: job.status,
      address: job.address ?? '', scheduled_date: job.scheduled_date ?? '', description: job.description ?? '', total_amount: job.total_amount,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    const payload = {
      ...form,
      address: form.address || null, scheduled_date: form.scheduled_date || null, description: form.description || null,
      completed_date: form.status === 'Completed' ? new Date().toISOString().split('T')[0] : null,
    }
    if (editing) await update(editing.id, payload)
    else await insert(payload)
    setModalOpen(false)
  }

  async function handleDelete() {
    if (editing && confirm('Delete this job?')) { await remove(editing.id); setModalOpen(false) }
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
              { key: 'division', header: 'Division', render: j => <Badge color={j.division === 'Pavers' ? 'orange' : 'blue'}>{j.division}</Badge> },
              { key: 'status', header: 'Status', render: j => <Badge color={statusColor(j.status)}>{j.status}</Badge> },
              { key: 'date', header: 'Scheduled', render: j => j.scheduled_date ?? '-' },
              { key: 'amount', header: 'Amount', render: j => `$${j.total_amount.toLocaleString()}` },
            ]}
          />
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Job' : 'New Job'}>
        <div className="space-y-4">
          <Input label="Job Title" id="title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          <Select label="Client" id="client_id" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} options={clients.map(c => ({ value: c.id, label: c.name }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Division" id="division" value={form.division} onChange={e => setForm(f => ({ ...f, division: e.target.value as JobDivision }))} options={JOB_DIVISIONS.map(d => ({ value: d, label: d }))} />
            <Select label="Status" id="status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as JobStatus }))} options={JOB_STATUSES.map(s => ({ value: s, label: s }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Scheduled Date" id="scheduled_date" type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} />
            <Input label="Total Amount ($)" id="total_amount" type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: Number(e.target.value) }))} />
          </div>
          <Input label="Job Address" id="address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          <Textarea label="Description" id="description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="flex justify-between pt-2">
            {editing && <Button variant="danger" onClick={handleDelete}>Delete</Button>}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
