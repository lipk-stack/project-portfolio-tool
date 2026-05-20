import { useEffect, useState } from 'react'
import { GitBranch, Plus, ChevronDown, ChevronRight, Target, Clock, CheckCircle, TrendingUp, Zap } from 'lucide-react'
import { sprintsApi, projectsApi } from '../api'
import { Sprint, Project } from '../types'
import Card from '../components/ui/Card'
import Progress from '../components/ui/Progress'
import Modal from '../components/ui/Modal'
import { format, parseISO, differenceInDays } from 'date-fns'
import { useToast } from '../components/ui/Toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const STATUS_COLORS = {
  planning: 'bg-gray-100 text-gray-700',
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
}

function BurndownWidget({ sprintId }: { sprintId: number }) {
  const [data, setData] = useState<{ burndown: any[]; totalPoints: number; completedPoints: number } | null>(null)

  useEffect(() => {
    sprintsApi.burndown(sprintId).then(r => setData(r.data)).catch(() => {})
  }, [sprintId])

  if (!data || data.totalPoints === 0) return <div className="text-xs text-gray-400 text-center py-4">No story points tracked</div>

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
        <span>{data.completedPoints} / {data.totalPoints} points completed</span>
        <span>{Math.round((data.completedPoints / data.totalPoints) * 100)}%</span>
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={data.burndown} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9 }} />
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <Tooltip formatter={(v: any) => [v, '']} labelFormatter={l => `Date: ${l}`} />
          <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeDasharray="4 4" dot={false} name="Ideal" />
          <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} dot={false} name="Actual" connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function SprintCard({ sprint, expanded, onToggle }: { sprint: Sprint; expanded: boolean; onToggle: () => void }) {
  const pct = sprint.total_points ? Math.round((sprint.completed_points || 0) / sprint.total_points * 100) : 0
  const daysLeft = sprint.end_date ? differenceInDays(parseISO(sprint.end_date), new Date()) : null

  return (
    <Card padding="none">
      <div className="px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="text-gray-400">{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{sprint.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[sprint.status]}`}>{sprint.status}</span>
              </div>
              {sprint.goal && <div className="text-xs text-gray-500 mt-0.5">{sprint.goal}</div>}
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-right hidden md:block">
              <div className="text-xs text-gray-400">Duration</div>
              <div className="font-medium text-gray-700">
                {sprint.start_date && sprint.end_date
                  ? `${format(parseISO(sprint.start_date), 'MMM d')} – ${format(parseISO(sprint.end_date), 'MMM d')}`
                  : '—'}
              </div>
            </div>
            {sprint.status === 'active' && daysLeft !== null && (
              <div className="text-right">
                <div className="text-xs text-gray-400">Days Left</div>
                <div className={`font-bold ${daysLeft <= 2 ? 'text-red-600' : daysLeft <= 5 ? 'text-yellow-600' : 'text-gray-700'}`}>{Math.max(0, daysLeft)}</div>
              </div>
            )}
            <div className="text-right">
              <div className="text-xs text-gray-400">Tasks</div>
              <div className="font-medium text-gray-700">{sprint.done_count || 0}/{sprint.task_count || 0}</div>
            </div>
            <div className="text-right hidden md:block">
              <div className="text-xs text-gray-400">Points</div>
              <div className="font-medium text-gray-700">{sprint.completed_points || 0}/{sprint.total_points || 0}</div>
            </div>
            <div className="w-20">
              <Progress value={pct} size="sm" color={pct === 100 ? 'green' : sprint.status === 'active' ? 'blue' : 'blue'} showLabel />
            </div>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="px-5 pb-4 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-4 mt-4 mb-2">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{sprint.completed_points || 0}</div>
              <div className="text-xs text-blue-600 mt-0.5">Points Done</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">{sprint.capacity || 0}</div>
              <div className="text-xs text-purple-600 mt-0.5">Capacity</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{sprint.velocity || 0}</div>
              <div className="text-xs text-green-600 mt-0.5">Velocity</div>
            </div>
          </div>
          <BurndownWidget sprintId={sprint.id} />
        </div>
      )}
    </Card>
  )
}

interface SprintFormData {
  name: string
  goal: string
  start_date: string
  end_date: string
  capacity: string
  project_id: string
}

