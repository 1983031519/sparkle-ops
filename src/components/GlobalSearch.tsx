import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Users, UserCircle, Briefcase, FileText, Receipt, FolderOpen, Layers, Loader2 } from 'lucide-react'
import { useGlobalSearch, type SearchResult } from '@/hooks/useGlobalSearch'

const TYPE_CONFIG: Record<SearchResult['type'], { icon: typeof Users; color: string; label: string }> = {
  client:   { icon: Users,      color: '#2563EB', label: 'Client' },
  contact:  { icon: UserCircle, color: '#6366F1', label: 'Contact' },
  job:      { icon: Briefcase,  color: '#7C3AED', label: 'Job' },
  estimate: { icon: FileText,   color: '#D97706', label: 'Estimate' },
  invoice:  { icon: Receipt,    color: '#059669', label: 'Invoice' },
  project:  { icon: FolderOpen, color: '#4F6CF7', label: 'Project' },
  phase:    { icon: Layers,     color: '#0D6E6E', label: 'Phase' },
}

export function GlobalSearch({ mobile = false }: { mobile?: boolean }) {
  const { query, results, loading, search, clear } = useGlobalSearch()
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Debounce search
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleChange(val: string) {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (val.length < 2) { search(val); return }
    timerRef.current = setTimeout(() => search(val), 200)
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Reset active index when results change
  useEffect(() => { setActiveIdx(-1) }, [results])

  function handleSelect(r: SearchResult) {
    navigate(r.route)
    clear()
    setOpen(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIdx >= 0 && results[activeIdx]) {
      e.preventDefault()
      handleSelect(results[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  const showDropdown = open && query.length >= 2

  // Mobile: just an icon that expands
  if (mobile) {
    return (
      <div ref={containerRef} style={{ position: 'relative' }}>
        {!open ? (
          <button onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }} style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer' }}>
            <Search className="h-5 w-5 text-gray-700" strokeWidth={1.5} />
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search className="h-4 w-4 text-gray-400" strokeWidth={1.5} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => { handleChange(e.target.value); search(e.target.value.length >= 2 ? e.target.value : e.target.value) }}
                onKeyDown={handleKey}
                onFocus={() => setOpen(true)}
                placeholder="Search..."
                className="text-body"
                style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid #E5E7EB', paddingLeft: 34, paddingRight: 10, outline: 'none' }}
              />
            </div>
            <button onClick={() => { clear(); setOpen(false) }} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer' }}>
              <X className="h-5 w-5 text-gray-400" strokeWidth={2} />
            </button>
          </div>
        )}
        {showDropdown && <Dropdown results={results} loading={loading} activeIdx={activeIdx} onSelect={handleSelect} />}
      </div>
    )
  }

  // Desktop: always visible input
  return (
    <div ref={containerRef} style={{ position: 'relative', width: 320 }}>
      <Search className="h-4 w-4 text-gray-400" strokeWidth={1.5} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }} />
      {loading && <Loader2 className="h-4 w-4 text-gray-400" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite' }} />}
      <input
        ref={inputRef}
        value={query}
        onChange={e => { handleChange(e.target.value); if (e.target.value.length < 2) search(e.target.value) }}
        onKeyDown={handleKey}
        onFocus={() => setOpen(true)}
        placeholder="Search clients, jobs, invoices..."
        className="text-label font-normal"
        style={{
          width: '100%', height: 36, borderRadius: 8,
          border: '1px solid #E5E7EB', paddingLeft: 36, paddingRight: 36,
          outline: 'none', background: '#F9FAFB',
          transition: 'border-color 150ms, box-shadow 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#4F6CF7' }}
        onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = '#E5E7EB' }}
      />
      {query && (
        <button onClick={() => { clear(); inputRef.current?.focus() }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
          <X className="h-4 w-4 text-gray-400" strokeWidth={2} />
        </button>
      )}
      {showDropdown && <Dropdown results={results} loading={loading} activeIdx={activeIdx} onSelect={handleSelect} />}
    </div>
  )
}

function Dropdown({ results, loading, activeIdx, onSelect }: { results: SearchResult[]; loading: boolean; activeIdx: number; onSelect: (r: SearchResult) => void }) {
  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
      background: 'white', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 9999,
      maxHeight: 400, overflowY: 'auto',
    }}>
      {loading && results.length === 0 && (
        <div className="text-label font-normal" style={{ padding: '20px 16px', textAlign: 'center', color: '#9CA3AF' }}>
          Searching...
        </div>
      )}
      {!loading && results.length === 0 && (
        <div className="text-label font-normal" style={{ padding: '20px 16px', textAlign: 'center', color: '#9CA3AF' }}>
          No results found
        </div>
      )}
      {results.map((r, i) => {
        const cfg = TYPE_CONFIG[r.type]
        const Icon = cfg.icon
        return (
          <button
            key={`${r.type}-${r.id}`}
            onClick={() => onSelect(r)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '10px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
              background: i === activeIdx ? '#F3F4F6' : 'transparent',
              borderBottom: i < results.length - 1 ? '1px solid #F9FAFB' : 'none',
              transition: 'background 100ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6' }}
            onMouseLeave={e => { if (i !== activeIdx) e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 8, background: cfg.color + '10', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon className="h-4 w-4" strokeWidth={1.5} color={cfg.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-label font-semibold text-gray-900" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.primary}</div>
              {r.secondary && <div className="text-micro font-normal text-gray-400" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.secondary}</div>}
              {r.snippet && <div className="text-micro font-normal text-gray-500" style={{ marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>{r.snippet}</div>}
            </div>
            <span className="text-micro uppercase font-semibold" style={{ color: cfg.color, letterSpacing: '0.05em', flexShrink: 0 }}>{cfg.label}</span>
          </button>
        )
      })}
    </div>
  )
}
