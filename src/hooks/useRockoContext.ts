import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtCurrency } from '@/lib/constants'

export function useRockoContext() {
  const [context, setContext] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const today = new Date().toISOString().split('T')[0]
        const monthStart = today.slice(0, 7) + '-01'
        const lastMonth = new Date()
        lastMonth.setMonth(lastMonth.getMonth() - 1)
        const lastMonthStart = lastMonth.toISOString().slice(0, 7) + '-01'
        const lastMonthEnd = today.slice(0, 7) + '-01'

        const [jobsRes, invRes, estRes, clientsRes, stockRes, matRes, labRes, othRes] = await Promise.all([
          supabase.from('jobs').select('id, title, client_id, status, total').order('created_at', { ascending: false }),
          supabase.from('invoices').select('id, number, client_id, status, total, due_date, created_at'),
          supabase.from('estimates').select('id, number, client_id, status, total'),
          supabase.from('clients').select('id, name'),
          supabase.from('inventory').select('name, quantity, low_stock_threshold'),
          supabase.from('job_material_costs').select('total'),
          supabase.from('job_labor_costs').select('total_amount'),
          supabase.from('job_other_costs').select('amount'),
        ])

        const jobs = (jobsRes.data ?? []) as { id: string; title: string; client_id: string; status: string; total: number }[]
        const invoices = (invRes.data ?? []) as { id: string; number: string; client_id: string; status: string; total: number; due_date: string | null; created_at: string }[]
        const estimates = (estRes.data ?? []) as { id: string; number: string; client_id: string; status: string; total: number }[]
        const clients = (clientsRes.data ?? []) as { id: string; name: string }[]
        const stock = (stockRes.data ?? []) as { name: string; quantity: number; low_stock_threshold: number }[]

        const cn = Object.fromEntries(clients.map(c => [c.id, c.name]))

        // Active jobs
        const activeJobs = jobs.filter(j => j.status === 'In Progress' || j.status === 'Scheduled')
        const activeJobsList = activeJobs.slice(0, 8).map(j => `  - ${j.title} (${cn[j.client_id] ?? '?'}) — ${j.status} — ${fmtCurrency(j.total)}`).join('\n')

        // Invoices
        const unpaid = invoices.filter(i => i.status === 'Unpaid' || i.status === 'Overdue')
        const overdue = unpaid.filter(i => i.due_date && i.due_date < today)
        const outstandingTotal = unpaid.reduce((s, i) => s + i.total, 0)
        const overdueList = overdue.slice(0, 5).map(i => `  - ${i.number} (${cn[i.client_id] ?? '?'}) — ${fmtCurrency(i.total)} — due ${i.due_date}`).join('\n')

        // Revenue this month vs last
        const paidInvs = invoices.filter(i => i.status === 'Paid')
        const thisMonthRev = paidInvs.filter(i => i.created_at >= monthStart).reduce((s, i) => s + i.total, 0)
        const lastMonthRev = paidInvs.filter(i => i.created_at >= lastMonthStart && i.created_at < lastMonthEnd).reduce((s, i) => s + i.total, 0)

        // Estimates pending
        const pending = estimates.filter(e => e.status === 'Draft' || e.status === 'Sent')
        const pendingList = pending.slice(0, 5).map(e => `  - ${e.number} (${cn[e.client_id] ?? '?'}) — ${fmtCurrency(e.total)}`).join('\n')

        // Top clients by revenue
        const clientRev: Record<string, number> = {}
        for (const i of paidInvs) clientRev[i.client_id] = (clientRev[i.client_id] ?? 0) + i.total
        const topClients = Object.entries(clientRev).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cid, rev]) => `  - ${cn[cid] ?? '?'}: ${fmtCurrency(rev)}`).join('\n')

        // Low stock
        const lowStock = stock.filter(s => s.quantity <= s.low_stock_threshold)

        // Costs + profit
        const totalMatCost = ((matRes.data ?? []) as { total: number }[]).reduce((s, r) => s + (r.total || 0), 0)
        const totalLabCost = ((labRes.data ?? []) as { total_amount: number }[]).reduce((s, r) => s + (r.total_amount || 0), 0)
        const totalOthCost = ((othRes.data ?? []) as { amount: number }[]).reduce((s, r) => s + (r.amount || 0), 0)
        const totalCost = totalMatCost + totalLabCost + totalOthCost
        const totalRev = paidInvs.reduce((s, i) => s + i.total, 0)
        const profit = totalRev - totalCost
        const margin = totalRev > 0 ? ((profit / totalRev) * 100).toFixed(1) : '0'

        const ctx = `TODAY: ${today}
COMPANY: Sparkle Stone & Pavers (Sparkle Solutions LLC), Bradenton FL
OWNER: Oscar Rocha

ACTIVE JOBS (${activeJobs.length}):
${activeJobsList || '  None'}

OVERDUE INVOICES (${overdue.length}):
${overdueList || '  None'}

OUTSTANDING TOTAL: ${fmtCurrency(outstandingTotal)} (${unpaid.length} invoices)

ESTIMATES PENDING APPROVAL (${pending.length}):
${pendingList || '  None'}

TOP CLIENTS BY REVENUE:
${topClients || '  No paid invoices yet'}

REVENUE THIS MONTH: ${fmtCurrency(thisMonthRev)}
REVENUE LAST MONTH: ${fmtCurrency(lastMonthRev)}

TOTAL COSTS (all time): ${fmtCurrency(totalCost)} (Materials: ${fmtCurrency(totalMatCost)}, Labor: ${fmtCurrency(totalLabCost)}, Other: ${fmtCurrency(totalOthCost)})
TOTAL REVENUE (paid): ${fmtCurrency(totalRev)}
GROSS PROFIT: ${fmtCurrency(profit)} (${margin}% margin)

LOW STOCK ITEMS: ${lowStock.length > 0 ? lowStock.map(s => `${s.name} (${s.quantity} left)`).join(', ') : 'None'}

TOTAL CLIENTS: ${clients.length}
TOTAL JOBS: ${jobs.length}
TOTAL INVOICES: ${invoices.length}
TOTAL ESTIMATES: ${estimates.length}`

        setContext(ctx)
      } catch (err) {
        console.error('[Rocko] Context load error:', err)
        setContext('Could not load business data. Answering without context.')
      } finally {
        setReady(true)
      }
    }
    load()
  }, [])

  return { context, ready }
}
