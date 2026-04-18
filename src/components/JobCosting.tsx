import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { fmtCurrency } from '@/lib/constants'
import type { JobMaterialCost, JobLaborCost, JobOtherCost } from '@/lib/database.types'

interface Props {
  jobId: string
  jobRevenue: number // from linked invoice
}

export function JobCosting({ jobId, jobRevenue }: Props) {
  const [materials, setMaterials] = useState<JobMaterialCost[]>([])
  const [labor, setLabor] = useState<JobLaborCost[]>([])
  const [other, setOther] = useState<JobOtherCost[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const fetchCosts = useCallback(async () => {
    const [mRes, lRes, oRes] = await Promise.all([
      supabase.from('job_material_costs').select('*').eq('job_id', jobId).order('created_at'),
      supabase.from('job_labor_costs').select('*').eq('job_id', jobId).order('created_at'),
      supabase.from('job_other_costs').select('*').eq('job_id', jobId).order('created_at'),
    ])
    setMaterials((mRes.data ?? []) as JobMaterialCost[])
    setLabor((lRes.data ?? []) as JobLaborCost[])
    setOther((oRes.data ?? []) as JobOtherCost[])
    setLoading(false)
  }, [jobId])

  useEffect(() => { fetchCosts() }, [fetchCosts])

  // Materials
  async function addMaterial() {
    const { error } = await supabase.from('job_material_costs').insert({ job_id: jobId, description: '', quantity: 1, unit: 'each', unit_cost: 0, total: 0 } as never)
    if (error) { toast.error(error.message); return }
    fetchCosts()
  }
  async function updateMaterial(id: string, field: string, value: unknown) {
    const update: Record<string, unknown> = { [field]: value }
    if (field === 'quantity' || field === 'unit_cost') {
      const m = materials.find(x => x.id === id)
      if (m) {
        const qty = field === 'quantity' ? Number(value) : m.quantity
        const uc = field === 'unit_cost' ? Number(value) : m.unit_cost
        update.total = qty * uc
      }
    }
    await supabase.from('job_material_costs').update(update as never).eq('id', id)
    fetchCosts()
  }
  async function deleteMaterial(id: string) {
    await supabase.from('job_material_costs').delete().eq('id', id)
    fetchCosts()
  }

  // Labor
  async function addLabor() {
    const { error } = await supabase.from('job_labor_costs').insert({ job_id: jobId, description: '', total_amount: 0 } as never)
    if (error) { toast.error(error.message); return }
    fetchCosts()
  }
  async function updateLabor(id: string, field: string, value: unknown) {
    await supabase.from('job_labor_costs').update({ [field]: value } as never).eq('id', id)
    fetchCosts()
  }
  async function deleteLabor(id: string) {
    await supabase.from('job_labor_costs').delete().eq('id', id)
    fetchCosts()
  }

  // Other
  async function addOther() {
    const { error } = await supabase.from('job_other_costs').insert({ job_id: jobId, description: '', amount: 0 } as never)
    if (error) { toast.error(error.message); return }
    fetchCosts()
  }
  async function updateOther(id: string, field: string, value: unknown) {
    await supabase.from('job_other_costs').update({ [field]: value } as never).eq('id', id)
    fetchCosts()
  }
  async function deleteOther(id: string) {
    await supabase.from('job_other_costs').delete().eq('id', id)
    fetchCosts()
  }

  const totalMaterials = materials.reduce((s, m) => s + (m.total || m.quantity * m.unit_cost), 0)
  const totalLabor = labor.reduce((s, l) => s + l.total_amount, 0)
  const totalOther = other.reduce((s, o) => s + o.amount, 0)
  const totalCost = totalMaterials + totalLabor + totalOther
  const grossProfit = jobRevenue - totalCost
  const margin = jobRevenue > 0 ? (grossProfit / jobRevenue) * 100 : 0

  if (loading) return <p style={{ fontSize: 13, color: '#9CA3AF', padding: 12 }}>Loading costs...</p>

  const inputStyle: React.CSSProperties = { height: 32, borderRadius: 6, border: '1px solid #E5E7EB', padding: '0 8px', fontSize: 13, outline: 'none', width: '100%' }
  const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF', marginBottom: 2 }

  return (
    <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <DollarSign className="h-4 w-4" strokeWidth={1.5} color="#4F6CF7" />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Job Costing</span>
        <span style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>Internal only</span>
      </div>

      {/* MATERIALS */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <p style={labelStyle}>Materials</p>
          <Button variant="ghost" size="sm" type="button" onClick={addMaterial}><Plus className="h-4 w-4" strokeWidth={1.5} /> Add</Button>
        </div>
        {materials.map(m => (
          <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '2fr 60px 60px 80px 80px 24px', gap: 4, marginBottom: 4, alignItems: 'center' }}>
            <input style={inputStyle} value={m.description} placeholder="Description" onChange={e => updateMaterial(m.id, 'description', e.target.value)} onBlur={e => updateMaterial(m.id, 'description', e.target.value)} />
            <input style={inputStyle} type="number" value={m.quantity} onChange={e => updateMaterial(m.id, 'quantity', Number(e.target.value))} />
            <input style={inputStyle} value={m.unit} onChange={e => updateMaterial(m.id, 'unit', e.target.value)} />
            <input style={inputStyle} type="number" step="0.01" value={m.unit_cost} placeholder="$/unit" onChange={e => updateMaterial(m.id, 'unit_cost', Number(e.target.value))} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#333', textAlign: 'right' }}>{fmtCurrency(m.quantity * m.unit_cost)}</span>
            <button type="button" onClick={() => deleteMaterial(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><Trash2 className="h-4 w-4" strokeWidth={1.5} color="#DC2626" /></button>
          </div>
        ))}
        {materials.length > 0 && <p style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#333', marginTop: 4 }}>Materials: {fmtCurrency(totalMaterials)}</p>}
      </div>

      {/* LABOR */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <p style={labelStyle}>Labor</p>
          <Button variant="ghost" size="sm" type="button" onClick={addLabor}><Plus className="h-4 w-4" strokeWidth={1.5} /> Add</Button>
        </div>
        {labor.map(l => (
          <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '3fr 100px 24px', gap: 4, marginBottom: 4, alignItems: 'center' }}>
            <input style={inputStyle} value={l.description} placeholder="e.g. Install crew — 3 days" onChange={e => updateLabor(l.id, 'description', e.target.value)} />
            <input style={inputStyle} type="number" step="0.01" value={l.total_amount} placeholder="$" onChange={e => updateLabor(l.id, 'total_amount', Number(e.target.value))} />
            <button type="button" onClick={() => deleteLabor(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><Trash2 className="h-4 w-4" strokeWidth={1.5} color="#DC2626" /></button>
          </div>
        ))}
        {labor.length > 0 && <p style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#333', marginTop: 4 }}>Labor: {fmtCurrency(totalLabor)}</p>}
      </div>

      {/* OTHER EXPENSES */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <p style={labelStyle}>Other Expenses</p>
          <Button variant="ghost" size="sm" type="button" onClick={addOther}><Plus className="h-4 w-4" strokeWidth={1.5} /> Add</Button>
        </div>
        {other.map(o => (
          <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '3fr 100px 24px', gap: 4, marginBottom: 4, alignItems: 'center' }}>
            <input style={inputStyle} value={o.description} placeholder="e.g. Dump fee, diesel, rental" onChange={e => updateOther(o.id, 'description', e.target.value)} />
            <input style={inputStyle} type="number" step="0.01" value={o.amount} placeholder="$" onChange={e => updateOther(o.id, 'amount', Number(e.target.value))} />
            <button type="button" onClick={() => deleteOther(o.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><Trash2 className="h-4 w-4" strokeWidth={1.5} color="#DC2626" /></button>
          </div>
        ))}
        {other.length > 0 && <p style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#333', marginTop: 4 }}>Other: {fmtCurrency(totalOther)}</p>}
      </div>

      {/* SUMMARY */}
      <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 12, marginTop: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
          <div>
            <p style={{ color: '#6B7280' }}>Materials: <strong style={{ color: '#333' }}>{fmtCurrency(totalMaterials)}</strong></p>
            <p style={{ color: '#6B7280' }}>Labor: <strong style={{ color: '#333' }}>{fmtCurrency(totalLabor)}</strong></p>
            <p style={{ color: '#6B7280' }}>Other: <strong style={{ color: '#333' }}>{fmtCurrency(totalOther)}</strong></p>
            <p style={{ fontWeight: 700, color: '#111827', marginTop: 4, fontSize: 14 }}>Total Cost: {fmtCurrency(totalCost)}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#6B7280' }}>Revenue: <strong style={{ color: '#333' }}>{fmtCurrency(jobRevenue)}</strong></p>
            <p style={{ fontWeight: 700, fontSize: 16, color: grossProfit >= 0 ? '#16A34A' : '#DC2626', marginTop: 8 }}>
              Profit: {fmtCurrency(grossProfit)}
            </p>
            <p style={{ fontSize: 12, color: grossProfit >= 0 ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
              Margin: {margin.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
