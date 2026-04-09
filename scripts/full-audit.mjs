import { createClient } from '@supabase/supabase-js'

const url = 'https://whtnxguqfnyovbvgkaso.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodG54Z3VxZm55b3ZidmdrYXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODI1NTEsImV4cCI6MjA5MTI1ODU1MX0.smb4Tcdhp2b3bYPTUgtFasVOhWHWkkvOpVei1rN_tBM'
const supabase = createClient(url, key)

const { error: authErr } = await supabase.auth.signInWithPassword({
  email: 'oscar@sparklestonepavers.com', password: 'caio0106'
})
if (authErr) { console.log('❌ AUTH FAILED:', authErr.message); process.exit(1) }
console.log('✅ Authenticated\n')

// ═══ STEP 1: TABLE READ/WRITE AUDIT ═══
console.log('═══ DATABASE TABLE AUDIT ═══\n')
const tables = ['clients', 'client_contacts', 'jobs', 'estimates', 'invoices', 'change_orders', 'suppliers', 'inventory']
for (const table of tables) {
  const { data, error } = await supabase.from(table).select('*').limit(1)
  if (error) {
    console.log(`❌ ${table}: READ FAILED — ${error.message}`)
  } else {
    const count = (await supabase.from(table).select('id', { count: 'exact', head: true })).count ?? 0
    console.log(`✅ ${table}: readable, ${count} rows`)
  }
}

// ═══ STEP 2: E2E FLOW TEST ═══
console.log('\n═══ E2E FLOW TEST ═══\n')
const R = []
let cId, eId, jId, coId, iId

// 1. Client
{
  const { data, error } = await supabase.from('clients').insert({
    name: 'AUDIT_Client', type: 'Homeowner', email: 'audit@test.com', phone: '(941) 555-9999',
  }).select().single()
  if (error) R.push({ t: '1. Create Client', s: '❌', r: error.message })
  else { cId = data.id; R.push({ t: '1. Create Client', s: '✅' }) }
}

// 2. Estimate
if (cId) {
  const { data, error } = await supabase.from('estimates').insert({
    number: 'AUDIT-001', estimate_number: 'AUDIT-001', client_id: cId, status: 'Draft',
    division: 'Pavers', line_items: [{ description: 'Test', qty: 100, unit: 'sq ft', unit_price: 10 }],
    subtotal: 1000, total: 1000, deposit_amount: 500, balance_amount: 500,
    warranty: '1 year warranty', valid_until: '2026-06-01',
  }).select().single()
  if (error) R.push({ t: '2. Create Estimate', s: '❌', r: error.message })
  else { eId = data.id; R.push({ t: '2. Create Estimate', s: '✅' }) }
}

// 3. Convert to Job
if (cId && eId) {
  const { data, error } = await supabase.from('jobs').insert({
    title: 'AUDIT Job', client_id: cId, division: 'Pavers', status: 'Scheduled',
    total: 1000, estimate_id: eId, start_date: '2026-05-01', checklist: [], photos: [],
  }).select().single()
  if (error) R.push({ t: '3. Convert to Job', s: '❌', r: error.message })
  else { jId = data.id; R.push({ t: '3. Convert to Job', s: '✅' }) }
}

// 4. Change Order
if (jId) {
  const { data, error } = await supabase.from('change_orders').insert({
    job_id: jId, description: 'AUDIT CO', reason: 'Area increase',
    qty: 50, unit: 'sq ft', unit_price: 12, total: 600, status: 'Approved',
  }).select().single()
  if (error) R.push({ t: '4. Add Change Order', s: '❌', r: error.message })
  else { coId = data.id; R.push({ t: '4. Add Change Order', s: '✅' }) }
}

// 5. Generate Invoice
if (cId && jId) {
  const { data, error } = await supabase.from('invoices').insert({
    number: 'AUDIT-INV-001', client_id: cId, job_id: jId, estimate_id: eId,
    status: 'Unpaid', line_items: [
      { description: 'Original work', qty: 100, unit: 'sq ft', unit_price: 10 },
      { description: 'CO #1 — Area increase', qty: 50, unit: 'sq ft', unit_price: 12, is_change_order: true },
    ],
    subtotal: 1600, total: 1600, due_date: '2026-06-01',
  }).select().single()
  if (error) R.push({ t: '5. Generate Invoice', s: '❌', r: error.message })
  else { iId = data.id; R.push({ t: '5. Generate Invoice', s: '✅', total: data.total }) }
}

// 6. Mark Paid
if (iId) {
  const { error } = await supabase.from('invoices').update({ status: 'Paid' }).eq('id', iId)
  if (error) R.push({ t: '6. Mark Invoice Paid', s: '❌', r: error.message })
  else {
    const { data } = await supabase.from('invoices').select('status').eq('id', iId).single()
    R.push({ t: '6. Mark Invoice Paid', s: data?.status === 'Paid' ? '✅' : '❌' })
  }
}

// Print results
for (const r of R) console.log(`${r.s} ${r.t}${r.r ? ` — ${r.r}` : ''}`)

const passed = R.filter(r => r.s === '✅').length
const failed = R.filter(r => r.s === '❌').length
console.log(`\n${failed === 0 ? '✅ ALL PASSED' : '❌ FAILURES'}: ${passed}/${R.length} passed\n`)

// Cleanup
console.log('--- Cleanup ---')
if (iId) await supabase.from('invoices').delete().eq('id', iId)
if (coId) await supabase.from('change_orders').delete().eq('id', coId)
if (jId) await supabase.from('jobs').delete().eq('id', jId)
if (eId) await supabase.from('estimates').delete().eq('id', eId)
if (cId) await supabase.from('clients').delete().eq('id', cId)
console.log('✅ All test records cleaned up')
