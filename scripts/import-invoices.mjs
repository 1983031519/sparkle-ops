/**
 * Historical Invoice Import — Dry Run
 *
 * Reads all PDFs from the legacy invoice folder, extracts structured data,
 * matches clients against Supabase, and produces a preview report.
 *
 * Usage: node scripts/import-invoices.mjs [--import]
 *   Without --import: dry run only (default)
 *   With --import: actually insert into Supabase
 */

import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')
import { createClient } from '@supabase/supabase-js'

// ─── Config ───
const INVOICE_DIR = '/Users/oscarrocha/Desktop/Oscar/Sparkle Solutions/Operações/INVOICES'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Try .env file
  const envPath = path.join(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    for (const line of envContent.split('\n')) {
      const match = line.match(/^(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)\s*=\s*(.+)/)
      if (match) process.env[match[1]] = match[2].trim()
    }
  }
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

// ─── Helpers ───

/** Parse US format: $1,234.56 or $1234.56 */
function parseUSAmount(s) {
  const cleaned = s.replace(/[$,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/** Parse Brazilian format: $ 1.234,56 → 1234.56 */
function parseBRAmount(s) {
  const cleaned = s.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/** Try both number formats */
function parseAmount(s) {
  if (!s) return null
  // If it contains a comma followed by exactly 2 digits at end → Brazilian
  if (/,\d{2}$/.test(s.replace(/\s/g, ''))) {
    return parseBRAmount(s)
  }
  return parseUSAmount(s)
}

/** Extract date from "Issue Date: Dec 30, 2022" or similar */
function parseIssueDate(text) {
  const match = text.match(/Issue\s*Date:\s*(\w+\.?\s+\d{1,2},?\s+\d{4})/i)
  if (!match) return null
  const d = new Date(match[1])
  if (isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0]
}

/** Extract invoice number from "Invoice:20221230-5005" or "Invoice: 20221222-8109" */
function parseInvoiceNumber(text) {
  const match = text.match(/Invoice\s*:\s*(\S+)/i)
  if (match) return match[1].trim()
  return null
}

/** Derive invoice number from filename: "20221230-5005 Water Lily - SPK.pdf" → "20221230-5005" */
function deriveInvoiceFromFilename(filename) {
  const match = filename.match(/^(\d{8}-\d+)/)
  if (match) return match[1]
  // Also handle "220240514-..." typo pattern
  const match2 = filename.match(/^(\d{9}-\d+)/)
  if (match2) return match2[1]
  return null
}

/** Fix known date typos in invoice numbers: 20221612 → 20221216 */
function fixInvoiceNumber(num) {
  if (!num) return num
  // Check if the date portion has month > 12 (swapped month/day)
  const dateMatch = num.match(/^(\d{4})(\d{2})(\d{2})(.*)/)
  if (dateMatch) {
    const [, year, monthOrDay, dayOrMonth, rest] = dateMatch
    const m = parseInt(monthOrDay)
    const d = parseInt(dayOrMonth)
    if (m > 12 && d <= 12) {
      // Swap month and day
      const fixed = `${year}${dayOrMonth}${monthOrDay}${rest}`
      return fixed
    }
  }
  return num
}

/** Strip "Invoice:XXXXX" and trailing whitespace/junk from a client name */
function cleanClientName(name) {
  if (!name) return null
  return name
    .replace(/\s*Invoice\s*:\s*\S+/gi, '')   // remove "Invoice:20221230-5005"
    .replace(/\s*Address\s*job\s*:.*/gi, '')  // remove "Address job: ..."
    .replace(/\s+/g, ' ')
    .trim() || null
}

/** Extract client name from "Bill to:" section */
function parseClientName(text) {
  // Find "Bill to:" and get the next non-empty line
  const billToMatch = text.match(/Bill\s*to:\s*(?:Issue\s*Date[^\n]*\n)?(.+)/i)
  if (!billToMatch) return null

  // The text after "Bill to:" on same or next line, before "Issue Date" or address patterns
  const lines = text.split('\n')
  let foundBillTo = false
  for (let i = 0; i < lines.length; i++) {
    if (/bill\s*to/i.test(lines[i])) {
      foundBillTo = true
      // Check if name is on this line (after "Bill to:")
      const sameLine = lines[i].replace(/bill\s*to:\s*/i, '').replace(/issue\s*date.*/i, '').trim()
      if (sameLine && sameLine.length > 2) return cleanClientName(sameLine)
      continue
    }
    if (foundBillTo) {
      const line = lines[i].trim()
      // Skip empty lines and lines that look like dates or "Invoice:"
      if (!line || /^issue\s*date/i.test(line) || /^invoice/i.test(line)) continue
      // Skip address-like lines
      if (/^\d+\s/.test(line) && /\b(st|rd|ave|dr|ct|blvd|ln|way)\b/i.test(line)) continue
      if (line.length > 2) return cleanClientName(line)
    }
  }
  return null
}

/** Extract client address (lines between client name and email/phone/next section) */
function parseClientAddress(text) {
  const lines = text.split('\n')
  let foundBillTo = false
  let foundName = false
  const addressLines = []

  for (let i = 0; i < lines.length; i++) {
    if (/bill\s*to/i.test(lines[i])) {
      foundBillTo = true
      continue
    }
    if (foundBillTo && !foundName) {
      const line = lines[i].trim()
      if (!line || /^issue\s*date/i.test(line) || /^invoice/i.test(line)) continue
      // This should be the client name — skip it
      foundName = true
      continue
    }
    if (foundName) {
      const line = lines[i].trim()
      if (!line) continue
      // Stop at email, phone, "INVOICE TOTAL", "Address job", or separator
      if (/^email/i.test(line) || /^phone/i.test(line) || /invoice\s*total/i.test(line)
          || /^address\s*job/i.test(line) || /^_{3,}/.test(line) || /^contact/i.test(line)) break
      // Skip "United States"
      if (/^united\s*states$/i.test(line)) continue
      addressLines.push(line)
    }
  }
  return addressLines.join(', ').replace(/,\s*,/g, ',').replace(/,\s*$/, '') || null
}

/** Extract job site address from "Address job:" or "Address Job:" */
function parseJobSiteAddress(text) {
  const match = text.match(/Address\s*job:\s*(.+)/i)
  if (match) return match[1].trim()
  return null
}

/** Extract total amount — look for the last/largest TOTAL */
function parseTotal(text) {
  // Find "INVOICE TOTAL" followed by amount
  const invoiceTotal = text.match(/INVOICE\s*TOTAL\s*\n?\s*\$?\s*([\d,.$]+)/i)
  if (invoiceTotal) return parseAmount(invoiceTotal[1])

  // Find "TOTAL" followed by amount
  const allTotals = [...text.matchAll(/TOTAL\s+\$?\s*([\d,.$]+)/gi)]
  if (allTotals.length > 0) {
    // Pick the last one (usually the grand total)
    const last = allTotals[allTotals.length - 1]
    return parseAmount(last[1])
  }

  return null
}

/** Extract email */
function parseEmail(text) {
  const match = text.match(/Email:\s*(\S+@\S+)/i)
  if (match) return match[1].trim()
  return null
}

/** Extract phone */
function parsePhone(text) {
  const match = text.match(/Phone:\s*([\d\s\-()]+)/i)
  if (match) return match[1].trim().replace(/\s+/g, '-')
  return null
}

/** Extract deposit/down payment */
function parseDeposit(text) {
  const match = text.match(/Down:\s*-?\$?([\d,.$]+)/i)
  if (match) return parseAmount(match[1])
  const match2 = text.match(/Deposit:\s*-?\$?([\d,.$]+)/i)
  if (match2) return parseAmount(match2[1])
  return 0
}

// ─── Client Matching ───

// Hardcoded overrides: invoice client name → normalized key that maps to a DB client
const CLIENT_OVERRIDES = {
  'water lily pool & spa inc': null,      // will match via normalizeForMatch
  'water lily pool & spa, inc.': null,    // same
  'water lily pool & spa, inc': null,     // same without trailing dot
  'villagewalk': 'villagewalk of sarasota',
  'village walk': 'villagewalk of sarasota',
  'esplanade on palmer ranch': 'esplanade palmer ranch',
  'blue signet pool': 'signet poll / a&d pool',
  'patrick': 'patrick gallagher',
  'sunscape pools': '__NEW:Sunscape Pools & Outdoor Design',
  'sunscape pools& outdoor design': '__NEW:Sunscape Pools & Outdoor Design',
  'sunscape pools & outdoor design': '__NEW:Sunscape Pools & Outdoor Design',
}

function normalizeForMatch(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, '')    // strip all punctuation
    .replace(/\b(llc|inc|incorporated|corp|corporation)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

function similarity(a, b) {
  const na = normalizeForMatch(a)
  const nb = normalizeForMatch(b)
  if (na === nb) return 1.0
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1.0
  return 1 - levenshtein(na, nb) / maxLen
}

function findBestClientMatch(invoiceClientName, existingClients) {
  const normalized = normalizeForMatch(invoiceClientName)
  const lowerName = (invoiceClientName || '').toLowerCase().trim()

  // 1. Check hardcoded overrides
  for (const [overrideKey, overrideTarget] of Object.entries(CLIENT_OVERRIDES)) {
    if (lowerName === overrideKey || lowerName.startsWith(overrideKey)) {
      // __NEW: prefix means "consolidate under this canonical name" (new client, not in DB)
      if (overrideTarget && overrideTarget.startsWith('__NEW:')) {
        const canonicalName = overrideTarget.slice(6)
        return { match: null, score: 1.0, type: 'new', canonicalName }
      }
      const targetNorm = overrideTarget ? normalizeForMatch(overrideTarget) : normalized
      for (const client of existingClients) {
        if (normalizeForMatch(client.name) === targetNorm) {
          return { match: client, score: 1.0, type: 'override' }
        }
      }
    }
  }

  // 2. Exact normalized match
  let bestMatch = null
  let bestScore = 0

  for (const client of existingClients) {
    if (normalizeForMatch(client.name) === normalized) {
      return { match: client, score: 1.0, type: 'exact' }
    }

    const score = similarity(invoiceClientName, client.name)
    if (score > bestScore) {
      bestScore = score
      bestMatch = client
    }
  }

  // 3. Fuzzy match at 80% (lowered from 85% to catch more near-matches)
  if (bestScore >= 0.80) {
    return { match: bestMatch, score: bestScore, type: 'fuzzy' }
  }

  return { match: null, score: bestScore, type: 'new' }
}

// ─── Main ───

async function main() {
  const doImport = process.argv.includes('--import')

  console.log('\n=== Sparkle Ops — Historical Invoice Import ===')
  console.log(`Mode: ${doImport ? '🔴 LIVE IMPORT' : '🟢 DRY RUN'}\n`)

  // 1. List PDFs, filter out _compressed and non-invoice files
  const allFiles = fs.readdirSync(INVOICE_DIR)
  const pdfFiles = allFiles
    .filter(f => f.endsWith('.pdf'))
    .filter(f => !f.includes('_compressed'))
    .filter(f => !f.startsWith('pictures'))
    .filter(f => !f.includes('letter'))
    .filter(f => !f.includes('Proposal'))
    .filter(f => /^\d{6,}/.test(f)) // Must start with date digits
    .sort()

  console.log(`Found ${pdfFiles.length} PDF invoices to process (${allFiles.length} total files, filtered out compressed/non-invoice)\n`)

  // 2. Fetch existing clients from Supabase
  const { data: existingClients } = await supabase
    .from('clients')
    .select('id, name, email, phone, address')
    .order('name')

  console.log(`Existing clients in Supabase: ${(existingClients || []).length}\n`)

  // 3. Parse each PDF
  const results = []
  const errors = []
  const clientMap = new Map() // normalized name → { name, address, email, phone, matchResult }

  for (const filename of pdfFiles) {
    const filepath = path.join(INVOICE_DIR, filename)
    try {
      const buffer = fs.readFileSync(filepath)
      const pdf = await pdfParse(buffer)
      const text = pdf.text

      // Extract fields
      const docInvoiceNum = parseInvoiceNumber(text)
      const fileInvoiceNum = deriveInvoiceFromFilename(filename)
      let invoiceNum = docInvoiceNum || fileInvoiceNum || `LEGACY-${filename.replace('.pdf', '')}`
      invoiceNum = fixInvoiceNumber(invoiceNum)

      let date = parseIssueDate(text)
      let clientName = parseClientName(text)
      const clientAddress = parseClientAddress(text)
      const jobSite = parseJobSiteAddress(text)
      let total = parseTotal(text)
      const email = parseEmail(text)
      const phone = parsePhone(text)
      const deposit = parseDeposit(text)

      // Post-process client name: fix known issues
      if (clientName && /^address\s*job/i.test(clientName)) {
        // "Address job: ..." was parsed as client name — this invoice has no Bill To
        // Try to derive from the address job line itself or mark unknown
      }
      // Normalize "BECKY" → "Becky"
      if (clientName === 'BECKY') clientName = 'Becky'
      // Derive client name from filename for known patterns
      if (!clientName || clientName === '???') {
        if (/patrick/i.test(filename)) clientName = 'Patrick'
        else if (/escape/i.test(filename)) clientName = 'Escape Pool'
      }
      // Fix "Address job: ..." parsed as client name
      if (clientName && /^address\s*job/i.test(clientName)) {
        if (/escape/i.test(filename)) clientName = 'Escape Pool'
        else clientName = null
      }

      // Manual total overrides
      if (invoiceNum === '20230321-5533' || filename.includes('20230321-5533')) {
        if (!total) total = 18423.00
      }

      // Skip the known bad invoice ($10.62 Sunscape)
      if (total !== null && total < 50) {
        console.log(`  ⏭️  SKIPPED ${filename} — total $${total.toFixed(2)} looks incorrect`)
        continue
      }

      const flags = []
      if (!docInvoiceNum) flags.push('invoice# from filename')
      if (docInvoiceNum !== fixInvoiceNumber(docInvoiceNum)) flags.push('date typo fixed')

      // Fallback: derive date from filename if not parsed from document
      if (!date) {
        const dateMatch = filename.match(/^(\d{4})(\d{2})(\d{2})/)
        if (dateMatch) {
          let [, y, m, d] = dateMatch
          // Fix swapped month/day
          if (parseInt(m) > 12 && parseInt(d) <= 12) [m, d] = [d, m]
          date = `${y}-${m}-${d}`
          flags.push('date from filename')
        } else {
          flags.push('NO DATE')
        }
      }
      if (!clientName) flags.push('NO CLIENT')
      if (!total) flags.push('NO TOTAL')
      if (total && deposit > 0) flags.push(`deposit $${deposit}`)

      // Client matching
      let matchResult = { match: null, score: 0, type: 'unknown' }
      if (clientName) {
        matchResult = findBestClientMatch(clientName, existingClients || [])
        const normKey = normalizeForMatch(clientName)
        if (!clientMap.has(normKey)) {
          clientMap.set(normKey, {
            name: clientName,
            address: clientAddress,
            email, phone,
            matchResult,
          })
        }
      }

      results.push({
        filename,
        invoiceNum,
        date,
        clientName: clientName || '???',
        clientAddress,
        jobSite,
        total,
        deposit,
        email,
        phone,
        flags,
        matchResult,
        text, // Keep for debugging
      })
    } catch (err) {
      errors.push({ filename, error: err.message })
    }
  }

  // 4. Print results
  console.log('─'.repeat(130))
  console.log(
    'Filename'.padEnd(50) +
    'Invoice #'.padEnd(20) +
    'Date'.padEnd(14) +
    'Client'.padEnd(30) +
    'Total'.padEnd(14) +
    'Flags'
  )
  console.log('─'.repeat(130))

  let ready = 0, needsReview = 0, newClients = 0

  for (const r of results) {
    const clientDisplay = (r.matchResult.type === 'exact' || r.matchResult.type === 'override') ? `✅ ${r.matchResult.match?.name}`
      : r.matchResult.type === 'fuzzy' ? `🟡 → ${r.matchResult.match?.name} (${Math.round(r.matchResult.score * 100)}%)`
      : `🆕 ${r.matchResult.canonicalName || r.clientName}`

    const totalDisplay = r.total ? `$${r.total.toFixed(2)}` : '???'

    console.log(
      r.filename.substring(0, 48).padEnd(50) +
      r.invoiceNum.substring(0, 18).padEnd(20) +
      (r.date || '???').padEnd(14) +
      clientDisplay.substring(0, 28).padEnd(30) +
      totalDisplay.padEnd(14) +
      r.flags.join(', ')
    )

    if (r.flags.some(f => f === 'NO DATE' || f === 'NO CLIENT' || f === 'NO TOTAL')) {
      needsReview++
    } else {
      ready++
    }
  }

  console.log('─'.repeat(130))

  // 5. Client summary — deduplicate by match target ID or normalized name
  console.log('\n=== CLIENT MATCHING SUMMARY ===\n')

  // Count unique clients by deduplicating on matched DB ID or normalized invoice name
  const seenClientIds = new Set()
  const seenNewNames = new Set()
  const dedupedMatched = []
  const dedupedFuzzy = []
  const dedupedNew = []

  for (const r of results) {
    const m = r.matchResult
    if (m.type === 'exact' || m.type === 'override') {
      if (m.match && !seenClientIds.has(m.match.id)) {
        seenClientIds.add(m.match.id)
        dedupedMatched.push({ invoiceName: r.clientName, dbName: m.match.name, id: m.match.id, type: m.type })
      }
    } else if (m.type === 'fuzzy') {
      if (m.match && !seenClientIds.has(m.match.id)) {
        seenClientIds.add(m.match.id)
        dedupedFuzzy.push({ invoiceName: r.clientName, dbName: m.match.name, id: m.match.id, score: m.score })
      }
    } else {
      const displayName = m.canonicalName || r.clientName
      const normKey = normalizeForMatch(displayName)
      if (!seenNewNames.has(normKey)) {
        seenNewNames.add(normKey)
        dedupedNew.push({ name: displayName, address: r.clientAddress, email: r.email, phone: r.phone })
      }
    }
  }

  // Count invoices per match type
  const matchedInvoiceCount = results.filter(r => r.matchResult.type === 'exact' || r.matchResult.type === 'override').length
  const fuzzyInvoiceCount = results.filter(r => r.matchResult.type === 'fuzzy').length
  const newInvoiceCount = results.filter(r => r.matchResult.type === 'new').length

  if (dedupedMatched.length > 0) {
    console.log(`✅ Matched to existing clients (${dedupedMatched.length} clients, ${matchedInvoiceCount} invoices):`)
    for (const c of dedupedMatched) console.log(`   ${c.type === 'override' ? '🔗' : '='} "${c.invoiceName}" → ${c.dbName} (ID: ${c.id.substring(0, 8)}...)`)
  }
  if (dedupedFuzzy.length > 0) {
    console.log(`\n🟡 Fuzzy matches (${dedupedFuzzy.length} clients, ${fuzzyInvoiceCount} invoices):`)
    for (const c of dedupedFuzzy) console.log(`   "${c.invoiceName}" → ${c.dbName} (${Math.round(c.score * 100)}%)`)
  }
  if (dedupedNew.length > 0) {
    newClients = dedupedNew.length
    // Count invoices per new client
    const newClientInvCounts = {}
    for (const r of results) {
      if (r.matchResult.type === 'new') {
        const key = normalizeForMatch(r.matchResult.canonicalName || r.clientName)
        newClientInvCounts[key] = (newClientInvCounts[key] || 0) + 1
      }
    }
    console.log(`\n🆕 New clients to create (${dedupedNew.length} clients, ${newInvoiceCount} invoices):`)
    for (const c of dedupedNew) {
      const count = newClientInvCounts[normalizeForMatch(c.name)] || 0
      console.log(`   ${c.name} (${count} invoice${count !== 1 ? 's' : ''})`)
      if (c.email) console.log(`      Email: ${c.email}`)
      if (c.phone) console.log(`      Phone: ${c.phone}`)
    }
  }

  // 6. Errors
  if (errors.length > 0) {
    console.log(`\n⚠️  PARSE ERRORS (${errors.length}):`)
    for (const e of errors) console.log(`   ${e.filename}: ${e.error}`)
  }

  // 7. Summary
  console.log('\n=== SUMMARY ===\n')
  console.log(`  Total PDFs processed: ${results.length}`)
  console.log(`  ✅ Ready to import:   ${ready}`)
  console.log(`  ⚠️  Needs review:      ${needsReview}`)
  console.log(`  📎 Matched clients:   ${dedupedMatched.length + dedupedFuzzy.length} (existing in DB)`)
  console.log(`  🆕 New clients:       ${newClients} (will be created)`)
  console.log(`  ❌ Parse errors:      ${errors.length}`)
  console.log(`  💰 Total value:       $${results.reduce((s, r) => s + (r.total || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
  console.log()

  if (!doImport) {
    console.log('  🟢 DRY RUN — no data was written to Supabase.')
    console.log('  To import, run: node scripts/import-invoices.mjs --import\n')
    return
  }

  // ═══════════════════════════════════════════════════════
  // LIVE IMPORT
  // ═══════════════════════════════════════════════════════

  console.log('\n🔴 IMPORTING TO SUPABASE...\n')

  // Step 1: Create new clients
  const newClientIdMap = new Map() // normalizedName → client_id
  let clientsCreated = 0

  for (const nc of dedupedNew) {
    // Clean up address artifacts
    let addr = nc.address || ''
    addr = addr.replace(/&\s*outdoor\s*design.*/i, '').replace(/invoice\s*:.*/i, '').trim()
    if (addr.startsWith('HomesPO')) addr = addr.replace('HomesPO', 'PO ')

    const payload = {
      name: nc.name,
      address: addr || null,
      email: nc.email || null,
      phone: nc.phone ? nc.phone.replace(/--+/g, '-').replace(/\(\d+\)-/g, m => m.replace('-', '') ) : null,
    }

    const { data, error } = await supabase
      .from('clients')
      .insert(payload)
      .select('id, name')
      .single()

    if (error) {
      console.log(`  ❌ Failed to create client "${nc.name}": ${error.message}`)
      continue
    }

    const normKey = normalizeForMatch(nc.name)
    newClientIdMap.set(normKey, data.id)
    clientsCreated++
    console.log(`  ✅ Created client: ${data.name} (${data.id.substring(0, 8)}...)`)
  }

  // Step 2: Build full client_id lookup (existing + new)
  function resolveClientId(result) {
    const m = result.matchResult
    // Matched to existing DB client
    if ((m.type === 'exact' || m.type === 'override' || m.type === 'fuzzy') && m.match) {
      return m.match.id
    }
    // New client — look up by canonical or parsed name
    const displayName = m.canonicalName || result.clientName
    const normKey = normalizeForMatch(displayName)
    return newClientIdMap.get(normKey) || null
  }

  // Step 3: Insert invoices
  let invoicesCreated = 0
  let invoicesFailed = 0
  let invoiceNum = 0

  // Get existing invoice numbers to avoid duplicates
  const { data: existingInvoices } = await supabase
    .from('invoices')
    .select('number')

  const existingNumbers = new Set((existingInvoices || []).map(i => i.number))

  for (const r of results) {
    invoiceNum++
    const clientId = resolveClientId(r)

    if (!clientId) {
      console.log(`  ⚠️  [${invoiceNum}/${results.length}] SKIPPED ${r.invoiceNum} — no client ID`)
      invoicesFailed++
      continue
    }

    // Deduplicate by invoice number
    if (existingNumbers.has(r.invoiceNum)) {
      console.log(`  ⏭️  [${invoiceNum}/${results.length}] DUPLICATE ${r.invoiceNum} — already in DB`)
      continue
    }

    const total = r.total || 0
    const payload = {
      number: r.invoiceNum,
      client_id: clientId,
      status: 'Paid',
      due_date: r.date || null,
      site_address: r.jobSite || null,
      line_items: [{ description: 'Historical invoice', qty: 1, unit: 'job', unit_price: total }],
      subtotal: total,
      total: total,
      deposit_received: r.deposit || 0,
      balance_due: 0,
      notes: `Imported from legacy archive: ${r.filename}`,
      payment_terms: null,
      payment_method_used: null,
    }

    const { error } = await supabase
      .from('invoices')
      .insert(payload)

    if (error) {
      console.log(`  ❌ [${invoiceNum}/${results.length}] FAILED ${r.invoiceNum}: ${error.message}`)
      invoicesFailed++
      continue
    }

    existingNumbers.add(r.invoiceNum)
    invoicesCreated++

    // Progress: print every 10th or on error
    if (invoiceNum % 10 === 0 || invoiceNum === results.length) {
      console.log(`  📝 [${invoiceNum}/${results.length}] ${r.invoiceNum} — $${total.toFixed(2)} → ${r.matchResult.match?.name || r.matchResult.canonicalName || r.clientName}`)
    }
  }

  console.log('\n=== IMPORT COMPLETE ===\n')
  console.log(`  ✅ Clients created:  ${clientsCreated}`)
  console.log(`  ✅ Invoices created: ${invoicesCreated}`)
  console.log(`  ❌ Invoices failed:  ${invoicesFailed}`)
  console.log(`  ⏭️  Duplicates:       ${results.length - invoicesCreated - invoicesFailed}`)
  console.log(`  💰 Total imported:   $${results.filter((_, i) => true).reduce((s, r) => s + (r.total || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
  console.log()
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
