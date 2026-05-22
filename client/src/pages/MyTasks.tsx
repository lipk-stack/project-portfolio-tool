import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format, parseISO, isToday, isBefore, isThisWeek } from 'date-fns'
import { CheckCircle, Clock, AlertTriangle, Filter, ChevronDown, Target, List, Kanban } from 'lucide-react'
import { useAuthStore } from '../store'
import { tasksApi, projectsApi } from '../api'
import { Task, TaskStatus } from '../types'
import { StatusBadge, PriorityBadge } from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'

type FilterGroup = 'all' | 'today' | 'week' | 'overdue' | 'blocked'
type SortKey = 'due' | 'priority' | 'project' | 'status'

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
const STATUS_ORDER: Record<string, number> = { blocked: 0, in_progress: 1, review: 2, todo: 3, done: 4 }

function formatDate(d: string) {
  const date = parseISO(d)
  if (isToday(date)) return 'Today'
  return format(date, 'MMM d')
}

function getDueDateColor(endDate?: string, status?: TaskStatus): string {
  if (!endDate || status === 'done') return 'text-gray-400'
  const date = parseISO(endDate)
  if (isBefore(date, new Date())) return 'text-red-600 font-semibold'
  if (isToday(date)) return 'text-amber-600 font-semibold'
  return 'text-gray-500'
}

interface TaskWithProject extends Task {
  project_name?: string
  project_color?: string
  project_id: number
}

