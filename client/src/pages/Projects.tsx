import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, Grid3X3, List, ChevronRight, ArrowUpDown, Download, Bookmark, X } from 'lucide-react'
import { projectsApi, exportApi, viewsApi, insightsApi } from '../api'
import { Project, Rag } from '../types'
import { HealthBadge, PriorityBadge, StatusBadge } from '../components/ui/Badge'
import { HealthChip } from '../components/HealthInsights'
import Progress from '../components/ui/Progress'
import Modal from '../components/ui/Modal'
import ProjectForm from '../components/forms/ProjectForm'
import { format, parseISO } from 'date-fns'

const STATUS_OPTIONS = ['', 'planning', 'active', 'on_hold', 'completed', 'cancelled']
const HEALTH_OPTIONS = ['', 'green', 'yellow', 'red']
const PRIORITY_OPTIONS = ['', 'critical', 'high', 'medium', 'low']

interface SavedView {
  id: number
  name: string
  filters: string
  is_default: number
}

type ProjectFilters = { status: string; health: string; priority: string }

function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n}`
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'list'>('list')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<ProjectFilters>({ status: '', health: '', priority: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [views, setViews] = useState<SavedView[]>([])
  const [activeViewId, setActiveViewId] = useState<number | null>(null)
  const [scores, setScores] = useState<Record<number, { score: number; rag: Rag }>>({})
  const navigate = useNavigate()

  useEffect(() => {
    insightsApi.portfolio().then(r => {
      const map: Record<number, { score: number; rag: Rag }> = {}
      for (const p of r.data.projects) map[p.id] = { score: p.score, rag: p.rag }
      setScores(map)
    }).catch(() => { /* insights are non-critical chrome */ })
  }, [])

  useEffect(() => {
    viewsApi.list('projects').then(r => {
      setViews(r.data.views)
      const def = (r.data.views as SavedView[]).find(v => v.is_default)
      if (def) applyView(def)
    })
  }, [])

  const applyView = (view: SavedView) => {
    try {
      const f = JSON.parse(view.filters)
      setFilters({ status: f.status || '', health: f.health || '', priority: f.priority || '' })
      if (f.search !== undefined) setSearch(f.search)
      setActiveViewId(view.id)
    } catch { /* ignore corrupt view */ }
  }

  const clearView = () => {
    setFilters({ status: '', health: '', priority: '' })
    setSearch('')
    setActiveViewId(null)
  }

  const handleSaveView = async () => {
    const name = prompt('Name this view:')
    if (!name?.trim()) return
    const res = await viewsApi.create({ page: 'projects', name: name.trim(), filters: { ...filters, search } })
    setViews(v => [...v, res.data.view])
    setActiveViewId(res.data.view.id)
  }

  const handleDeleteView = async (view: SavedView) => {
    await viewsApi.delete(view.id)
    setViews(v => v.filter(x => x.id !== view.id))
    if (activeViewId === view.id) setActiveViewId(null)
  }

  const fetchProjects = () => {
    const params: Record<string, string> = {}
    if (filters.status) params.status = filters.status
    if (filters.health) params.health = filters.health
    if (filters.priority) params.priority = filters.priority
    projectsApi.list(params).then(r => setProjects(r.data.projects)).finally(() => setLoading(false))
  }

  useEffect(() => { fetchProjects() }, [filters])

  const filtered = projects.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async (data: Partial<Project>) => {
    setCreating(true)
    try {
      await projectsApi.create(data)
      setShowCreate(false)
      fetchProjects()
    } finally { setCreating(false) }
  }

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    onTrack: projects.filter(p => p.health === 'green').length,
    atRisk: projects.filter(p => p.health === 'yellow' || p.health === 'red').length,
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">{stats.active} active · {stats.onTrack} on track · {stats.atRisk} needs attention</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportApi.downloadWithAuth(exportApi.projectsCsv(), 'projects.csv')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
          >
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={16} /> New Project
          </button>
        </div>
      </div>

      {/* Saved views */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={clearView}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${activeViewId === null ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          All Projects
        </button>
        {views.map(view => (
          <span
            key={view.id}
            className={`group flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-xs font-medium rounded-full border cursor-pointer transition-colors ${activeViewId === view.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            onClick={() => applyView(view)}
          >
            <Bookmark size={11} />
            {view.name}
            <X
              size={12}
              className={`opacity-0 group-hover:opacity-100 transition-opacity ${activeViewId === view.id ? 'hover:text-blue-200' : 'hover:text-red-500'}`}
              onClick={e => { e.stopPropagation(); handleDeleteView(view) }}
            />
          </span>
        ))}
        {(Object.values(filters).some(Boolean) || search) && (
          <button onClick={handleSaveView} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 border border-dashed border-blue-300 rounded-full hover:bg-blue-50 transition-colors">
            <Plus size={11} /> Save view
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${showFilters ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          <Filter size={14} /> Filters {Object.values(filters).filter(Boolean).length > 0 && <span className="w-4 h-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">{Object.values(filters).filter(Boolean).length}</span>}
        </button>
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden ml-auto">
          <button onClick={() => setView('list')} className={`p-2 transition-colors ${view === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}><List size={16} /></button>
          <button onClick={() => setView('grid')} className={`p-2 transition-colors ${view === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}><Grid3X3 size={16} /></button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 flex-wrap">
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s ? s.replace('_', ' ') : 'All Status'}</option>)}
          </select>
          <select value={filters.health} onChange={e => setFilters(f => ({ ...f, health: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {HEALTH_OPTIONS.map(h => <option key={h} value={h}>{h ? { green: 'On Track', yellow: 'At Risk', red: 'Off Track' }[h] : 'All Health'}</option>)}
          </select>
          <select value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p || 'All Priority'}</option>)}
          </select>
          <button onClick={() => setFilters({ status: '', health: '', priority: '' })} className="text-sm text-red-500 hover:text-red-700 ml-auto">Clear Filters</button>
        </div>
      )}

      {/* Projects */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FolderOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p>No projects found</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(project => (
            <ProjectCard key={project.id} project={project} onClick={() => navigate(`/projects/${project.id}`)} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">Project</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">Health</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">Score</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">Progress</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider hidden md:table-cell">Budget</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider hidden lg:table-cell">Due Date</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">Priority</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(project => (
                <tr key={project.id} className="hover:bg-blue-50/30 cursor-pointer transition-colors" onClick={() => navigate(`/projects/${project.id}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{project.name}</div>
                        {project.manager_name && <div className="text-xs text-gray-400">{project.manager_name}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={project.status} /></td>
                  <td className="px-4 py-3"><HealthBadge health={project.health} /></td>
                  <td className="px-4 py-3">{scores[project.id] ? <HealthChip score={scores[project.id].score} rag={scores[project.id].rag} /> : <span className="text-xs text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 w-40">
                    <div className="flex items-center gap-2">
                      <Progress value={project.completion_percent} size="sm" color="auto" className="flex-1" />
                      <span className="text-xs text-gray-500 w-8">{project.completion_percent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="text-xs text-gray-700">{formatCurrency(project.spent)}</div>
                    <div className="text-xs text-gray-400">of {formatCurrency(project.budget)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">
                    {project.end_date ? format(parseISO(project.end_date), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3"><PriorityBadge priority={project.priority} /></td>
                  <td className="px-4 py-3"><ChevronRight size={16} className="text-gray-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Project" size="lg">
        <ProjectForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} loading={creating} />
      </Modal>
    </div>
  )
}

// Missing import fix
import { FolderOpen } from 'lucide-react'

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer" onClick={onClick}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
          <HealthBadge health={project.health} />
        </div>
        <PriorityBadge priority={project.priority} />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1 leading-tight">{project.name}</h3>
      {project.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{project.description}</p>}
      <Progress value={project.completion_percent} size="sm" color="auto" showLabel className="mb-3" />
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{project.manager_name || 'No manager'}</span>
        <span>{project.end_date ? format(parseISO(project.end_date), 'MMM d, yyyy') : '—'}</span>
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-400">{project.task_count || 0} tasks</span>
        <div className="text-xs">
          <span className="font-medium text-gray-700">{formatCurrency(project.spent)}</span>
          <span className="text-gray-400"> / {formatCurrency(project.budget)}</span>
        </div>
      </div>
    </div>
  )
}
