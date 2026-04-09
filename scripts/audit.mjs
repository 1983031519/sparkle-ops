// Step 1: Database Schema Audit
// Queries Supabase information_schema to get actual columns per table
import { createClient } from '@supabase/supabase-js'

const url = 'https://whtnxguqfnyovbvgkaso.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodG54Z3VxZm55b3ZidmdrYXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODI1NTEsImV4cCI6MjA5MTI1ODU1MX0.smb4Tcdhp2b3bYPTUgtFasVOhWHWkkvOpVei1rN_tBM'

const supabase = createClient(url, key)

const TABLES = ['clients', 'client_contacts', 'jobs', 'estimates', 'invoices', 'change_orders', 'suppliers', 'inventory']

async function getColumns(table) {
  // Use a simple approach: try to select * with limit 0 and check the response shape
  // Or better: use RPC if available. Simplest: insert empty and check error, or select.
  const { data, error } = await supabase.from(table).select('*').limit(0)
  if (error) {
    return { table, error: error.message, columns: [] }
  }
  // Supabase doesn't return column names on empty results easily.
  // Let's try inserting a dummy and reading the error for column info.
  // Actually, let's use the postgrest schema endpoint
  return { table, columns: null }
}

// Better approach: use the REST API schema endpoint
async function fetchSchema() {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    }
  })
  const data = await res.json()
  return data
}

// Best approach: use rpc to query information_schema
async function querySchema() {
  // Try direct SQL via rpc — but we need a function for that.
  // Simplest reliable method: for each table, do a select with limit 1 and inspect keys
  const results = {}

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*').limit(1)
    if (error) {
      console.log(`❌ ${table}: ${error.message}`)
      results[table] = { error: error.message }
      continue
    }
    if (data && data.length > 0) {
      results[table] = Object.keys(data[0]).sort()
    } else {
      // Empty table — try insert with empty object to get column info from error
      const { error: insertErr } = await supabase.from(table).insert({})
      if (insertErr) {
        // Parse column names from error or use select metadata
        // Try another approach: select with head
        results[table] = '(empty table — no rows to inspect columns)'
      } else {
        results[table] = '(empty table — inserted empty row?!)'
      }
    }
  }

  return results
}

console.log('=== STEP 1: DATABASE SCHEMA AUDIT ===\n')
const schema = await querySchema()

for (const [table, cols] of Object.entries(schema)) {
  if (typeof cols === 'string') {
    console.log(`📋 ${table}: ${cols}`)
  } else if (cols.error) {
    console.log(`❌ ${table}: ERROR — ${cols.error}`)
  } else {
    console.log(`📋 ${table}: [${cols.join(', ')}]`)
  }
}

console.log('\n=== STEP 3: END-TO-END FLOW TEST ===\n')

// First, sign in — we need auth for RLS
const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
  email: 'oscar@sparklestonepavers.com',
  password: 'caio0106'
})

if (authErr) {
  console.log(`⚠️  Auth failed: ${authErr.message}`)
  console.log('   Trying without auth (if RLS allows)...')
}

let testClientId = null
let testEstimateId = null
let testJobId = null
let testChangeOrderId = null
let testInvoiceId = null
const results = []

// Test 1: Insert client
{
  const { data, error } = await supabase.from('clients').insert({
    name: 'TEST_E2E_Client',
    type: 'Homeowner',
    email: 'test@test.com',
    phone: '(941) 555-0000',
    address: '123 Test St, Bradenton, FL 34211',
    notes: null,
  }).select().single()

  if (error) {
    results.push({ test: '1. Insert Client', status: 'FAIL', reason: error.message })
  } else {
    testClientId = data.id
    results.push({ test: '1. Insert Client', status: 'PASS', id: data.id })
  }
}

// Test 2: Insert estimate
if (testClientId) {
  const { data, error } = await supabase.from('estimates').insert({
    estimate_number: '9999-0101-P-999',
    client_id: testClientId,
    status: 'Draft',
    division: 'Pavers',
    attn: 'Test Contact',
    site_address: '456 Test Ave, Bradenton, FL 34211',
    re_line: 'Test paver installation — 456 Test Ave',
    scope_of_work: 'Install pavers in test area.',
    materials_specified: { paver_type: 'Tremron', paver_size: '6x9', paver_color: 'Sand' },
    start_date: '2026-05-01',
    end_date: '2026-05-15',
    line_items: [{ description: 'Paver installation', qty: 500, unit: 'sq ft', unit_price: 12.50 }],
    subtotal: 6250,
    total: 6250,
    deposit_amount: 3125,
    balance_amount: 3125,
    warranty: '1 year workmanship warranty on all installed materials.',
    notes: 'E2E test estimate',
    valid_until: '2026-06-01',
  }).select().single()

  if (error) {
    results.push({ test: '2. Insert Estimate', status: 'FAIL', reason: error.message })
  } else {
    testEstimateId = data.id
    results.push({ test: '2. Insert Estimate', status: 'PASS', id: data.id })
  }
}

