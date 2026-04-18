import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Package, Truck, Wrench, Box, TrendingUp, TrendingDown } from 'lucide-react'
import { useTable } from '@/hooks/useSupabase'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { INVENTORY_CATEGORIES, ASSET_CONDITIONS, ASSET_STATUSES, fmtCurrency } from '@/lib/constants'
import { useToast } from '@/components/ui/Toast'
import type { InventoryItem, InventoryCategory, AssetCondition, AssetStatus, Supplier } from '@/lib/database.types'

const catColors: Record<string, string> = {
  'Equipment': 'orange',
  'Vehicles & Trailers': 'blue',
  'Materials & Stock': 'green',
  'Other': 'gray',
}

const catIcons: Record<string, typeof Wrench> = {
  'Equipment': Wrench,
  'Vehicles & Trailers': Truck,
  'Materials & Stock': Package,
  'Other': Box,
}

const conditionColors: Record<string, string> = { Good: 'green', Fair: 'yellow', Poor: 'red' }
const statusColors: Record<string, string> = { Active: 'green', Sold: 'blue', Retired: 'gray' }

const emptyForm = {
  name: '', category: 'Equipment' as InventoryCategory,
  description: '', brand_model: '', year_purchased: '' as string | number,
  purchase_price: 0, current_market_value: '' as string | number,
  condition: 'Good' as AssetCondition, status: 'Active' as AssetStatus,
  supplier_id: '', notes: '',
  // Materials & Stock fields
  quantity: 0, unit: 'pcs', low_stock_threshold: 10, unit_cost: 0,
}

