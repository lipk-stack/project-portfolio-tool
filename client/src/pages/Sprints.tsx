import { useCallback, useEffect, useState } from 'react'
import { projectsApi, sprintsApi, tasksApi } from '../api'
import Card, { CardHeader } from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { Rocket, Plus, ArrowRight, ArrowLeft, CheckCircle2, Play, Flag, Trash2 } from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'

interface Project { id: number; name: string; status: string; color: string }

interface Sprint {
  id: number
  name: string
  goal: string | null
  start_date: string | null
  end_date: string | null
  status: 'planned' | 'active' | 'completed'
  task_count: number
  done_count: number
  total_points: number
  done_points: number
}

interface SprintTask {
  id: number
  name: string
  status: string
  priority: string
  story_points: number | null
  sprint_id: number | null
  assignee_name: string | null
}

interface BurndownDay { date: string; ideal: number; actual: number | null }
interface VelocityEntry { sprint_id: number; name: string; committed: number; completed: number }

const statusVariant: Record<string, 'gray' | 'default' | 'success'> = {
  planned: 'gray', active: 'default', completed: 'success',
}

const taskStatusVariant: Record<string, 'gray' | 'default' | 'warning' | 'success' | 'danger'> = {
  todo: 'gray', in_progress: 'default', review: 'warning', done: 'success', blocked: 'danger',
}

