import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FolderOpen, CheckSquare, AlertTriangle, User, Briefcase } from 'lucide-react'
import { searchApi } from '../api'

interface SearchResults {
  projects: Array<{ id: number; name: string; status: string; health: string; color: string }>
  tasks: Array<{ id: number; name: string; project_id: number; project_name: string; status: string; color: string }>
  risks: Array<{ id: number; title: string; score: number; project_id: number; project_name: string }>
  people: Array<{ id: number; name: string; email: string; department: string }>
  portfolios: Array<{ id: number; name: string; description: string }>
}

export default function GlobalSearch() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    if (!q.trim()) {
      setResults(null)
      return
    }
    timerRef.current = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchApi.query(q)
        setResults(res.data)
      } finally { setLoading(false) }
    }, 200)
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current) }
  }, [q])

  const go = (path: string) => {
    setOpen(false)
    setQ('')
    setResults(null)
    navigate(path)
  }

  const total = results ? results.projects.length + results.tasks.length + results.risks.length + results.people.length + results.portfolios.length : 0

  return (
    <div className="relative flex-1 max-w-md" ref={containerRef}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search projects, tasks, risks, people... (⌘K)"
        className="w-full pl-9 pr-12 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5 hidden md:block">⌘K</kbd>

      {open && q.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-[60vh] overflow-y-auto">
          {loading && <div className="text-xs text-gray-400 px-4 py-3">Searching...</div>}
          {!loading && results && total === 0 && (
            <div className="text-sm text-gray-400 px-4 py-6 text-center">No results for "{q}"</div>
          )}
          {!loading && results && total > 0 && (
            <div className="py-1">
              {results.projects.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-gray-400 bg-gray-50">Projects</div>
                  {results.projects.map(p => (
                    <button key={p.id} onClick={() => go(`/projects/${p.id}`)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50">
                      <div className="w-2 h-6 rounded" style={{ backgroundColor: p.color }} />
                      <FolderOpen size={14} className="text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-800 truncate">{p.name}</div>
                        <div className="text-xs text-gray-400 capitalize">{p.status} · {p.health}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {results.tasks.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-gray-400 bg-gray-50">Tasks</div>
                  {results.tasks.map(t => (
                    <button key={t.id} onClick={() => go(`/projects/${t.project_id}/tasks`)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50">
                      <CheckSquare size={14} className="text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-800 truncate">{t.name}</div>
                        <div className="text-xs text-gray-400">{t.project_name} · {t.status}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {results.risks.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-gray-400 bg-gray-50">Risks</div>
                  {results.risks.map(r => (
                    <button key={r.id} onClick={() => go(`/projects/${r.project_id}/risks`)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50">
                      <AlertTriangle size={14} className="text-amber-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-800 truncate">{r.title}</div>
                        <div className="text-xs text-gray-400">{r.project_name} · score {r.score}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {results.portfolios.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-gray-400 bg-gray-50">Portfolios</div>
                  {results.portfolios.map(p => (
                    <button key={p.id} onClick={() => go(`/portfolio`)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50">
                      <Briefcase size={14} className="text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-800 truncate">{p.name}</div>
                        {p.description && <div className="text-xs text-gray-400 truncate">{p.description}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {results.people.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-gray-400 bg-gray-50">People</div>
                  {results.people.map(p => (
                    <button key={p.id} onClick={() => go(`/resources`)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50">
                      <User size={14} className="text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-800 truncate">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.department} · {p.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