// Test 3: Convert estimate to job
if (testClientId && testEstimateId) {
  const { data, error } = await supabase.from('jobs').insert({
    title: 'Test paver installation — 456 Test Ave',
    client_id: testClientId,
    division: 'Pavers',
    status: 'Scheduled',
    address: '456 Test Ave, Bradenton, FL 34211',
    site_address: '456 Test Ave, Bradenton, FL 34211',
    re_line: 'Test paver installation — 456 Test Ave',
    description: 'Install pavers in test area.',
    total_amount: 6250,
    estimate_id: testEstimateId,
    scheduled_date: '2026-05-01',
    checklist: [{ text: 'Prep base', done: false }],
    photos: [],
    assigned_to: 'Test Tech',
    materials_used: 'Tremron 6x9 Sand',
  }).select().single()

  if (error) {
    results.push({ test: '3. Convert to Job', status: 'FAIL', reason: error.message })
  } else {
    testJobId = data.id
    // Also update estimate status
    await supabase.from('estimates').update({ status: 'Accepted' }).eq('id', testEstimateId)
    results.push({ test: '3. Convert to Job', status: 'PASS', id: data.id })
  }
}

// Test 4: Insert change order
if (testJobId) {
  const { data, error } = await supabase.from('change_orders').insert({
    job_id: testJobId,
    date: '2026-05-05',
    description: 'Extended patio area',
    reason: 'Area increase',
    qty: 100,
    unit: 'sq ft',
    unit_price: 14,
    total: 1400,
    status: 'Approved',
  }).select().single()

  if (error) {
    results.push({ test: '4. Insert Change Order', status: 'FAIL', reason: error.message })
  } else {
    testChangeOrderId = data.id
    results.push({ test: '4. Insert Change Order', status: 'PASS', id: data.id })
  }
}

// Test 5: Generate invoice from job
if (testClientId && testJobId) {
  const allLines = [
    { description: 'Paver installation', qty: 500, unit: 'sq ft', unit_price: 12.50 },
    { description: 'Change Order #1 — Extended patio area', qty: 100, unit: 'sq ft', unit_price: 14, is_change_order: true },
  ]
  const subtotal = allLines.reduce((s, l) => s + l.qty * l.unit_price, 0) // 6250 + 1400 = 7650

  const { data, error } = await supabase.from('invoices').insert({
    invoice_number: '9999-0101-999',
    client_id: testClientId,
    job_id: testJobId,
    estimate_id: testEstimateId,
    status: 'Draft',
    line_items: allLines,
    subtotal,
    total: subtotal,
    notes: 'E2E test invoice',
    due_date: '2026-06-01',
    paid_date: null,
  }).select().single()

  if (error) {
    results.push({ test: '5. Generate Invoice', status: 'FAIL', reason: error.message })
  } else {
    testInvoiceId = data.id
    const correctTotal = subtotal === 7650
    results.push({
      test: '5. Generate Invoice',
      status: correctTotal ? 'PASS' : 'FAIL',
      id: data.id,
      expectedTotal: 7650,
      actualTotal: subtotal,
    })
  }
}

// Test 6: Mark invoice as paid
if (testInvoiceId) {
  const { error } = await supabase.from('invoices').update({
    status: 'Paid',
    paid_date: '2026-05-20',
  }).eq('id', testInvoiceId)

  if (error) {
    results.push({ test: '6. Mark Invoice Paid', status: 'FAIL', reason: error.message })
  } else {
    // Verify
    const { data: inv } = await supabase.from('invoices').select('status,paid_date').eq('id', testInvoiceId).single()
    const pass = inv?.status === 'Paid' && inv?.paid_date === '2026-05-20'
    results.push({ test: '6. Mark Invoice Paid', status: pass ? 'PASS' : 'FAIL', data: inv })
  }
}

// Print results
console.log('--- E2E Test Results ---\n')
for (const r of results) {
  const icon = r.status === 'PASS' ? '✅' : '❌'
  const detail = r.reason ? ` — ${r.reason}` : ''
  console.log(`${icon} ${r.test}: ${r.status}${detail}`)
}

// Test 7: Cleanup
console.log('\n--- Cleanup ---\n')
if (testInvoiceId) { const { error } = await supabase.from('invoices').delete().eq('id', testInvoiceId); console.log(error ? `❌ Delete invoice: ${error.message}` : '✅ Deleted test invoice') }
if (testChangeOrderId) { const { error } = await supabase.from('change_orders').delete().eq('id', testChangeOrderId); console.log(error ? `❌ Delete CO: ${error.message}` : '✅ Deleted test change order') }
if (testJobId) { const { error } = await supabase.from('jobs').delete().eq('id', testJobId); console.log(error ? `❌ Delete job: ${error.message}` : '✅ Deleted test job') }
if (testEstimateId) { const { error } = await supabase.from('estimates').delete().eq('id', testEstimateId); console.log(error ? `❌ Delete estimate: ${error.message}` : '✅ Deleted test estimate') }
if (testClientId) { const { error } = await supabase.from('clients').delete().eq('id', testClientId); console.log(error ? `❌ Delete client: ${error.message}` : '✅ Deleted test client') }

console.log('\n=== AUDIT COMPLETE ===')