export default function Sprints() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState<number | null>(null)
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [tasks, setTasks] = useState<SprintTask[]>([])
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null)
  const [burndown, setBurndown] = useState<BurndownDay[]>([])
  const [velocity, setVelocity] = useState<VelocityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', goal: '', start_date: '', end_date: '' })

  useEffect(() => {
    projectsApi.list().then(r => {
      const all: Project[] = r.data.projects
      setProjects(all)
      const firstActive = all.find(p => p.status === 'active') || all[0]
      if (firstActive) setProjectId(firstActive.id)
      else setLoading(false)
    })
  }, [])

  const refresh = useCallback(async (pid: number, keepSprint = false) => {
    const [sRes, tRes, vRes] = await Promise.all([
      sprintsApi.list(pid),
      tasksApi.list(pid),
      sprintsApi.velocity(pid),
    ])
    const sp: Sprint[] = sRes.data.sprints
    setSprints(sp)
    setTasks(tRes.data.tasks)
    setVelocity(vRes.data.velocity)
    setSelectedSprintId(prev => {
      if (keepSprint && prev && sp.some(s => s.id === prev)) return prev
      const active = sp.find(s => s.status === 'active') || sp[sp.length - 1]
      return active ? active.id : null
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    if (projectId) {
      setLoading(true)
      refresh(projectId)
    }
  }, [projectId, refresh])

  useEffect(() => {
    if (selectedSprintId) {
      sprintsApi.burndown(selectedSprintId).then(r => setBurndown(r.data.days))
    } else {
      setBurndown([])
    }
  }, [selectedSprintId, tasks])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const sprint = sprints.find(s => s.id === selectedSprintId) || null
  const backlog = tasks.filter(t => !t.sprint_id && t.status !== 'done')
  const sprintTasks = tasks.filter(t => t.sprint_id === selectedSprintId)
  const backlogPoints = backlog.reduce((s, t) => s + (t.story_points || 0), 0)

  const moveToSprint = async (taskId: number) => {
    if (!selectedSprintId || !projectId) return
    await sprintsApi.assignTasks(selectedSprintId, [taskId])
    refresh(projectId, true)
  }

  const moveToBacklog = async (taskId: number) => {
    if (!projectId) return
    await sprintsApi.unassignTask(taskId)
    refresh(projectId, true)
  }

  const setSprintStatus = async (status: string) => {
    if (!sprint || !projectId) return
    await sprintsApi.update(sprint.id, { status })
    refresh(projectId, true)
  }

  const deleteSprint = async () => {
    if (!sprint || !projectId) return
    if (!window.confirm(`Delete "${sprint.name}"? Its tasks return to the backlog.`)) return
    await sprintsApi.delete(sprint.id)
    refresh(projectId)
  }

  const createSprint = async () => {
    if (!projectId || !form.name) return
    await sprintsApi.create(projectId, form)
    setShowCreate(false)
    setForm({ name: '', goal: '', start_date: '', end_date: '' })
    refresh(projectId, true)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sprints</h1>
          <p className="text-sm text-gray-500">Agile planning, burndown and velocity</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={projectId ?? ''}
            onChange={e => setProjectId(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} /> New Sprint
          </button>
        </div>
      </div>

      {/* Sprint tabs */}
      {sprints.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {sprints.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSprintId(s.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                s.id === selectedSprintId
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <Rocket size={14} />
              {s.name}
              <Badge variant={statusVariant[s.status] || 'gray'}>{s.status}</Badge>
            </button>
          ))}
        </div>
      ) : (
        <Card>
          <div className="py-10 text-center text-gray-500 text-sm">
            No sprints yet for this project. Create one to start agile planning.
          </div>
        </Card>
      )}

      {sprint && (
        <>
          {/* Sprint header */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">{sprint.name}</h2>
                  <Badge variant={statusVariant[sprint.status] || 'gray'} dot>{sprint.status}</Badge>
                </div>
                {sprint.goal && <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5"><Flag size={14} /> {sprint.goal}</p>}
                <p className="text-xs text-gray-400 mt-1">{sprint.start_date} → {sprint.end_date}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{sprint.done_points}<span className="text-sm font-normal text-gray-400"> / {sprint.total_points}</span></div>
                  <div className="text-xs text-gray-500">points done</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{sprint.done_count}<span className="text-sm font-normal text-gray-400"> / {sprint.task_count}</span></div>
                  <div className="text-xs text-gray-500">tasks done</div>
                </div>
                <div className="flex items-center gap-2">
                  {sprint.status === 'planned' && (
                    <button onClick={() => setSprintStatus('active')} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                      <Play size={13} /> Start Sprint
                    </button>
                  )}
                  {sprint.status === 'active' && (
                    <button onClick={() => setSprintStatus('completed')} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                      <CheckCircle2 size={13} /> Complete Sprint
                    </button>
                  )}
                  <button onClick={deleteSprint} title="Delete sprint" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Backlog + sprint tasks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title={`Backlog (${backlog.length} tasks · ${backlogPoints} pts)`} />
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {backlog.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Backlog is empty</p>}
                {backlog.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 p-2.5 border border-gray-200 rounded-lg hover:border-gray-300">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{t.name}</div>
                      <div className="text-xs text-gray-400">{t.assignee_name || 'Unassigned'}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {t.story_points != null && <Badge variant="info">{t.story_points} pts</Badge>}
                      <button
                        onClick={() => moveToSprint(t.id)}
                        title="Move to sprint"
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title={`Sprint Tasks (${sprintTasks.length})`} />
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {sprintTasks.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No tasks in this sprint — pull some from the backlog</p>}
                {sprintTasks.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 p-2.5 border border-gray-200 rounded-lg hover:border-gray-300">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={() => moveToBacklog(t.id)}
                        title="Return to backlog"
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg flex-shrink-0"
                      >
                        <ArrowLeft size={15} />
                      </button>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{t.name}</div>
                        <div className="text-xs text-gray-400">{t.assignee_name || 'Unassigned'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {t.story_points != null && <Badge variant="info">{t.story_points} pts</Badge>}
                      <Badge variant={taskStatusVariant[t.status] || 'gray'}>{t.status.replace('_', ' ')}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Burndown" />
              {burndown.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={burndown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                    <Line type="stepAfter" dataKey="actual" name="Remaining" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 2 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-400 py-10 text-center">Set sprint dates to see the burndown</p>
              )}
            </Card>

            <Card>
              <CardHeader title="Velocity (committed vs completed)" />
              {velocity.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={velocity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="committed" name="Committed" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-400 py-10 text-center">Complete a sprint to see velocity</p>
              )}
            </Card>
          </div>
        </>
      )}

      {/* Create sprint modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Sprint"
        footer={
          <>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={createSprint} disabled={!form.name} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create Sprint</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Sprint 4 — Checkout flow"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Goal</label>
            <input
              value={form.goal}
              onChange={e => setForm({ ...form, goal: e.target.value })}
              placeholder="What should this sprint achieve?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
              <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
              <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
