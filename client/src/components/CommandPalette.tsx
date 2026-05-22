import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FolderOpen, CheckSquare, AlertTriangle, ArrowRight, Command, X } from 'lucide-react'
import { searchApi } from '../api'

interface SearchResult {
  projects: Array<{ id: number; name: string; status: string; health: string; color: string; completion_percent: number }>
  tasks: Array<{ id: number; name: string; status: string; priority: string; project_id: number; project_name: string; project_color: string }>
  risks: Array<{ id: number; title: string; status: string; score: number; project_id: number; project_name: string }>
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

const QUICK_ACTIONS = [
  { label: 'Go to Dashboard', shortcut: 'D', path: '/', icon: Command },
  { label: 'View Portfolio', shortcut: 'P', path: '/portfolio', icon: FolderOpen },
  { label: 'View Projects', shortcut: 'J', path: '/projects', icon: FolderOpen },
  { label: 'View Resources', shortcut: 'R', path: '/resources', icon: Command },
  { label: 'View Reports', shortcut: 'A', path: '/reports', icon: Command },
  { label: 'Portfolio Roadmap', shortcut: 'M', path: '/roadmap', icon: Command },
]

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults(null)
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults(null); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchApi.query(query)
        setResults(res.data)
        setSelectedIndex(0)
      } finally { setLoading(false) }
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const allItems = results ? [
    ...results.projects.map(p => ({ type: 'project' as const, id: p.id, label: p.name, sub: `Project · ${p.status}`, path: `/projects/${p.id}`, color: p.color })),
    ...results.tasks.map(t => ({ type: 'task' as const, id: t.id, label: t.name, sub: `Task in ${t.project_name}`, path: `/projects/${t.project_id}`, color: t.project_color })),
    ...results.risks.map(r => ({ type: 'risk' as const, id: r.id, label: r.title, sub: `Risk · ${r.project_name}`, path: `/projects/${r.project_id}/risks`, color: '#ef4444' })),
  ] : []

  const handleSelect = useCallback((path: string) => {
    navigate(path)
    onClose()
  }, [navigate, onClose])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, (results ? allItems.length : QUICK_ACTIONS.length) - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter') {
        if (!results) {
          const action = QUICK_ACTIONS[selectedIndex]
          if (action) handleSelect(action.path)
        } else {
          const item = allItems[selectedIndex]
          if (item) handleSelect(item.path)
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, results, allItems, selectedIndex, handleSelect, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects, tasks, risks... or type a command"
            className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400"
          />
          {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
          {query && <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>}
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-0.5 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[480px] overflow-y-auto">
          {!results ? (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Quick Navigation</div>
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={action.path}
                  onClick={() => handleSelect(action.path)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${i === selectedIndex ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                >
                  <action.icon size={16} className="text-gray-400" />
                  <span className="flex-1 text-left text-gray-700 dark:text-gray-300">{action.label}</span>
                  <ArrowRight size={14} className="text-gray-300" />
                </button>
              ))}
            </div>
          ) : allItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No results for "{query}"</div>
          ) : (
            <div>
              {results.projects.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2"><FolderOpen size={12} /> Projects</div>
                  {results.projects.map((p, i) => {
                    const globalIdx = i
                    return (
                      <button key={p.id} onClick={() => handleSelect(`/projects/${p.id}`)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${globalIdx === selectedIndex ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                        <span className="flex-1 text-left text-sm text-gray-700 dark:text-gray-300">{p.name}</span>
                        <span className="text-xs text-gray-400 capitalize">{p.status}</span>
                        <span className="text-xs text-gray-400">{p.completion_percent}%</span>
                      </button>
                    )
                  })}
                </div>
              )}
              {results.tasks.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2"><CheckSquare size={12} /> Tasks</div>
                  {results.tasks.map((t, i) => {
                    const globalIdx = results.projects.length + i
                    return (
                      <button key={t.id} onClick={() => handleSelect(`/projects/${t.project_id}`)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${globalIdx === selectedIndex ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.project_color }} />
                        <span className="flex-1 text-left text-sm text-gray-700 dark:text-gray-300 truncate">{t.name}</span>
                        <span className="text-xs text-gray-400 truncate">{t.project_name}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              {results.risks.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2"><AlertTriangle size={12} /> Risks</div>
                  {results.risks.map((r, i) => {
                    const globalIdx = results.projects.length + results.tasks.length + i
                    return (
                      <button key={r.id} onClick={() => handleSelect(`/projects/${r.project_id}`)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${globalIdx === selectedIndex ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${r.score >= 6 ? 'bg-red-500' : r.score >= 3 ? 'bg-yellow-500' : 'bg-green-500'}`} />
                        <span className="flex-1 text-left text-sm text-gray-700 dark:text-gray-300 truncate">{r.title}</span>
                        <span className="text-xs text-gray-400">{r.project_name}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">Enter</kbd> Select</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}
