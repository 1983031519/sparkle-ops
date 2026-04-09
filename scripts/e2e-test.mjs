// E2E Flow Test — uses actual Supabase column names verified by schema probe
import { createClient } from '@supabase/supabase-js'

const url = 'https://whtnxguqfnyovbvgkaso.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodG54Z3VxZm55b3ZidmdrYXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODI1NTEsImV4cCI6MjA5MTI1ODU1MX0.smb4Tcdhp2b3bYPTUgtFasVOhWHWkkvOpVei1rN_tBM'
const supabase = createClient(url, key)

const { error: authErr } = await supabase.auth.signInWithPassword({
  email: 'oscar@sparklestonepavers.com', password: 'caio0106'
})
if (authErr) { console.log('AUTH FAILED:', authErr.message); process.exit(1) }
console.log('Authenticated.\n')

const results = []
let testClientId, testEstimateId, testJobId, testCOId, testInvoiceId

// 1. Insert Client
{
  const { data, error } = await supabase.from('clients').insert({
    name: 'E2E Test Client', type: 'Homeowner', email: 'e2e@test.com', phone: '(941) 555-0000', address: '123 Test St, Bradenton, FL 34211',
  }).select().single()
  if (error) results.push({ test: '1. Insert Client', status: 'FAIL', reason: error.message })
  else { testClientId = data.id; results.push({ test: '1. Insert Client', status: 'PASS' }) }
}

// 2. Insert Estimate (using actual DB columns)
if (testClientId) {
  const { data, error } = await supabase.from('estimates').insert({
    number: 'E2E-0101-P-999', estimate_number: 'E2E-0101-P-999',
    client_id: testClientId, status: 'Draft', division: 'Pavers',
    attn: 'Test Contact', site_address: '456 Test Ave, Bradenton, FL 34211',
    re_line: 'E2E paver install — 456 Test Ave', scope_of_work: 'Install pavers.',
    materials_specified: { paver_type: 'Tremron', paver_size: '6x9', paver_color: 'Sand' },
    start_date: '2026-05-01', end_date: '2026-05-15',
    line_items: [{ description: 'Paver install', qty: 500, unit: 'sq ft', unit_price: 12.50 }],
    subtotal: 6250, total: 6250, deposit_amount: 3125, balance_amount: 3125,
    warranty: '1 year workmanship warranty.', notes: 'E2E test', valid_until: '2026-06-01',
  }).select().single()
  if (error) results.push({ test: '2. Insert Estimate', status: 'FAIL', reason: error.message })
  else { testEstimateId = data.id; results.push({ test: '2. Insert Estimate', status: 'PASS' }) }
}

// 3. Convert Estimate → Job
if (testClientId && testEstimateId) {
  const { data, error } = await supabase.from('jobs').insert({
    title: 'E2E paver install — 456 Test Ave', client_id: testClientId,
    division: 'Pavers', status: 'Scheduled', address: '456 Test Ave',
    site_address: '456 Test Ave, Bradenton, FL 34211', re_line: 'E2E paver install',
    notes: 'Install pavers.', total: 6250, estimate_id: testEstimateId,
    start_date: '2026-05-01', checklist: [{ text: 'Prep base', done: false }], photos: [],
    assigned_to: 'Test Tech', materials_used: 'Tremron 6x9',
  }).select().single()
  if (error) results.push({ test: '3. Convert to Job', status: 'FAIL', reason: error.message })
  else {
    testJobId = data.id
    await supabase.from('estimates').update({ status: 'Approved' }).eq('id', testEstimateId)
    results.push({ test: '3. Convert to Job', status: 'PASS' })
  }
}

// 4. Insert Change Order
if (testJobId) {
  const { data, error } = await supabase.from('change_orders').insert({
    job_id: testJobId, date: '2026-05-05', description: 'Extended patio',
    reason: 'Area increase', qty: 100, unit: 'sq ft', unit_price: 14, total: 1400, status: 'Approved',
  }).select().single()
  if (error) results.push({ test: '4. Insert Change Order', status: 'FAIL', reason: error.message })
  else { testCOId = data.id; results.push({ test: '4. Insert Change Order', status: 'PASS' }) }
}

// 5. Generate Invoice
if (testClientId && testJobId) {
  const lines = [
    { description: 'Paver install', qty: 500, unit: 'sq ft', unit_price: 12.50 },
    { description: 'CO #1 — Extended patio', qty: 100, unit: 'sq ft', unit_price: 14, is_change_order: true },
  ]
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0)

  const { data, error } = await supabase.from('invoices').insert({
    number: 'E2E-0101-999', client_id: testClientId, job_id: testJobId,
    estimate_id: testEstimateId, status: 'Unpaid', line_items: lines,
    subtotal, total: subtotal, notes: 'E2E test invoice', due_date: '2026-06-01',
  }).select().single()
  if (error) results.push({ test: '5. Generate Invoice', status: 'FAIL', reason: error.message })
  else {
    testInvoiceId = data.id
    const pass = data.total === 7650
    results.push({ test: '5. Generate Invoice', status: pass ? 'PASS' : 'FAIL', expected: 7650, actual: data.total })
  }
}

// 6. Mark Invoice Paid
if (testInvoiceId) {
  const { error } = await supabase.from('invoices').update({ status: 'Paid' }).eq('id', testInvoiceId)
  if (error) results.push({ test: '6. Mark Invoice Paid', status: 'FAIL', reason: error.message })
  else {
    const { data: inv } = await supabase.from('invoices').select('status').eq('id', testInvoiceId).single()
    results.push({ test: '6. Mark Invoice Paid', status: inv?.status === 'Paid' ? 'PASS' : 'FAIL' })
  }
}

// Print results
console.log('=== E2E TEST RESULTS ===\n')
let allPass = true
for (const r of results) {
  const icon = r.status === 'PASS' ? '✅' : '❌'
  if (r.status !== 'PASS') allPass = false
  console.log(`${icon} ${r.test}: ${r.status}${r.reason ? ` — ${r.reason}` : ''}`)
}
console.log(`\n${allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`)

// Cleanup
console.log('--- Cleanup ---')
if (testInvoiceId) { const { error } = await supabase.from('invoices').delete().eq('id', testInvoiceId); console.log(error ? `❌ invoice: ${error.message}` : '✅ invoice') }
if (testCOId) { const { error } = await supabase.from('change_orders').delete().eq('id', testCOId); console.log(error ? `❌ change_order: ${error.message}` : '✅ change_order') }
if (testJobId) { const { error } = await supabase.from('jobs').delete().eq('id', testJobId); console.log(error ? `❌ job: ${error.message}` : '✅ job') }
if (testEstimateId) { const { error } = await supabase.from('estimates').delete().eq('id', testEstimateId); console.log(error ? `❌ estimate: ${error.message}` : '✅ estimate') }
if (testClientId) { const { error } = await supabase.from('clients').delete().eq('id', testClientId); console.log(error ? `❌ client: ${error.message}` : '✅ client') }
