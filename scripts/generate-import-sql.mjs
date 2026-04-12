/**
 * Generate SQL for historical invoice import.
 * Outputs SQL statements to stdout — pipe to a file or execute via Supabase MCP.
 */
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')
import { createClient } from '@supabase/supabase-js'

const INVOICE_DIR = '/Users/oscarrocha/Desktop/Oscar/Sparkle Solutions/Operações/INVOICES'
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

// ─── All helper functions from import-invoices.mjs ───
function parseUSAmount(s) { const c = s.replace(/[$,\s]/g, ''); const n = parseFloat(c); return isNaN(n) ? null : n }
function parseBRAmount(s) { const c = s.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.'); const n = parseFloat(c); return isNaN(n) ? null : n }
function parseAmount(s) { if (!s) return null; if (/,\d{2}$/.test(s.replace(/\s/g, ''))) return parseBRAmount(s); return parseUSAmount(s) }
function parseIssueDate(text) { const m = text.match(/Issue\s*Date:\s*(\w+\.?\s+\d{1,2},?\s+\d{4})/i); if (!m) return null; const d = new Date(m[1]); return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0] }
function parseInvoiceNumber(text) { const m = text.match(/Invoice\s*:\s*(\S+)/i); return m ? m[1].trim() : null }
function deriveInvoiceFromFilename(f) { const m = f.match(/^(\d{8}-\d+)/); if (m) return m[1]; const m2 = f.match(/^(\d{9}-\d+)/); return m2 ? m2[1] : null }
function fixInvoiceNumber(num) { if (!num) return num; const m = num.match(/^(\d{4})(\d{2})(\d{2})(.*)/); if (m) { const [,y,mo,d,r] = m; if (parseInt(mo)>12 && parseInt(d)<=12) return `${y}${d}${mo}${r}` } return num }
function cleanClientName(name) { if (!name) return null; return name.replace(/\s*Invoice\s*:\s*\S+/gi,'').replace(/\s*Address\s*job\s*:.*/gi,'').replace(/\s+/g,' ').trim() || null }
function parseClientName(text) {
  const lines = text.split('\n'); let found = false
  for (const line of lines) {
    if (/bill\s*to/i.test(line)) { found = true; const s = line.replace(/bill\s*to:\s*/i,'').replace(/issue\s*date.*/i,'').trim(); if (s.length > 2) return cleanClientName(s); continue }
    if (found) { const l = line.trim(); if (!l || /^issue\s*date/i.test(l) || /^invoice/i.test(l)) continue; if (/^\d+\s/.test(l) && /\b(st|rd|ave|dr|ct|blvd|ln|way)\b/i.test(l)) continue; if (l.length > 2) return cleanClientName(l) }
  }
  return null
}
function parseJobSiteAddress(text) { const m = text.match(/Address\s*job:\s*(.+)/i); return m ? m[1].trim() : null }
function parseTotal(text) { const it = text.match(/INVOICE\s*TOTAL\s*\n?\s*\$?\s*([\d,.$]+)/i); if (it) return parseAmount(it[1]); const all = [...text.matchAll(/TOTAL\s+\$?\s*([\d,.$]+)/gi)]; if (all.length > 0) return parseAmount(all[all.length-1][1]); return null }
function parseEmail(text) { const m = text.match(/Email:\s*(\S+@\S+)/i); return m ? m[1].trim() : null }
function parsePhone(text) { const m = text.match(/Phone:\s*([\d\s\-()]+)/i); return m ? m[1].trim().replace(/\s+/g,'-') : null }
function parseDeposit(text) { const m = text.match(/Down:\s*-?\$?([\d,.$]+)/i); if (m) return parseAmount(m[1]); const m2 = text.match(/Deposit:\s*-?\$?([\d,.$]+)/i); if (m2) return parseAmount(m2[1]); return 0 }

