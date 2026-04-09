import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export interface SearchResult {
  id: string
  type: 'client' | 'contact' | 'job' | 'estimate' | 'invoice' | 'project' | 'phase'
  primary: string
  secondary: string
  snippet?: string
  route: string
  score: number
}

function score(query: string, text: string | null | undefined): number {
  if (!text) return 0
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  if (t === q) return 3
  if (t.startsWith(q)) return 2
  if (t.includes(q)) return 1
  return 0
}

function bestScore(query: string, ...fields: (string | null | undefined)[]): number {
  return Math.max(0, ...fields.map(f => score(query, f)))
}

function snippet(query: string, text: string | null | undefined, maxLen = 80): string | undefined {
  if (!text) return undefined
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx < 0) return undefined
  const start = Math.max(0, idx - 20)
  const end = Math.min(text.length, idx + query.length + maxLen - 20)
  let s = text.slice(start, end).replace(/\n/g, ' ').trim()
  if (start > 0) s = '...' + s
  if (end < text.length) s = s + '...'
  return s
}

export function useGlobalSearch() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const abortRef = useRef(0)

  const search = useCallback(async (q: string = '') => {
    setQuery(q)
    if (q.length < 2) { setResults([]); setLoading(false); return }

    setLoading(true)
    const id = ++abortRef.current
    const term = `%${q}%`

    try {
      const [clients, contacts, jobs, estimates, invoices, projects, phases] = await Promise.all([
        supabase.from('clients').select('id, name, phone, email, address, city, state, notes').or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term},address.ilike.${term},city.ilike.${term},notes.ilike.${term}`).limit(10),
        supabase.from('client_contacts').select('id, client_id, name, phone, email').or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term}`).limit(8),
        supabase.from('jobs').select('id, title, address, notes, materials_used').or(`title.ilike.${term},address.ilike.${term},notes.ilike.${term},materials_used.ilike.${term}`).limit(10),
        supabase.from('estimates').select('id, number, site_address, scope_of_work, re_line').or(`number.ilike.${term},site_address.ilike.${term},scope_of_work.ilike.${term},re_line.ilike.${term}`).limit(8),
        supabase.from('invoices').select('id, number').or(`number.ilike.${term}`).limit(6),
        supabase.from('projects').select('id, number, title, description, site_address, client_name').or(`number.ilike.${term},title.ilike.${term},description.ilike.${term},site_address.ilike.${term},client_name.ilike.${term}`).limit(8),
        supabase.from('project_phases').select('id, project_id, title, description, order_num').or(`title.ilike.${term},description.ilike.${term}`).limit(6),
      ])

      if (id !== abortRef.current) return

      // Build client name lookup for contacts and phases
      const clientIds = new Set<string>()
      for (const c of (contacts.data ?? []) as { client_id: string }[]) clientIds.add(c.client_id)
      const projectIds = new Set<string>()
      for (const p of (phases.data ?? []) as { project_id: string }[]) projectIds.add(p.project_id)

      let clientNameMap: Record<string, string> = {}
      let projectNameMap: Record<string, string> = {}

      if (clientIds.size > 0) {
        const { data } = await supabase.from('clients').select('id, name').in('id', [...clientIds])
        clientNameMap = Object.fromEntries((data ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))
      }
      if (projectIds.size > 0) {
        const { data } = await supabase.from('projects').select('id, title, number').in('id', [...projectIds])
        projectNameMap = Object.fromEntries((data ?? []).map((p: { id: string; title: string; number: string }) => [p.id, p.title || p.number]))
      }

      if (id !== abortRef.current) return

      const r: SearchResult[] = []

      for (const c of (clients.data ?? []) as { id: string; name: string; phone: string | null; email: string | null; address: string | null; city: string | null; state: string | null; notes: string | null }[]) {
        const s = bestScore(q, c.name, c.phone, c.email, c.address, c.city)
        const contentSnip = s === 0 ? snippet(q, c.notes) : undefined
        r.push({ id: c.id, type: 'client', primary: c.name, secondary: [c.phone, c.email, c.city].filter(Boolean).join(' · '), snippet: contentSnip, route: '/clients', score: s || (contentSnip ? 0.5 : 0) })
      }

      for (const c of (contacts.data ?? []) as { id: string; client_id: string; name: string; phone: string | null; email: string | null }[]) {
        const s = bestScore(q, c.name, c.phone, c.email)
        r.push({ id: c.id, type: 'contact', primary: c.name, secondary: clientNameMap[c.client_id] ?? 'Client', route: '/clients', score: s })
      }

      for (const j of (jobs.data ?? []) as { id: string; title: string; address: string | null; notes: string | null; materials_used: string | null }[]) {
        const s = bestScore(q, j.title, j.address)
        const contentSnip = s === 0 ? snippet(q, j.notes) || snippet(q, j.materials_used) : undefined
        r.push({ id: j.id, type: 'job', primary: j.title, secondary: j.address ?? '', snippet: contentSnip, route: '/jobs', score: s || (contentSnip ? 0.5 : 0) })
      }

      for (const e of (estimates.data ?? []) as { id: string; number: string; site_address: string | null; scope_of_work: string | null; re_line: string | null }[]) {
        const s = bestScore(q, e.number, e.site_address, e.re_line)
        const contentSnip = s === 0 ? snippet(q, e.scope_of_work) : undefined
        r.push({ id: e.id, type: 'estimate', primary: e.number, secondary: e.re_line ?? e.site_address ?? '', snippet: contentSnip, route: '/estimates', score: s || (contentSnip ? 0.5 : 0) })
      }

      for (const i of (invoices.data ?? []) as { id: string; number: string }[]) {
        const s = bestScore(q, i.number)
        r.push({ id: i.id, type: 'invoice', primary: i.number, secondary: '', route: '/invoices', score: s })
      }

      for (const p of (projects.data ?? []) as { id: string; number: string; title: string; description: string | null; site_address: string | null; client_name: string | null }[]) {
        const s = bestScore(q, p.title, p.number, p.client_name, p.site_address)
        const contentSnip = s === 0 ? snippet(q, p.description) : undefined
        r.push({ id: p.id, type: 'project', primary: p.title || p.number, secondary: p.client_name ?? '', snippet: contentSnip, route: '/projects', score: s || (contentSnip ? 0.5 : 0) })
      }

      for (const ph of (phases.data ?? []) as { id: string; project_id: string; title: string; description: string | null; order_num: number }[]) {
        const s = bestScore(q, ph.title)
        const contentSnip = s === 0 ? snippet(q, ph.description) : undefined
        r.push({ id: ph.id, type: 'phase', primary: `Phase ${ph.order_num} — ${ph.title}`, secondary: projectNameMap[ph.project_id] ?? 'Project', snippet: contentSnip, route: '/projects', score: s || (contentSnip ? 0.5 : 0) })
      }

      // Sort by score descending, then by type priority
      r.sort((a, b) => b.score - a.score)
      setResults(r.slice(0, 15))
    } catch {
      setResults([])
    } finally {
      if (id === abortRef.current) setLoading(false)
    }
  }, [])

  const clear = useCallback(() => { setQuery(''); setResults([]); setLoading(false) }, [])

  return { query, results, loading, search, clear }
}
