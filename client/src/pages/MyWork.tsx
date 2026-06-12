import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarClock, CheckCircle2, ListTodo } from 'lucide-react'
import { tasksApi } from '../api'

interface MyTask {
  id: number
  name: string
  status: string
  priority: string
  start_date: string | null
  end_date: string | null
  completion_percent: number
  story_points: number | null
  project_id: number
  project_name: string
  project_color: string
}

interface Counts { total: number; overdue: number; due_today: number; due_this_week: number }

const STATUS_OPTIONS = ['todo', 'in_progress', 'review', 'blocked', 'done']
const STATUS_LABELS: Record<string, string> = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', blocked: 'Blocked', done: 'Done' }
const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-400', low: 'bg-gray-300',
}

function groupLabelFor(task: MyTask, today: string, weekEnd: string): string {
  if (!task.end_date) return 'No due date'
  if (task.end_date < today) return 'Overdue'
  if (task.end_date === today) return 'Due today'
  if (task.end_date <= weekEnd) return 'Due this week'
  return 'Later'
}

const GROUP_ORDER = ['Overdue', 'Due today', 'Due this week', 'Later', 'No due date']
const GROUP_TONE: Record<string, string> = {
  'Overdue': 'text-red-600', 'Due today': 'text-orange-600', 'Due this week': 'text-blue-600',
  'Later': 'text-gray-600', 'No due date': 'text-gray-400',
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof ListTodo; tone: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${tone}`}><Icon size={18} /></div>
      <div>
        <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  )
}

export default function MyWork() {
  const [tasks, setTasks] = useState<MyTask[]>([])
  const [counts, setCounts] = useState<Counts>({ total: 0, overdue: 0, due_today: 0, due_this_week: 0 })
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await tasksApi.myWork()
      setTasks(res.data.tasks)
      setCounts(res.data.counts)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const setStatus = async (taskId: number, status: string) => {
    setUpdating(taskId)
    try {
      await tasksApi.updateStatus(taskId, status)
      if (status === 'done') setTasks(prev => prev.filter(t => t.id !== taskId))
      else setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
    } finally { setUpdating(null) }
  }

  if (loading) return (
    <div className="flex justify-center py-24">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const today = new Date().toISOString().slice(0, 10)
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const groups = new Map<string, MyTask[]>()
  for (const t of tasks) {
    const g = groupLabelFor(t, today, weekEnd)
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(t)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Work</h1>
        <p className="text-sm text-gray-500">Your open tasks across all active projects</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Open tasks" value={counts.total} icon={ListTodo} tone="text-blue-600 bg-blue-50" />
        <SummaryCard label="Overdue" value={counts.overdue} icon={AlertTriangle} tone="text-red-600 bg-red-50" />
        <SummaryCard label="Due today" value={counts.due_today} icon={CalendarClock} tone="text-orange-600 bg-orange-50" />
        <SummaryCard label="Due this week" value={counts.due_this_week} icon={CalendarClock} tone="text-yellow-700 bg-yellow-50" />
      </div>

      {tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CheckCircle2 size={40} className="mx-auto text-green-500 mb-3" />
          <div className="font-semibold text-gray-900">All clear!</div>
          <div className="text-sm text-gray-500">You have no open tasks assigned to you.</div>
        </div>
      ) : GROUP_ORDER.filter(g => groups.has(g)).map(group => (
        <div key={group} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className={`px-4 py-2.5 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider ${GROUP_TONE[group]}`}>
            {group} · {groups.get(group)!.length}
          </div>
          <div className="divide-y divide-gray-50">
            {groups.get(group)!.map(task => (
              <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] || 'bg-gray-300'}`} title={`${task.priority} priority`} />
                <div className="flex-1 min-w-0">
                  <Link to={`/projects/${task.project_id}/tasks`} className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate block">
                    {task.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: task.project_color }} />
                      {task.project_name}
                    </span>
                    {task.end_date && (
                      <span className={`text-xs ${group === 'Overdue' ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                        due {task.end_date}
                      </span>
                    )}
                    {task.story_points != null && <span className="text-xs text-gray-400">{task.story_points} pts</span>}
                  </div>
                </div>
                <select
                  value={task.status}
                  disabled={updating === task.id}
                  onChange={e => setStatus(task.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 disabled:opacity-50"
                >
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
