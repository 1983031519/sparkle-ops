import { useState, useEffect } from 'react'
import { Plus, Search, AlertTriangle } from 'lucide-react'
import { useTable } from '@/hooks/useSupabase'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { INVENTORY_CATEGORIES, fmtCurrency } from '@/lib/constants'
import type { InventoryItem, InventoryCategory, Supplier } from '@/lib/database.types'

const emptyForm = { name: '', category: 'Bricks' as InventoryCategory, supplier_id: '', quantity: 0, unit: 'pcs', low_stock_threshold: 10, unit_cost: 0 }

export default function InventoryPage() {
  const { data: items, loading, insert, update, remove } = useTable<InventoryItem>('inventory')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    supabase.from('suppliers').select('*').order('name').then(({ data }) => setSuppliers(data ?? []))
  }, [])

  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]))
  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()))
  const lowStockCount = items.filter(i => i.quantity <= i.low_stock_threshold).length

  function openNew() { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(item: InventoryItem) {
    setEditing(item)
    setForm({
      name: item.name, category: item.category, supplier_id: item.supplier_id ?? '',
      quantity: item.quantity, unit: item.unit, low_stock_threshold: item.low_stock_threshold, unit_cost: item.unit_cost,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    const payload = { ...form, supplier_id: form.supplier_id || null }
    if (editing) await update(editing.id, payload)
    else await insert(payload)
    setModalOpen(false)
  }

  async function handleDelete() {
    if (editing && confirm('Delete this item?')) { await remove(editing.id); setModalOpen(false) }
  }

  const catColors: Record<string, string> = { Bricks: 'orange', Slabs: 'blue', Tiles: 'purple', Sand: 'yellow', Sealant: 'green' }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Inventory / Stock</h1>
          {lowStockCount > 0 && (
            <Badge color="red" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {lowStockCount} low stock
            </Badge>
          )}
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Add Item</Button>
      </div>

      <Card>
        <div className="border-b border-stone-100 px-4 py-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input className="w-full rounded-lg border border-stone-300 py-2 pl-10 pr-3 text-sm placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" placeholder="Search inventory..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? <p className="p-6 text-sm text-stone-500">Loading...</p> : (
          <Table
            data={filtered}
            onRowClick={openEdit}
            columns={[
              { key: 'name', header: 'Item', render: i => (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{i.name}</span>
                  {i.quantity <= i.low_stock_threshold && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                </div>
              )},
              { key: 'category', header: 'Category', render: i => <Badge color={catColors[i.category] as never}>{i.category}</Badge> },
              { key: 'qty', header: 'Quantity', render: i => (
                <span className={i.quantity <= i.low_stock_threshold ? 'font-bold text-red-600' : ''}>
                  {i.quantity} {i.unit}
                </span>
              )},
              { key: 'min', header: 'Min Stock', render: i => `${i.low_stock_threshold} ${i.unit}` },
              { key: 'cost', header: 'Cost/Unit', render: i => fmtCurrency(i.unit_cost) },
              { key: 'supplier', header: 'Supplier', render: i => i.supplier_id ? supplierMap[i.supplier_id] ?? '-' : '-' },
            ]}
          />
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Inventory Item' : 'New Inventory Item'}>
        <div className="space-y-4">
          <Input label="Item Name" id="inv-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Category" id="inv-cat" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as InventoryCategory }))} options={INVENTORY_CATEGORIES.map(c => ({ value: c, label: c }))} />
            <Select label="Supplier" id="inv-sup" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} options={suppliers.map(s => ({ value: s.id, label: s.name }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Quantity" id="inv-qty" type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
            <Input label="Unit" id="inv-unit" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
            <Input label="Min Stock" id="inv-min" type="number" value={form.low_stock_threshold} onChange={e => setForm(f => ({ ...f, low_stock_threshold: Number(e.target.value) }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Cost per Unit ($)" id="inv-cost" type="number" step="0.01" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: Number(e.target.value) }))} />
          </div>
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
