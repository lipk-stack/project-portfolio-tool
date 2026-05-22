import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, Grid3X3, List, ChevronRight } from 'lucide-react'
import { projectsApi } from '../api'
import { Project } from '../types'
import { HealthBadge, PriorityBadge, StatusBadge } from '../components/ui/Badge'
import Progress from '../components/ui/Progress'
import Modal from '../components/ui/Modal'
import ProjectForm from '../components/ProjectForm'
import Avatar from '../components/ui/Avatar'
import { format, parseISO } from 'date-fns'

const STATUS_OPTIONS = ['', 'planning', 'active', 'on_hold', 'completed', 'cancelled']
const HEALTH_OPTIONS = ['', 'green', 'yellow', 'red']
const PRIORITY_OPTIONS = ['', 'critical', 'high', 'medium', 'low']

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
  const [filters, setFilters] = useState({ status: '', health: '', priority: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterHealth, setFilterHealth] = useState('all')
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const fetchProjects = () => {
    const params: Record<string, string> = {}
    if (filters.status) params.status = filters.status
    if (filters.health) params.health = filters.health
    if (filters.priority) params.priority = filters.priority
    projectsApi.list(params).then(r => setProjects(r.data.projects)).finally(() => setLoading(false))
  }

  useEffect(() => { fetchProjects() }, [filters])

  const filtered = projects
    .filter(p => filterStatus === 'all' || p.status === filterStatus)
    .filter(p => filterHealth === 'all' || p.health === filterHealth)
    .filter(p =>
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

  const handleCreateProject = async (data: Partial<Project>) => {
    setSaving(true)
    try {
      await projectsApi.create(data)
      setShowCreateModal(false)
      const res = await projectsApi.list()
      setProjects(res.data.projects)
    } catch (e) {
      console.error('Failed to create project', e)
    } finally { setSaving(false) }
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">{stats.active} active · {stats.onTrack} on track · {stats.atRisk} needs attention</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5">
            <option value="all">All Status</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
          <select value={filterHealth} onChange={e => setFilterHealth(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5">
            <option value="all">All Health</option>
            <option value="green">On Track</option>
            <option value="yellow">At Risk</option>
            <option value="red">Off Track</option>
          </select>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('card')} className={`px-3 py-1.5 text-sm ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>&#x229E; Cards</button>
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-sm ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>&#x2261; List</button>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={14} /> New Project
          </button>
        </div>
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