export default function MyTasks() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [allTasks, setAllTasks] = useState<TaskWithProject[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterGroup>('all')
  const [sortBy, setSortBy] = useState<SortKey>('due')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [updating, setUpdating] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      const projRes = await projectsApi.list()
      const projects: any[] = projRes.data.projects || []
      const taskArrays = await Promise.all(
        projects.map(p => tasksApi.list(p.id).then(r =>
          (r.data.tasks || []).map((t: Task) => ({
            ...t,
            project_name: p.name,
            project_color: p.color,
            project_id: p.id,
          }))
        ))
      )
      const mine = taskArrays.flat().filter((t: TaskWithProject) =>
        t.assignee_id === user?.id || t.assignee_name === user?.name
      )
      setAllTasks(mine)
    }
    load().finally(() => setLoading(false))
  }, [user])

  const filtered = useMemo(() => {
    let tasks = [...allTasks]

    if (statusFilter !== 'all') {
      tasks = tasks.filter(t => t.status === statusFilter)
    } else {
      tasks = tasks.filter(t => t.status !== 'done')
    }

    switch (filter) {
      case 'today':
        tasks = tasks.filter(t => t.end_date && isToday(parseISO(t.end_date)))
        break
      case 'week':
        tasks = tasks.filter(t => t.end_date && isThisWeek(parseISO(t.end_date), { weekStartsOn: 1 }))
        break
      case 'overdue':
        tasks = tasks.filter(t => t.end_date && isBefore(parseISO(t.end_date), new Date()) && t.status !== 'done')
        break
      case 'blocked':
        tasks = tasks.filter(t => t.status === 'blocked')
        break
    }

    tasks.sort((a, b) => {
      switch (sortBy) {
        case 'due':
          if (!a.end_date) return 1
          if (!b.end_date) return -1
          return parseISO(a.end_date).getTime() - parseISO(b.end_date).getTime()
        case 'priority':
          return (PRIORITY_ORDER[a.priority] || 9) - (PRIORITY_ORDER[b.priority] || 9)
        case 'project':
          return (a.project_name || '').localeCompare(b.project_name || '')
        case 'status':
          return (STATUS_ORDER[a.status] || 9) - (STATUS_ORDER[b.status] || 9)
        default:
          return 0
      }
    })

    return tasks
  }, [allTasks, filter, sortBy, statusFilter])

  const counts = useMemo(() => ({
    all: allTasks.filter(t => t.status !== 'done').length,
    today: allTasks.filter(t => t.end_date && isToday(parseISO(t.end_date)) && t.status !== 'done').length,
    week: allTasks.filter(t => t.end_date && isThisWeek(parseISO(t.end_date), { weekStartsOn: 1 }) && t.status !== 'done').length,
    overdue: allTasks.filter(t => t.end_date && isBefore(parseISO(t.end_date), new Date()) && t.status !== 'done').length,
    blocked: allTasks.filter(t => t.status === 'blocked').length,
  }), [allTasks])

  const handleStatusToggle = async (task: TaskWithProject) => {
    const newStatus: TaskStatus = task.status === 'done' ? 'in_progress' : 'done'
    setUpdating(task.id)
    try {
      await tasksApi.update(task.id, { ...task, status: newStatus })
      setAllTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    } finally {
      setUpdating(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {user?.name} · {counts.all} open tasks
            {counts.overdue > 0 && <span className="text-red-500 ml-2">· {counts.overdue} overdue</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="due">Sort: Due Date</option>
            <option value="priority">Sort: Priority</option>
            <option value="project">Sort: Project</option>
            <option value="status">Sort: Status</option>
          </select>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: 'all', label: 'All', count: counts.all },
          { key: 'today', label: 'Due Today', count: counts.today },
          { key: 'week', label: 'This Week', count: counts.week },
          { key: 'overdue', label: 'Overdue', count: counts.overdue },
          { key: 'blocked', label: 'Blocked', count: counts.blocked },
        ] as const).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                key === 'overdue' ? 'bg-red-100 text-red-700' :
                key === 'blocked' ? 'bg-amber-100 text-amber-700' :
                filter === key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Status quick filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 font-medium">Status:</span>
        {(['all', 'in_progress', 'review', 'todo', 'blocked'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-colors capitalize ${
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'all' ? 'All Statuses' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Tasks list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle size={40} className="mx-auto mb-3 text-green-400" />
          <p className="text-lg font-medium text-gray-600">All caught up!</p>
          <p className="text-sm text-gray-400 mt-1">No tasks match your current filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {filtered.map(task => {
              const isDone = task.status === 'done'
              const dueDateColor = getDueDateColor(task.end_date, task.status)
              return (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors group ${isDone ? 'opacity-60' : ''}`}
                >
                  {/* Check button */}
                  <button
                    onClick={() => handleStatusToggle(task)}
                    disabled={updating === task.id}
                    className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 transition-colors ${
                      isDone
                        ? 'border-green-500 bg-green-500 flex items-center justify-center'
                        : 'border-gray-300 hover:border-green-400'
                    }`}
                  >
                    {isDone && <CheckCircle size={12} className="text-white" />}
                    {updating === task.id && <div className="w-3 h-3 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => navigate(`/projects/${task.project_id}`)}
                        className={`text-sm font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-900 hover:text-blue-600'}`}
                      >
                        {task.name}
                      </button>
                      <PriorityBadge priority={task.priority} />
                      {task.status === 'blocked' && (
                        <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                          <AlertTriangle size={12} /> Blocked
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {/* Project link */}
                      <Link
                        to={`/projects/${task.project_id}`}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600"
                      >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: task.project_color || '#94a3b8' }} />
                        {task.project_name}
                      </Link>
                      {task.estimated_hours > 0 && (
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <Clock size={10} /> {task.estimated_hours}h est
                          {task.actual_hours > 0 && ` · ${task.actual_hours}h actual`}
                        </span>
                      )}
                      {task.story_points && (
                        <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-medium">{task.story_points}sp</span>
                      )}
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex-shrink-0 flex items-center gap-3">
                    <StatusBadge status={task.status} />
                    {task.end_date && (
                      <div className={`text-xs ${dueDateColor} flex items-center gap-1`}>
                        <Clock size={11} />
                        {formatDate(task.end_date)}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">{task.completion_percent}%</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      {allTasks.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 flex flex-wrap gap-6">
          <span>{allTasks.filter(t => t.status === 'done').length} completed tasks (all time)</span>
          <span>{counts.all} open tasks</span>
          {counts.overdue > 0 && <span className="text-red-500 font-medium">{counts.overdue} overdue</span>}
          <span>Across {new Set(allTasks.map(t => t.project_id)).size} projects</span>
        </div>
      )}
    </div>
  )
}