function normalizeForMatch(name) { return (name||'').toLowerCase().replace(/[.,!?;:'"()]/g,'').replace(/\b(llc|inc|incorporated|corp|corporation)\b/gi,'').replace(/\s+/g,' ').trim() }

const CLIENT_OVERRIDES = {
  'water lily pool & spa inc': null,
  'water lily pool & spa, inc.': null,
  'water lily pool & spa, inc': null,
  'villagewalk': 'villagewalk of sarasota',
  'village walk': 'villagewalk of sarasota',
  'esplanade on palmer ranch': 'esplanade palmer ranch',
  'blue signet pool': 'signet poll / a&d pool',
  'patrick': 'patrick gallagher',
  'sunscape pools': '__NEW:Sunscape Pools & Outdoor Design',
  'sunscape pools& outdoor design': '__NEW:Sunscape Pools & Outdoor Design',
  'sunscape pools & outdoor design': '__NEW:Sunscape Pools & Outdoor Design',
}

function levenshtein(a,b){const m=a.length,n=b.length,dp=Array.from({length:m+1},()=>new Array(n+1).fill(0));for(let i=0;i<=m;i++)dp[i][0]=i;for(let j=0;j<=n;j++)dp[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);return dp[m][n]}
function similarity(a,b){const na=normalizeForMatch(a),nb=normalizeForMatch(b);if(na===nb)return 1.0;const ml=Math.max(na.length,nb.length);return ml===0?1.0:1-levenshtein(na,nb)/ml}

function findBestClientMatch(invoiceClientName, existingClients) {
  const normalized = normalizeForMatch(invoiceClientName)
  const lowerName = (invoiceClientName||'').toLowerCase().trim()
  for (const [ok,ot] of Object.entries(CLIENT_OVERRIDES)) {
    if (lowerName === ok || lowerName.startsWith(ok)) {
      if (ot && ot.startsWith('__NEW:')) return { match: null, score: 1.0, type: 'new', canonicalName: ot.slice(6) }
      const tn = ot ? normalizeForMatch(ot) : normalized
      for (const c of existingClients) { if (normalizeForMatch(c.name) === tn) return { match: c, score: 1.0, type: 'override' } }
    }
  }
  let best = null, bestScore = 0
  for (const c of existingClients) { if (normalizeForMatch(c.name) === normalized) return { match: c, score: 1.0, type: 'exact' }; const s = similarity(invoiceClientName, c.name); if (s > bestScore) { bestScore = s; best = c } }
  if (bestScore >= 0.80) return { match: best, score: bestScore, type: 'fuzzy' }
  return { match: null, score: bestScore, type: 'new' }
}

function esc(s) { return (s||'').replace(/'/g, "''") }

async function main() {
  const { data: existingClients } = await supabase.from('clients').select('id, name, email, phone, address').order('name')

  const allFiles = fs.readdirSync(INVOICE_DIR)
  const pdfFiles = allFiles.filter(f=>f.endsWith('.pdf')).filter(f=>!f.includes('_compressed')).filter(f=>!f.startsWith('pictures')).filter(f=>!f.includes('letter')).filter(f=>!f.includes('Proposal')).filter(f=>/^\d{6,}/.test(f)).sort()

  const results = []
  for (const filename of pdfFiles) {
    try {
      const buf = fs.readFileSync(path.join(INVOICE_DIR, filename))
      const pdf = await pdfParse(buf)
      const text = pdf.text
      const docNum = parseInvoiceNumber(text)
      const fileNum = deriveInvoiceFromFilename(filename)
      let invoiceNum = fixInvoiceNumber(docNum || fileNum || `LEGACY-${filename.replace('.pdf','')}`)
      let date = parseIssueDate(text)
      let clientName = parseClientName(text)
      const jobSite = parseJobSiteAddress(text)
      let total = parseTotal(text)
      const email = parseEmail(text)
      const phone = parsePhone(text)
      const deposit = parseDeposit(text)

      // Overrides
      if (invoiceNum === '20230321-5533' || filename.includes('20230321-5533')) { if (!total) total = 18423.00 }
      if (total !== null && total < 50) continue // skip $10.62
      if (clientName === 'BECKY') clientName = 'Becky'
      if (!clientName || clientName === '???') {
        if (/patrick/i.test(filename)) clientName = 'Patrick'
        else if (/escape/i.test(filename)) clientName = 'Escape Pool'
      }
      if (clientName && /^address\s*job/i.test(clientName)) { clientName = /escape/i.test(filename) ? 'Escape Pool' : null }
      if (!date) { const dm = filename.match(/^(\d{4})(\d{2})(\d{2})/); if (dm) { let [,y,m,d] = dm; if (parseInt(m)>12&&parseInt(d)<=12)[m,d]=[d,m]; date = `${y}-${m}-${d}` } }

      const matchResult = clientName ? findBestClientMatch(clientName, existingClients||[]) : { match: null, score: 0, type: 'unknown' }
      results.push({ filename, invoiceNum, date, clientName: clientName||'???', jobSite, total, deposit, email, phone, matchResult })
    } catch(e) { console.error(`-- ERROR parsing ${filename}: ${e.message}`) }
  }

  // Collect unique new clients
  const newClients = new Map()
  for (const r of results) {
    if (r.matchResult.type === 'new') {
      const name = r.matchResult.canonicalName || r.clientName
      const key = normalizeForMatch(name)
      if (!newClients.has(key)) {
        let addr = r.matchResult.canonicalName ? '' : (r.jobSite || '')
        newClients.set(key, { name, email: r.email, phone: r.phone ? r.phone.replace(/--+/g,'-') : null, address: addr })
      }
    }
  }

  // Output SQL
  const sql = []
  sql.push('-- ═══════════════════════════════════════════════════════')
  sql.push('-- Sparkle Ops — Historical Invoice Import')
  sql.push(`-- Generated: ${new Date().toISOString()}`)
  sql.push(`-- Invoices: ${results.length} | New clients: ${newClients.size}`)
  sql.push('-- ═══════════════════════════════════════════════════════')
  sql.push('')

  // Create new clients
  if (newClients.size > 0) {
    sql.push('-- Step 1: Create new clients')
    for (const [key, c] of newClients) {
      sql.push(`INSERT INTO clients (name, email, phone) VALUES ('${esc(c.name)}', ${c.email ? `'${esc(c.email)}'` : 'NULL'}, ${c.phone ? `'${esc(c.phone)}'` : 'NULL'}) ON CONFLICT DO NOTHING;`)
    }
    sql.push('')
  }

  // Insert invoices
  sql.push('-- Step 2: Insert invoices')
  for (const r of results) {
    const m = r.matchResult
    let clientRef
    if ((m.type === 'exact' || m.type === 'override' || m.type === 'fuzzy') && m.match) {
      clientRef = `'${m.match.id}'`
    } else if (m.type === 'new') {
      const name = m.canonicalName || r.clientName
      clientRef = `(SELECT id FROM clients WHERE name = '${esc(name)}' LIMIT 1)`
    } else {
      sql.push(`-- SKIPPED ${r.invoiceNum}: no client match for "${r.clientName}"`)
      continue
    }

    const total = r.total || 0
    const lineItems = JSON.stringify([{ description: 'Historical invoice', qty: 1, unit: 'job', unit_price: total }])
    const notes = `Imported from legacy archive: ${r.filename}`

    sql.push(`INSERT INTO invoices (number, client_id, status, due_date, site_address, line_items, subtotal, total, deposit_received, balance_due, notes) VALUES ('${esc(r.invoiceNum)}', ${clientRef}, 'Paid', ${r.date ? `'${r.date}'` : 'NULL'}, ${r.jobSite ? `'${esc(r.jobSite)}'` : 'NULL'}, '${esc(lineItems)}'::jsonb, ${total}, ${total}, ${r.deposit || 0}, 0, '${esc(notes)}') ON CONFLICT DO NOTHING;`)
  }

  // Output
  console.log(sql.join('\n'))
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
