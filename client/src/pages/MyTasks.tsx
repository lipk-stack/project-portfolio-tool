import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { tasksApi } from '../api'
import { useAuthStore } from '../store'
import Avatar from '../components/ui/Avatar'
import { CheckCircle, Circle, AlertTriangle, Clock, CalendarDays, Inbox, Zap } from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface MyTask {
  id: number; name: string; status: string; priority: string
  end_date: string | null; completion_percent: number
  project_id: number; project_name: string; project_color: string
  story_points: number | null; sprint: string | null
}

interface Grouped {
  overdue: MyTask[]; today: MyTask[]; upcoming: MyTask[]; later: MyTask[]
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-600 bg-red-50', high: 'text-orange-600 bg-orange-50',
  medium: 'text-blue-600 bg-blue-50', low: 'text-gray-500 bg-gray-50'
}

function TaskRow({ task, onComplete, onNavigate }: { task: MyTask; onComplete: (id: number) => void; onNavigate: (t: MyTask) => void }) {
  const [done, setDone] = useState(false)
  const handleComplete = () => {
    setDone(true)
    setTimeout(() => onComplete(task.id), 400)
  }
  return (
    <div className={`flex items-center gap-3 py-2.5 px-4 rounded-xl transition-all ${done ? 'opacity-0 scale-95' : 'hover:bg-gray-50'}`}>
      <button onClick={handleComplete} className="flex-shrink-0 text-gray-300 hover:text-green-500 transition-colors">
        {done ? <CheckCircle size={18} className="text-green-500" /> : <Circle size={18} />}
      </button>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onNavigate(task)}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800 truncate">{task.name}</span>
          {task.story_points && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">{task.story_points}pt</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: task.project_color }} />
          <span className="text-xs text-gray-400 truncate">{task.project_name}</span>
          {task.sprint && <span className="text-xs text-gray-400">· {task.sprint}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[task.priority] || 'bg-gray-50 text-gray-500'}`}>
          {task.priority}
        </span>
        {task.end_date && (
          <span className="text-xs text-gray-400">{format(parseISO(task.end_date), 'MMM d')}</span>
        )}
      </div>
    </div>
  )
}

function Section({ icon: Icon, label, color, tasks, onComplete, onNavigate }: {
  icon: any; label: string; color: string; tasks: MyTask[]
  onComplete: (id: number) => void; onNavigate: (t: MyTask) => void
}) {
  const [open, setOpen] = useState(true)
  if (tasks.length === 0) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-5 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
        <Icon size={15} className={color} />
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-1 ${color.replace('text-', 'bg-').replace('-600', '-100').replace('-500', '-100')} ${color}`}>{tasks.length}</span>
        <span className="ml-auto text-gray-300 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="py-1">
          {tasks.map(t => <TaskRow key={t.id} task={t} onComplete={onComplete} onNavigate={onNavigate} />)}
        </div>
      )}
    </div>
  )
}

export default function MyTasks() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [grouped, setGrouped] = useState<Grouped>({ overdue: [], today: [], upcoming: [], later: [] })
  const [completedThisWeek, setCompletedThisWeek] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'critical' | 'high'>('all')

  const load = () => {
    api.get('/tasks/mine').then(r => {
      setGrouped(r.data.grouped)
      setCompletedThisWeek(r.data.completedThisWeek)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleComplete = async (id: number) => {
    await tasksApi.update(id, { status: 'done', completion_percent: 100 })
    load()
  }

  const handleNavigate = (t: MyTask) => navigate(`/projects/${t.project_id}/tasks`)

  const filterTasks = (tasks: MyTask[]) =>
    filter === 'all' ? tasks : tasks.filter(t => t.priority === filter)

  const totalOpen = grouped.overdue.length + grouped.today.length + grouped.upcoming.length + grouped.later.length

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            {user && <Avatar name={user.name} size="md" />}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
              <p className="text-sm text-gray-500 mt-0.5">{totalOpen} open · {completedThisWeek} completed this week</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {(['all', 'critical', 'high'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: AlertTriangle, label: 'Overdue', value: grouped.overdue.length, color: 'text-red-600', bg: 'bg-red-50' },
          { icon: Zap, label: 'Due Today', value: grouped.today.length, color: 'text-orange-600', bg: 'bg-orange-50' },
          { icon: CalendarDays, label: 'This Week', value: grouped.upcoming.length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { icon: CheckCircle, label: 'Done (7d)', value: completedThisWeek, color: 'text-green-600', bg: 'bg-green-50' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center mx-auto mb-1.5`}>
              <s.icon size={15} className={s.color} />
            </div>
            <div className="text-xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {totalOpen === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Inbox size={40} className="mx-auto text-gray-200 mb-3" />
          <div className="text-lg font-semibold text-gray-600 mb-1">All clear!</div>
          <div className="text-sm text-gray-400">No open tasks assigned to you</div>
        </div>
      ) : (
        <>
          <Section icon={AlertTriangle} label="Overdue" color="text-red-600" tasks={filterTasks(grouped.overdue)} onComplete={handleComplete} onNavigate={handleNavigate} />
          <Section icon={Zap} label="Due Today" color="text-orange-600" tasks={filterTasks(grouped.today)} onComplete={handleComplete} onNavigate={handleNavigate} />
          <Section icon={CalendarDays} label="Upcoming (next 7 days)" color="text-blue-600" tasks={filterTasks(grouped.upcoming)} onComplete={handleComplete} onNavigate={handleNavigate} />
          <Section icon={Clock} label="Later" color="text-gray-500" tasks={filterTasks(grouped.later)} onComplete={handleComplete} onNavigate={handleNavigate} />
        </>
      )}
    </div>
  )
}
