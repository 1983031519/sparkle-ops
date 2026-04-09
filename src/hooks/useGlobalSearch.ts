import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export interface SearchResult {
  id: string
  type: 'client' | 'job' | 'estimate' | 'invoice' | 'project'
  primary: string
  secondary: string
  route: string
}

interface ClientRow { id: string; name: string; phone: string | null; email: string | null; address: string | null }
interface JobRow { id: string; title: string; address: string | null }
interface EstRow { id: string; number: string; site_address: string | null }
interface InvRow { id: string; number: string }
interface ProjRow { id: string; number: string; title: string; client_name: string | null }

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
      const [clients, jobs, estimates, invoices, projects] = await Promise.all([
        supabase.from('clients').select('id, name, phone, email, address').or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term},address.ilike.${term}`).limit(3),
        supabase.from('jobs').select('id, title, address').or(`title.ilike.${term},address.ilike.${term}`).limit(3),
        supabase.from('estimates').select('id, number, site_address').or(`number.ilike.${term},site_address.ilike.${term}`).limit(3),
        supabase.from('invoices').select('id, number').or(`number.ilike.${term}`).limit(3),
        supabase.from('projects').select('id, number, title, client_name').or(`number.ilike.${term},title.ilike.${term},client_name.ilike.${term}`).limit(3),
      ])

      if (id !== abortRef.current) return

      const r: SearchResult[] = []

      for (const c of (clients.data ?? []) as ClientRow[]) {
        r.push({ id: c.id, type: 'client', primary: c.name, secondary: c.phone ?? c.email ?? c.address ?? '', route: '/clients' })
      }
      for (const j of (jobs.data ?? []) as JobRow[]) {
        r.push({ id: j.id, type: 'job', primary: j.title, secondary: j.address ?? '', route: '/jobs' })
      }
      for (const e of (estimates.data ?? []) as EstRow[]) {
        r.push({ id: e.id, type: 'estimate', primary: e.number, secondary: e.site_address ?? '', route: '/estimates' })
      }
      for (const i of (invoices.data ?? []) as InvRow[]) {
        r.push({ id: i.id, type: 'invoice', primary: i.number, secondary: '', route: '/invoices' })
      }
      for (const p of (projects.data ?? []) as ProjRow[]) {
        r.push({ id: p.id, type: 'project', primary: p.title ?? p.number, secondary: p.client_name ?? '', route: '/projects' })
      }

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
