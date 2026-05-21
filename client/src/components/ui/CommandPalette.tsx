import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FolderOpen, CheckSquare, AlertTriangle, X, ArrowRight } from 'lucide-react'
import api from '../../api'

interface SearchResult {
  projects: Array<{ id: number; name: string; status: string; health: string; color: string }>
  tasks: Array<{ id: number; name: string; status: string; project_id: number; project_name: string; project_color: string }>
  risks: Array<{ id: number; title: string; score: number; project_id: number; project_name: string }>
}

const HEALTH_COLORS: Record<string, string> = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444' }

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function CommandPalette({ isOpen, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults(null)
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults(null)
      return
    }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await api.get('/search', { params: { q: query } })
        setResults(r.data)
        setSelected(0)
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  const allItems = results ? [
    ...results.projects.map(p => ({ type: 'project' as const, id: p.id, label: p.name, sub: `Project · ${p.status.replace('_', ' ')}`, color: p.color, health: p.health, href: `/projects/${p.id}` })),
    ...results.tasks.map(t => ({ type: 'task' as const, id: t.id, label: t.name, sub: `Task in ${t.project_name}`, color: t.project_color, health: '', href: `/projects/${t.project_id}/tasks` })),
    ...results.risks.map(r => ({ type: 'risk' as const, id: r.id, label: r.title, sub: `Risk in ${r.project_name} · Score ${r.score}`, color: r.score >= 6 ? '#ef4444' : r.score >= 3 ? '#f59e0b' : '#22c55e', health: '', href: `/projects/${r.project_id}/risks` })),
  ] : []

  const navigate_to = useCallback((href: string) => {
    navigate(href)
    onClose()
  }, [navigate, onClose])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, allItems.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter' && allItems[selected]) navigate_to(allItems[selected].href)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, allItems, selected, navigate_to, onClose])

  if (!isOpen) return null

  const Icon = (type: string) => {
    if (type === 'project') return FolderOpen
    if (type === 'task') return CheckSquare
    return AlertTriangle
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" onClick={onClose}>
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects, tasks, risks..."
            className="flex-1 text-base text-gray-900 placeholder-gray-400 focus:outline-none"
          />
          {loading && <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        {allItems.length > 0 && (
          <div className="max-h-96 overflow-y-auto py-2">
            {results && results.projects.length > 0 && (
              <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Projects</div>
            )}
            {results && results.projects.map((p, i) => {
              const idx = i
              const IIcon = FolderOpen
              return (
                <div
                  key={`p-${p.id}`}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${selected === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => navigate_to(`/projects/${p.id}`)}
                  onMouseEnter={() => setSelected(idx)}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: p.color + '20' }}>
                    <IIcon size={14} style={{ color: p.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
                    <div className="text-xs text-gray-400 capitalize">{p.status.replace('_', ' ')}</div>
                  </div>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: HEALTH_COLORS[p.health] }} />
                  <ArrowRight size={14} className="text-gray-300" />
                </div>
              )
            })}

            {results && results.tasks.length > 0 && (
              <div className="px-3 py-1 mt-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tasks</div>
            )}
            {results && results.tasks.map((t, i) => {
              const idx = (results.projects.length) + i
              return (
                <div
                  key={`t-${t.id}`}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${selected === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => navigate_to(`/projects/${t.project_id}/tasks`)}
                  onMouseEnter={() => setSelected(idx)}
                >
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <CheckSquare size={14} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{t.name}</div>
                    <div className="text-xs text-gray-400 truncate">{t.project_name}</div>
                  </div>
                  <ArrowRight size={14} className="text-gray-300" />
                </div>
              )
            })}

            {results && results.risks.length > 0 && (
              <div className="px-3 py-1 mt-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Risks</div>
            )}
            {results && results.risks.map((r, i) => {
              const idx = (results.projects.length + results.tasks.length) + i
              const color = r.score >= 6 ? '#ef4444' : r.score >= 3 ? '#f59e0b' : '#22c55e'
              return (
                <div
                  key={`r-${r.id}`}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${selected === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => navigate_to(`/projects/${r.project_id}/risks`)}
                  onMouseEnter={() => setSelected(idx)}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '20' }}>
                    <AlertTriangle size={14} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{r.title}</div>
                    <div className="text-xs text-gray-400">{r.project_name} · Risk score {r.score}</div>
                  </div>
                  <ArrowRight size={14} className="text-gray-300" />
                </div>
              )
            })}
          </div>
        )}

        {query.length >= 2 && !loading && allItems.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No results for "{query}"</div>
        )}

        {!query && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            <Search size={24} className="mx-auto mb-2 opacity-30" />
            Type to search projects, tasks, and risks
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400 bg-gray-50">
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs">↑↓</kbd> navigate</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs">↵</kbd> select</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs">Esc</kbd> close</span>
          <span className="ml-auto">⌘K to open</span>
        </div>
      </div>
    </div>
  )
}