export default function Sprints() {
  const [sprints, setSprints] = useState<(Sprint & { project_name?: string; project_color?: string })[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<SprintFormData>({ name: '', goal: '', start_date: '', end_date: '', capacity: '80', project_id: '' })
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'planning' | 'completed'>('all')
  const toast = useToast()

  useEffect(() => {
    Promise.all([
      projectsApi.list({ status: 'active' }),
    ]).then(([projRes]) => {
      const activeProjects = projRes.data.projects as Project[]
      setProjects(activeProjects)
      // Load sprints for all active projects
      return Promise.all(activeProjects.map(p => sprintsApi.list(p.id).then(r => ({
        projectId: p.id,
        projectName: p.name,
        projectColor: p.color,
        sprints: r.data.sprints as Sprint[],
      }))))
    }).then(results => {
      const all = results.flatMap(r => r.sprints.map(s => ({
        ...s,
        project_name: r.projectName,
        project_color: r.projectColor,
      })))
      setSprints(all)
      // Auto-expand active sprints
      setExpanded(new Set(all.filter(s => s.status === 'active').map(s => s.id)))
    }).finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!form.name || !form.project_id) return
    setSaving(true)
    try {
      const res = await sprintsApi.create(Number(form.project_id), {
        name: form.name, goal: form.goal,
        start_date: form.start_date, end_date: form.end_date,
        capacity: Number(form.capacity),
      })
      const project = projects.find(p => p.id === Number(form.project_id))
      setSprints(prev => [...prev, {
        ...res.data.sprint,
        project_name: project?.name,
        project_color: project?.color,
      }])
      setShowForm(false)
      setForm({ name: '', goal: '', start_date: '', end_date: '', capacity: '80', project_id: '' })
      toast.success('Sprint created')
    } catch {
      toast.error('Failed to create sprint')
    } finally {
      setSaving(false)
    }
  }

  const filtered = sprints.filter(s => filter === 'all' || s.status === filter)
  const activeSprints = sprints.filter(s => s.status === 'active')
  const totalVelocity = activeSprints.reduce((s, sp) => s + (sp.completed_points || 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sprint Board</h1>
          <p className="text-sm text-gray-500 mt-0.5">Agile sprint management across all projects</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> New Sprint
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Sprints', value: activeSprints.length, icon: Zap, color: 'bg-blue-500 text-blue-500' },
          { label: 'Total Sprints', value: sprints.length, icon: GitBranch, color: 'bg-purple-500 text-purple-500' },
          { label: 'Velocity (pts)', value: totalVelocity, icon: TrendingUp, color: 'bg-green-500 text-green-500' },
          { label: 'Completed', value: sprints.filter(s => s.status === 'completed').length, icon: CheckCircle, color: 'bg-gray-500 text-gray-500' },
        ].map(stat => (
          <Card key={stat.label} className="relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-16 h-16 rounded-full opacity-10 -translate-y-1/2 translate-x-1/2 ${stat.color.split(' ')[0]}`} />
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-opacity-10 ${stat.color.split(' ')[0]} bg-opacity-10`}>
              <stat.icon size={18} className={stat.color.split(' ')[1]} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{stat.label}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(['all', 'active', 'planning', 'completed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-sm rounded-lg font-medium capitalize transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Group by project */}
      {projects.filter(p => filtered.some(s => s.project_name === p.name)).map(project => {
        const projectSprints = filtered.filter(s => s.project_name === project.name)
        if (projectSprints.length === 0) return null
        return (
          <div key={project.id}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
              <h2 className="font-semibold text-gray-800">{project.name}</h2>
              <span className="text-xs text-gray-400">{projectSprints.length} sprint{projectSprints.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-3">
              {projectSprints.map(sprint => (
                <SprintCard
                  key={sprint.id}
                  sprint={sprint}
                  expanded={expanded.has(sprint.id)}
                  onToggle={() => setExpanded(prev => {
                    const next = new Set(prev)
                    next.has(sprint.id) ? next.delete(sprint.id) : next.add(sprint.id)
                    return next
                  })}
                />
              ))}
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <GitBranch size={40} className="mx-auto mb-3 opacity-30" />
          <p>No sprints found. Create your first sprint!</p>
        </div>
      )}

      {/* Create Sprint Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Create New Sprint" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
            <select
              value={form.project_id}
              onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sprint Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Sprint 5"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sprint Goal</label>
            <input
              type="text"
              value={form.goal}
              onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
              placeholder="What should be achieved in this sprint?"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Capacity (hours)</label>
            <input
              type="number"
              value={form.capacity}
              onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Sprint'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
