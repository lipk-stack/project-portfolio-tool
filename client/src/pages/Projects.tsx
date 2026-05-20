import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, Grid3X3, List, ChevronRight, ArrowUpDown, ChevronUp, ChevronDown, Download } from 'lucide-react'
import { projectsApi, portfoliosApi } from '../api'
import { Project } from '../types'
import { HealthBadge, PriorityBadge, StatusBadge } from '../components/ui/Badge'
import Progress from '../components/ui/Progress'
import Modal from '../components/ui/Modal'
import ProjectForm from '../components/forms/ProjectForm'
import { format, parseISO } from 'date-fns'

const STATUS_OPTIONS = ['', 'planning', 'active', 'on_hold', 'completed', 'cancelled']
const HEALTH_OPTIONS = ['', 'green', 'yellow', 'red']
const PRIORITY_OPTIONS = ['', 'critical', 'high', 'medium', 'low']
const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
const HEALTH_ORDER: Record<string, number> = { red: 0, yellow: 1, green: 2 }

type SortField = 'name' | 'status' | 'health' | 'priority' | 'completion_percent' | 'budget' | 'end_date' | 'updated_at'
type SortDir = 'asc' | 'desc'

function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n}`
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [portfolios, setPortfolios] = useState<Array<{ id: number; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'list'>('list')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: '', health: '', priority: '', portfolio_id: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [sortField, setSortField] = useState<SortField>('priority')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const navigate = useNavigate()

  const fetchProjects = () => {
    const params: Record<string, string> = {}
    if (filters.status) params.status = filters.status
    if (filters.health) params.health = filters.health
    if (filters.priority) params.priority = filters.priority
    if (filters.portfolio_id) params.portfolio_id = filters.portfolio_id
    projectsApi.list(params).then(r => setProjects(r.data.projects)).finally(() => setLoading(false))
  }

  useEffect(() => { fetchProjects() }, [filters])
  useEffect(() => { portfoliosApi.list().then(r => setPortfolios(r.data.portfolios)) }, [])

  const filtered = useMemo(() => {
    const searched = projects.filter(p =>
      !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase())
    )
    return [...searched].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'status': cmp = a.status.localeCompare(b.status); break
        case 'health': cmp = (HEALTH_ORDER[a.health] ?? 2) - (HEALTH_ORDER[b.health] ?? 2); break
        case 'priority': cmp = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2); break
        case 'completion_percent': cmp = a.completion_percent - b.completion_percent; break
        case 'budget': cmp = (a.budget || 0) - (b.budget || 0); break
        case 'end_date': cmp = (a.end_date || '9999').localeCompare(b.end_date || '9999'); break
        case 'updated_at': cmp = a.updated_at.localeCompare(b.updated_at); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [projects, search, sortField, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-gray-300" />
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-blue-500" /> : <ChevronDown size={12} className="text-blue-500" />
  }

  const exportCSV = () => {
    const rows = [
      ['Name', 'Status', 'Health', 'Priority', 'Progress%', 'Budget', 'Spent', 'Start Date', 'End Date', 'Manager', 'Portfolio'],
      ...filtered.map(p => [
        p.name, p.status, p.health, p.priority, String(p.completion_percent),
        String(p.budget || 0), String(p.spent || 0),
        p.start_date || '', p.end_date || '',
        (p as any).manager_name || '', (p as any).portfolio_name || '',
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `projects-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

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
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
            <Download size={14} /> Export
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={16} /> New Project
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
          <select value={filters.portfolio_id} onChange={e => setFilters(f => ({ ...f, portfolio_id: e.target.value }))} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Portfolios</option>
            {portfolios.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </select>
          <button onClick={() => setFilters({ status: '', health: '', priority: '', portfolio_id: '' })} className="text-sm text-red-500 hover:text-red-700 ml-auto">Clear Filters</button>
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
                {([
                  { label: 'Project', field: 'name' as SortField },
                  { label: 'Status', field: 'status' as SortField },
                  { label: 'Health', field: 'health' as SortField },
                  { label: 'Progress', field: 'completion_percent' as SortField },
                ] as const).map(col => (
                  <th key={col.field} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">
                    <button onClick={() => toggleSort(col.field)} className="flex items-center gap-1 hover:text-gray-700 transition-colors">
                      {col.label} <SortIcon field={col.field} />
                    </button>
                  </th>
                ))}
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider hidden md:table-cell">
                  <button onClick={() => toggleSort('budget')} className="flex items-center gap-1 hover:text-gray-700 transition-colors">Budget <SortIcon field="budget" /></button>
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider hidden lg:table-cell">
                  <button onClick={() => toggleSort('end_date')} className="flex items-center gap-1 hover:text-gray-700 transition-colors">Due Date <SortIcon field="end_date" /></button>
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">
                  <button onClick={() => toggleSort('priority')} className="flex items-center gap-1 hover:text-gray-700 transition-colors">Priority <SortIcon field="priority" /></button>
                </th>
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
