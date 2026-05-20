import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, FolderOpen, CheckSquare, AlertTriangle, User, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { searchApi } from '../../api'
import { SearchResult } from '../../types'
import { useUIStore } from '../../store'

const TYPE_CONFIG = {
  project: { icon: <FolderOpen size={14} />, color: 'text-blue-600 bg-blue-50', label: 'Project', href: (id: number) => `/projects/${id}` },
  task: { icon: <CheckSquare size={14} />, color: 'text-purple-600 bg-purple-50', label: 'Task', href: (_id: number, subtitle?: string) => `/projects/${subtitle?.split(' · ')[0]}` },
  risk: { icon: <AlertTriangle size={14} />, color: 'text-orange-600 bg-orange-50', label: 'Risk', href: () => '/portfolio' },
  user: { icon: <User size={14} />, color: 'text-green-600 bg-green-50', label: 'User', href: () => '/resources' },
}

export default function CommandPalette() {
  const open = useUIStore(s => s.commandPaletteOpen)
  const toggle = useUIStore(s => s.toggleCommandPalette)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggle()
      }
      if (e.key === 'Escape' && open) toggle()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, toggle])

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await searchApi.search(q)
      setResults(res.data.results)
      setSelected(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 200)
    return () => clearTimeout(t)
  }, [query, doSearch])

  const navigateTo = (result: SearchResult) => {
    const cfg = TYPE_CONFIG[result.type]
    if (!cfg) return
    const url = result.type === 'project' ? `/projects/${result.id}` :
                result.type === 'task' ? `/projects/${result.id}` :
                result.type === 'user' ? '/resources' : '/portfolio'
    navigate(url)
    toggle()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) navigateTo(results[selected])
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-24 px-4" onClick={toggle}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, tasks, risks, people..."
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          <kbd className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded hidden sm:block">ESC</kbd>
        </div>

        {results.length > 0 ? (
          <div className="py-2 max-h-80 overflow-y-auto">
            {results.map((r, i) => {
              const cfg = TYPE_CONFIG[r.type]
              return (
                <div
                  key={`${r.type}-${r.id}`}
                  onClick={() => navigateTo(r)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${i === selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg?.color}`}>
                    {cfg?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{r.name}</div>
                    {r.subtitle && <div className="text-xs text-gray-400 truncate">{r.subtitle}</div>}
                  </div>
                  <div className="text-xs text-gray-300 flex items-center gap-1 flex-shrink-0">
                    <span className="capitalize">{r.type}</span>
                    <ArrowRight size={10} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : query.length >= 2 && !loading ? (
          <div className="py-8 text-center text-sm text-gray-400">No results for "{query}"</div>
        ) : query.length === 0 ? (
          <div className="py-4 px-4 space-y-1">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Quick Actions</div>
            {[
              { label: 'View Dashboard', href: '/' },
              { label: 'All Projects', href: '/projects' },
              { label: 'Portfolio Overview', href: '/portfolio' },
              { label: 'Resources', href: '/resources' },
              { label: 'Reports', href: '/reports' },
            ].map(item => (
              <div key={item.href} onClick={() => { navigate(item.href); toggle() }} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <ArrowRight size={14} className="text-gray-400" />
                <span className="text-sm text-gray-700">{item.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
          <span>↑↓ navigate</span>
          <span>⏎ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
