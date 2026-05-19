import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FolderOpen, CheckSquare, User, Shield, ArrowRight, Clock } from 'lucide-react'
import { searchApi } from '../../api'
import { SearchResult } from '../../types'

const TYPE_ICONS = {
  project: FolderOpen,
  task: CheckSquare,
  user: User,
  risk: Shield,
}

const TYPE_COLORS = {
  project: 'text-blue-500',
  task: 'text-green-500',
  user: 'text-purple-500',
  risk: 'text-red-500',
}

interface Props {
  onClose: () => void
}

export default function CommandPalette({ onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await searchApi.search(q)
      setResults(res.data.results || [])
      setSelected(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 200)
    return () => clearTimeout(timer)
  }, [query, search])

  const navigate_to = (r: SearchResult) => {
    if (r.type === 'project') navigate(`/projects/${r.id}`)
    else if (r.type === 'task') navigate(`/projects/${r.project_id}`)
    else if (r.type === 'user') navigate('/resources')
    else if (r.type === 'risk') navigate(`/projects/${r.project_id}/risks`)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) navigate_to(results[selected])
  }

  const categories = [...new Set(results.map(r => r.category))]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, tasks, people..."
            className="flex-1 outline-none text-gray-800 placeholder-gray-400 text-sm bg-transparent"
          />
          {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
          <kbd className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 && query.length >= 2 && !loading ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              No results for "{query}"
            </div>
          ) : results.length === 0 && query.length < 2 ? (
            <div className="px-4 py-6 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">Quick Navigate</p>
              {[
                { label: 'Dashboard', path: '/', icon: Clock },
                { label: 'All Projects', path: '/projects', icon: FolderOpen },
                { label: 'Resources', path: '/resources', icon: User },
                { label: 'Roadmap', path: '/roadmap', icon: ArrowRight },
              ].map(item => (
                <button key={item.path} onClick={() => { navigate(item.path); onClose() }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-left transition-colors">
                  <item.icon size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-600">{item.label}</span>
                </button>
              ))}
            </div>
          ) : (
            categories.map(cat => {
              const catResults = results.filter(r => r.category === cat)
              return (
                <div key={cat}>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">{cat}</div>
                  {catResults.map((r, i) => {
                    const globalIdx = results.indexOf(r)
                    const Icon = TYPE_ICONS[r.type] || FolderOpen
                    return (
                      <button
                        key={r.id}
                        onClick={() => navigate_to(r)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left transition-colors ${globalIdx === selected ? 'bg-blue-50' : ''}`}
                      >
                        <div className={`flex-shrink-0 ${TYPE_COLORS[r.type]}`}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{r.name}</div>
                          {r.project_name && <div className="text-xs text-gray-400 truncate">{r.project_name}</div>}
                          {r.email && <div className="text-xs text-gray-400">{r.email}</div>}
                        </div>
                        {r.status && (
                          <span className="text-xs text-gray-400 capitalize flex-shrink-0">{r.status.replace('_', ' ')}</span>
                        )}
                        {r.color && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1"><kbd className="bg-gray-100 px-1 rounded">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="bg-gray-100 px-1 rounded">↵</kbd> select</span>
          <span className="flex items-center gap-1"><kbd className="bg-gray-100 px-1 rounded">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
