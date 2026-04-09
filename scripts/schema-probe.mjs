// Probe actual Supabase column names by inserting a row into each table,
// reading it back, then deleting it.
import { createClient } from '@supabase/supabase-js'

const url = 'https://whtnxguqfnyovbvgkaso.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodG54Z3VxZm55b3ZidmdrYXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODI1NTEsImV4cCI6MjA5MTI1ODU1MX0.smb4Tcdhp2b3bYPTUgtFasVOhWHWkkvOpVei1rN_tBM'
const supabase = createClient(url, key)

await supabase.auth.signInWithPassword({ email: 'oscar@sparklestonepavers.com', password: 'caio0106' })

// For each table, insert minimal row, read back all columns, then delete
const probes = [
  { table: 'clients', insert: { name: 'PROBE', type: 'Homeowner' } },
  { table: 'client_contacts', insert: null }, // needs client_id, do after clients
  { table: 'suppliers', insert: { name: 'PROBE' } },
  { table: 'inventory', insert: { name: 'PROBE', category: 'Bricks', unit: 'pcs' } },
  { table: 'estimates', insert: null }, // complex, probe separately
  { table: 'jobs', insert: null },
  { table: 'invoices', insert: null },
  { table: 'change_orders', insert: null },
]

const schema = {}

// 1. clients
{
  const { data, error } = await supabase.from('clients').insert({ name: 'PROBE_SCHEMA', type: 'Homeowner' }).select().single()
  if (error) { console.log('clients INSERT error:', error.message) }
  else {
    schema.clients = Object.keys(data).sort()
    await supabase.from('clients').delete().eq('id', data.id)
  }
}

// 2. suppliers
{
  const { data, error } = await supabase.from('suppliers').insert({ name: 'PROBE_SCHEMA' }).select().single()
  if (error) { console.log('suppliers INSERT error:', error.message) }
  else {
    schema.suppliers = Object.keys(data).sort()
    await supabase.from('suppliers').delete().eq('id', data.id)
  }
}

// 3. inventory
{
  const { data, error } = await supabase.from('inventory').insert({ name: 'PROBE_SCHEMA', category: 'Bricks', unit: 'pcs' }).select().single()
  if (error) { console.log('inventory INSERT error:', error.message) }
  else {
    schema.inventory = Object.keys(data).sort()
    await supabase.from('inventory').delete().eq('id', data.id)
  }
}

// 4. estimates — try with just required columns. We know 'number' is a column.
{
  // First try with minimal data to discover columns
  const { data, error } = await supabase.from('estimates').insert({ number: 'PROBE-001' }).select().single()
  if (error) { console.log('estimates INSERT error:', error.message) }
  else {
    schema.estimates = Object.keys(data).sort()
    await supabase.from('estimates').delete().eq('id', data.id)
  }
}

// 5. Create a client + estimate for FK tests
let probeClientId = null
let probeEstimateId = null
{
  const { data: c } = await supabase.from('clients').insert({ name: 'PROBE_FK', type: 'Homeowner' }).select().single()
  probeClientId = c?.id
}

// 6. jobs
if (probeClientId) {
  const { data, error } = await supabase.from('jobs').insert({ title: 'PROBE_SCHEMA', client_id: probeClientId, division: 'Pavers', status: 'Lead', total_amount: 0 }).select().single()
  if (error) { console.log('jobs INSERT error:', error.message) }
  else {
    schema.jobs = Object.keys(data).sort()
    // Use this job for change_orders
    const jobId = data.id

    // 7. change_orders
    const { data: co, error: coErr } = await supabase.from('change_orders').insert({ job_id: jobId, description: 'PROBE' }).select().single()
    if (coErr) { console.log('change_orders INSERT error:', coErr.message) }
    else {
      schema.change_orders = Object.keys(co).sort()
      await supabase.from('change_orders').delete().eq('id', co.id)
    }

    await supabase.from('jobs').delete().eq('id', jobId)
  }
}

// 8. invoices
if (probeClientId) {
  const { data, error } = await supabase.from('invoices').insert({ number: 'PROBE-INV-001', client_id: probeClientId }).select().single()
  if (error) {
    // Maybe column is invoice_number?
    console.log('invoices INSERT with "number" error:', error.message)
    const { data: d2, error: e2 } = await supabase.from('invoices').insert({ invoice_number: 'PROBE-INV-001', client_id: probeClientId }).select().single()
    if (e2) { console.log('invoices INSERT with "invoice_number" error:', e2.message) }
    else {
      schema.invoices = Object.keys(d2).sort()
      await supabase.from('invoices').delete().eq('id', d2.id)
    }
  } else {
    schema.invoices = Object.keys(data).sort()
    await supabase.from('invoices').delete().eq('id', data.id)
  }
}

// 9. client_contacts
if (probeClientId) {
  const { data, error } = await supabase.from('client_contacts').insert({ client_id: probeClientId, name: 'PROBE' }).select().single()
  if (error) { console.log('client_contacts INSERT error:', error.message) }
  else {
    schema.client_contacts = Object.keys(data).sort()
    await supabase.from('client_contacts').delete().eq('id', data.id)
  }
}

// Cleanup FK probe client
if (probeClientId) await supabase.from('clients').delete().eq('id', probeClientId)

// Print results
console.log('\n=== ACTUAL SUPABASE SCHEMA ===\n')
for (const [table, cols] of Object.entries(schema)) {
  console.log(`${table}:`)
  if (Array.isArray(cols)) {
    cols.forEach(c => console.log(`  - ${c}`))
  } else {
    console.log(`  ${cols}`)
  }
  console.log()
}