export default function InventoryPage() {
  const { data: items, loading, insert, update, remove } = useTable<InventoryItem>('inventory')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    supabase.from('suppliers').select('*').order('name').then(({ data }) => setSuppliers(data ?? []))
  }, [])

  // Summary stats
  const summary = useMemo(() => {
    const active = items.filter(i => (i.status ?? 'Active') === 'Active')
    const totalAssets = active.length
    const totalPurchase = active.reduce((s, i) => s + (i.purchase_price || 0), 0)
    const totalCurrent = active.reduce((s, i) => s + (i.current_market_value ?? i.purchase_price ?? 0), 0)
    const diff = totalCurrent - totalPurchase
    return { totalAssets, totalPurchase, totalCurrent, diff }
  }, [items])

  // Filtering & sorting
  const filtered = useMemo(() => {
    return items
      .filter(i => {
        if (catFilter !== 'All' && i.category !== catFilter) return false
        if (statusFilter !== 'All' && (i.status ?? 'Active') !== statusFilter) return false
        if (search) {
          const q = search.toLowerCase()
          return i.name.toLowerCase().includes(q) ||
            (i.description ?? '').toLowerCase().includes(q) ||
            (i.brand_model ?? '').toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q)
        }
        return true
      })
      .sort((a, b) => {
        const va = a.current_market_value ?? a.purchase_price ?? 0
        const vb = b.current_market_value ?? b.purchase_price ?? 0
        return vb - va
      })
  }, [items, search, catFilter, statusFilter])

  function openNew() { setEditing(null); setForm(emptyForm); setModalOpen(true) }

  function openEdit(item: InventoryItem) {
    setEditing(item)
    setForm({
      name: item.name,
      category: item.category,
      description: item.description ?? '',
      brand_model: item.brand_model ?? '',
      year_purchased: item.year_purchased ?? '',
      purchase_price: item.purchase_price ?? 0,
      current_market_value: item.current_market_value ?? '',
      condition: item.condition ?? 'Good',
      status: item.status ?? 'Active',
      supplier_id: item.supplier_id ?? '',
      notes: item.notes ?? '',
      quantity: item.quantity ?? 0,
      unit: item.unit ?? 'pcs',
      low_stock_threshold: item.low_stock_threshold ?? 10,
      unit_cost: item.unit_cost ?? 0,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Asset name is required.'); return }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        category: form.category,
        description: form.description || null,
        brand_model: form.brand_model || null,
        year_purchased: form.year_purchased ? Number(form.year_purchased) : null,
        purchase_price: Number(form.purchase_price) || 0,
        current_market_value: form.current_market_value !== '' ? Number(form.current_market_value) : null,
        condition: form.condition,
        status: form.status,
        supplier_id: form.supplier_id || null,
        notes: form.notes || null,
        // Stock fields (always save, meaningful for Materials & Stock)
        quantity: form.category === 'Materials & Stock' ? Number(form.quantity) : 0,
        unit: form.category === 'Materials & Stock' ? form.unit : 'unit',
        low_stock_threshold: form.category === 'Materials & Stock' ? Number(form.low_stock_threshold) : 0,
        unit_cost: form.category === 'Materials & Stock' ? Number(form.unit_cost) : 0,
      }
      if (editing) await update(editing.id, payload)
      else await insert(payload as never)
      setModalOpen(false)
      toast.success(editing ? 'Asset updated.' : 'Asset saved.')
    } catch (err) {
      toast.error(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!editing || !confirm('Delete this asset?')) return
    try {
      await remove(editing.id); setModalOpen(false)
      toast.success('Asset deleted.')
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const isMaterialsCategory = form.category === 'Materials & Stock'

  return (
    <div className="space-y-6 p-6">
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <SummaryCard label="Total Assets" value={String(summary.totalAssets)} color="#4F6CF7" />
        <SummaryCard label="Purchase Value" value={fmtCurrency(summary.totalPurchase)} color="#6B7280" />
        <SummaryCard label="Current Value" value={fmtCurrency(summary.totalCurrent)} color="#059669" />
        <SummaryCard
          label="Gain / Loss"
          value={`${summary.diff >= 0 ? '+' : ''}${fmtCurrency(summary.diff)}`}
          color={summary.diff >= 0 ? '#059669' : '#DC2626'}
          icon={summary.diff >= 0 ? TrendingUp : TrendingDown}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end">
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Add Asset</Button>
      </div>

      {/* Filters + Table */}
      <Card>
        <div className="border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input className="w-full rounded-[10px] border border-gray-200 py-2 pl-10 pr-3 text-[13px] placeholder:text-gray-400 focus:border-[#4F6CF7] focus:outline-none focus:ring-[3px] focus:ring-[#4F6CF7]/[0.12]" placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 flex-wrap">
            {['All', ...INVENTORY_CATEGORIES].map(c => (
              <button key={c} onClick={() => setCatFilter(c)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${catFilter === c ? 'bg-[#4F6CF7] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >{c}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {['All', ...ASSET_STATUSES].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >{s}</button>
            ))}
          </div>
        </div>
        {loading ? <p className="p-6 text-sm text-gray-500">Loading...</p> : (
          <Table
            data={filtered}
            onRowClick={openEdit}
            columns={[
              { key: 'name', header: 'Asset', render: i => {
                const CatIcon = catIcons[i.category] ?? Box
                return (
                  <div className="flex items-center gap-2.5">
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: `${catColors[i.category] === 'orange' ? '#FFEDD5' : catColors[i.category] === 'blue' ? '#DBEAFE' : catColors[i.category] === 'green' ? '#D1FAE5' : '#F3F4F6'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CatIcon className="h-4 w-4" strokeWidth={1.5} color={catColors[i.category] === 'orange' ? '#C2410C' : catColors[i.category] === 'blue' ? '#1E40AF' : catColors[i.category] === 'green' ? '#065F46' : '#374151'} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</p>
                      {i.brand_model && <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{i.brand_model}</p>}
                    </div>
                  </div>
                )
              }},
              { key: 'category', header: 'Category', render: i => <Badge color={catColors[i.category] as never}>{i.category}</Badge> },
              { key: 'condition', header: 'Condition', render: i => <Badge color={(conditionColors[i.condition ?? 'Good'] ?? 'gray') as never}>{i.condition ?? 'Good'}</Badge> },
              { key: 'purchase', header: 'Purchase Price', render: i => i.purchase_price ? fmtCurrency(i.purchase_price) : '-' },
              { key: 'value', header: 'Current Value', render: i => i.current_market_value != null ? fmtCurrency(i.current_market_value) : <span style={{ color: '#9CA3AF' }}>—</span> },
              { key: 'status', header: 'Status', render: i => <Badge color={(statusColors[i.status ?? 'Active'] ?? 'gray') as never}>{i.status ?? 'Active'}</Badge> },
            ]}
          />
        )}
      </Card>

      {/* Form Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Asset' : 'New Asset'} wide>
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          <Input label="Asset Name" id="inv-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Wacker Neuson compactor, Ford F-150, Travertine pavers" />

          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Category" id="inv-cat" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as InventoryCategory }))} options={INVENTORY_CATEGORIES.map(c => ({ value: c, label: c }))} />
            <Select label="Condition" id="inv-cond" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value as AssetCondition }))} options={ASSET_CONDITIONS.map(c => ({ value: c, label: c }))} />
            <Select label="Status" id="inv-status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as AssetStatus }))} options={ASSET_STATUSES.map(s => ({ value: s, label: s }))} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Brand / Model" id="inv-brand" value={form.brand_model} onChange={e => setForm(f => ({ ...f, brand_model: e.target.value }))} placeholder="e.g. Wacker Neuson WP1550A" />
            <Input label="Year Purchased" id="inv-year" type="number" value={form.year_purchased} onChange={e => setForm(f => ({ ...f, year_purchased: e.target.value }))} placeholder="e.g. 2023" />
          </div>

          <Input label="Description" id="inv-desc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description..." />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Purchase Price ($)" id="inv-price" type="number" step="0.01" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: Number(e.target.value) }))} />
            <Input label="Current Market Value ($)" id="inv-value" type="number" step="0.01" value={form.current_market_value} onChange={e => setForm(f => ({ ...f, current_market_value: e.target.value }))} placeholder="Leave blank if unknown" />
          </div>

          {/* Materials & Stock: stock-specific fields */}
          {isMaterialsCategory && (
            <div className="border rounded-lg border-gray-200 p-4 space-y-3">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.5px] text-gray-500">Stock Details</h3>
              <div className="grid gap-3 sm:grid-cols-4">
                <Input label="Quantity" id="inv-qty" type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
                <Input label="Unit" id="inv-unit" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
                <Input label="Min Stock" id="inv-min" type="number" value={form.low_stock_threshold} onChange={e => setForm(f => ({ ...f, low_stock_threshold: Number(e.target.value) }))} />
                <Input label="Cost/Unit ($)" id="inv-ucost" type="number" step="0.01" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: Number(e.target.value) }))} />
              </div>
            </div>
          )}

          <Select label="Supplier" id="inv-sup" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} options={[{ value: '', label: '— None —' }, ...suppliers.map(s => ({ value: s.id, label: s.name }))]} />
          <Textarea label="Notes" id="inv-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

          <div className="flex justify-between border-t border-gray-200 pt-4">
            {editing && <Button variant="danger" onClick={handleDelete}>Delete</Button>}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ─── Summary Card ─── */
function SummaryCard({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon?: typeof TrendingUp }) {
  return (
    <div style={{ background: 'white', borderRadius: 10, padding: '16px 20px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B7280', marginBottom: 6 }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {Icon && <Icon className="h-4 w-4" strokeWidth={1.5} color={color} />}
        <p style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</p>
      </div>
    </div>
  )
}
