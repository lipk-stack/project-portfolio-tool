import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Edit, Trash2, ChevronRight, BarChart2, Calendar, Users, DollarSign, AlertTriangle, GitBranch, List, Kanban, Clock, CheckCircle, Zap, TrendingDown, FileText } from 'lucide-react'
import { projectsApi, tasksApi, risksApi, budgetApi } from '../api'
import { Project, Task, Risk, BudgetLine, Milestone, TaskStatus } from '../types'
import { HealthBadge, PriorityBadge, StatusBadge } from '../components/ui/Badge'
import Progress from '../components/ui/Progress'
import Modal from '../components/ui/Modal'
import GanttChart from '../components/gantt/GanttChart'
import KanbanBoard from '../components/kanban/KanbanBoard'
import TaskForm from '../components/forms/TaskForm'
import SprintBoard from '../components/SprintBoard'
import BurndownChart from '../components/BurndownChart'
import VelocityChart from '../components/VelocityChart'
import RiskMatrix from '../components/RiskMatrix'
import TaskComments from '../components/TaskComments'
import TimeTracker from '../components/TimeTracker'
import Avatar from '../components/ui/Avatar'
import { format, parseISO } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'

type Tab = 'overview' | 'tasks' | 'gantt' | 'sprint' | 'budget' | 'risks' | 'team'

function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n}`
}

const RISK_MATRIX_LABELS = { low: 1, medium: 2, high: 3 }
const BUDGET_COLORS: Record<string, string> = { labor: '#3b82f6', materials: '#10b981', infrastructure: '#8b5cf6', software: '#f59e0b', equipment: '#06b6d4', travel: '#ec4899', overhead: '#6366f1', other: '#94a3b8' }

export default function ProjectDetail() {
  const { id, tab } = useParams<{ id: string; tab?: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>((tab as Tab) || 'overview')
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [risks, setRisks] = useState<Risk[]>([])
  const [budget, setBudget] = useState<{ lines: BudgetLine[]; byCategory: Array<{ category: string; planned: number; actual: number }>; project: { budget: number; spent: number } } | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [members, setMembers] = useState<Array<{ id: number; name: string; email: string; role: string; allocation_percent: number; department?: string }>>([])
  const [taskStats, setTaskStats] = useState<{ total: number; done: number; in_progress: number; blocked: number; total_estimated: number; total_actual: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [taskView, setTaskView] = useState<'kanban' | 'list'>('kanban')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [savingTask, setSavingTask] = useState(false)
  const [defaultTaskStatus, setDefaultTaskStatus] = useState<TaskStatus>('todo')

  const loadProject = useCallback(async () => {
    if (!id) return
    const [projRes, tasksRes, risksRes, budgetRes] = await Promise.all([
      projectsApi.get(Number(id)),
      tasksApi.list(Number(id)),
      risksApi.list(Number(id)),
      budgetApi.get(Number(id)),
    ])
    setProject(projRes.data.project)
    setTasks(tasksRes.data.tasks)
    setRisks(risksRes.data.risks)
    setBudget(budgetRes.data)
    setMilestones(projRes.data.milestones)
    setMembers(projRes.data.members)
    setTaskStats(projRes.data.taskStats)
  }, [id])

  useEffect(() => {
    setLoading(true)
    loadProject().finally(() => setLoading(false))
  }, [loadProject])

  const handleTaskUpdate = async (taskId: number, status: TaskStatus) => {
    await tasksApi.update(taskId, { ...tasks.find(t => t.id === taskId), status })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
  }

  const handleTaskSave = async (data: Partial<Task>) => {
    setSavingTask(true)
    try {
      if (editTask?.id) {
        await tasksApi.update(editTask.id, data)
      } else {
        await tasksApi.create(Number(id), data)
      }
      setShowTaskForm(false)
      setEditTask(null)
      await loadProject()
    } finally { setSavingTask(false) }
  }

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Delete this task?')) return
    await tasksApi.delete(taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!project) return <div className="text-center text-gray-400 py-12">Project not found</div>

  const TABS = [
    { id: 'overview' as Tab, label: 'Overview', icon: BarChart2 },
    { id: 'tasks' as Tab, label: 'Tasks', icon: List },
    { id: 'gantt' as Tab, label: 'Gantt', icon: GitBranch },
    { id: 'sprint' as Tab, label: 'Sprint', icon: Zap },
    { id: 'budget' as Tab, label: 'Budget', icon: DollarSign },
    { id: 'risks' as Tab, label: `Risks (${risks.filter(r => r.status !== 'closed').length})`, icon: AlertTriangle },
    { id: 'team' as Tab, label: 'Team', icon: Users },
  ]

  const budgetPct = project.budget > 0 ? Math.round((project.spent / project.budget) * 100) : 0

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb & header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link to="/projects" className="hover:text-gray-700">Projects</Link>
          <ChevronRight size={14} />
          <span className="text-gray-900 font-medium">{project.name}</span>
        </div>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-4 h-12 rounded-full" style={{ backgroundColor: project.color }} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <StatusBadge status={project.status} />
                <HealthBadge health={project.health} />
                <PriorityBadge priority={project.priority} />
                {project.phase && <span className="text-sm text-gray-500 capitalize">{project.phase}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`/projects/${id}/status-report`}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileText size={14} />
              Status Report
            </Link>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{project.completion_percent}%</div>
              <div className="text-xs text-gray-400">Complete</div>
            </div>
            <div className="w-16 h-16">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={project.color} strokeWidth="3"
                  strokeDasharray={`${project.completion_percent} ${100 - project.completion_percent}`}
                  strokeDashoffset="0" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500 mb-1">Budget</div>
          <div className="font-bold text-gray-900">{formatCurrency(project.budget)}</div>
          <Progress value={budgetPct} size="sm" color={budgetPct > 90 ? 'red' : 'blue'} className="mt-1" />
          <div className="text-xs text-gray-400 mt-1">{formatCurrency(project.spent)} spent ({budgetPct}%)</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500 mb-1">Tasks</div>
          <div className="font-bold text-gray-900">{taskStats?.done || 0} / {taskStats?.total || 0}</div>
          <div className="text-xs text-gray-400 mt-1">{taskStats?.in_progress || 0} in progress · {taskStats?.blocked || 0} blocked</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500 mb-1">Timeline</div>
          <div className="font-bold text-gray-900">{project.end_date ? format(parseISO(project.end_date), 'MMM d, yyyy') : '—'}</div>
          <div className="text-xs text-gray-400 mt-1">{project.start_date ? `Started ${format(parseISO(project.start_date), 'MMM d')}` : 'No start date'}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500 mb-1">Team</div>
          <div className="font-bold text-gray-900">{members.length} members</div>
          <div className="flex -space-x-1 mt-1">
            {members.slice(0, 5).map(m => <Avatar key={m.id} name={m.name} size="xs" className="ring-2 ring-white" />)}
            {members.length > 5 && <div className="w-6 h-6 rounded-full bg-gray-200 ring-2 ring-white flex items-center justify-center text-xs text-gray-600">+{members.length - 5}</div>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-8 space-y-5">
            {project.description && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{project.description}</p>
              </div>
            )}
            {/* Milestones */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Calendar size={16} className="text-gray-400" /> Milestones</h3>
              {milestones.length === 0 ? (
                <p className="text-sm text-gray-400">No milestones defined</p>
              ) : (
                <div className="relative pl-4">
                  <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-gray-200" />
                  {milestones.map(m => (
                    <div key={m.id} className="relative flex items-start gap-3 pb-4">
                      <div className={`absolute -left-2 w-4 h-4 rounded-full border-2 ${m.status === 'achieved' ? 'bg-green-500 border-green-500' : m.status === 'missed' ? 'bg-red-500 border-red-500' : 'bg-white border-blue-500'} flex-shrink-0 mt-0.5`} />
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-800">{m.name}</div>
                        <div className="text-xs text-gray-400">{format(parseISO(m.date), 'MMMM d, yyyy')} · {m.status}</div>
                        {m.description && <div className="text-xs text-gray-500 mt-0.5">{m.description}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="col-span-12 lg:col-span-4 space-y-5">
            {/* Risk summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-orange-400" /> Risk Summary</h3>
              <div className="space-y-2">
                {[{ label: 'High Risk', count: risks.filter(r => r.score >= 6 && r.status !== 'closed').length, color: 'text-red-600 bg-red-50' },
                  { label: 'Medium Risk', count: risks.filter(r => r.score >= 3 && r.score < 6 && r.status !== 'closed').length, color: 'text-yellow-600 bg-yellow-50' },
                  { label: 'Low Risk', count: risks.filter(r => r.score < 3 && r.status !== 'closed').length, color: 'text-green-600 bg-green-50' },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{r.label}</span>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded ${r.color}`}>{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Team */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Users size={16} className="text-gray-400" /> Team</h3>
              <div className="space-y-2">
                {members.slice(0, 6).map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <Avatar name={m.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 truncate">{m.name}</div>
                      <div className="text-xs text-gray-400 capitalize">{m.role}</div>
                    </div>
                    <span className="text-xs text-gray-500">{m.allocation_percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setTaskView('kanban')} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${taskView === 'kanban' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <Kanban size={14} /> Kanban
              </button>
              <button onClick={() => setTaskView('list')} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${taskView === 'list' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <List size={14} /> List
              </button>
            </div>
            <button
              onClick={() => { setEditTask(null); setShowTaskForm(true) }}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Plus size={14} /> Add Task
            </button>
          </div>

          {taskView === 'kanban' ? (
            <div className="h-[calc(100vh-380px)] min-h-[400px]">
              <KanbanBoard
                tasks={tasks}
                onTaskUpdate={handleTaskUpdate}
                onTaskClick={task => { setEditTask(task); setShowTaskForm(true) }}
                onAddTask={status => { setDefaultTaskStatus(status); setEditTask(null); setShowTaskForm(true) }}
              />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Task</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Assignee</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden md:table-cell">Due</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden md:table-cell">Progress</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tasks.filter(t => !t.parent_id).map(task => (
                    <tr key={task.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setEditTask(task); setShowTaskForm(true) }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {task.is_critical === 1 && <span className="w-1.5 h-4 rounded bg-red-400 flex-shrink-0" />}
                          <div>
                            <div className="text-sm font-medium text-gray-800">{task.name}</div>
                            {task.wbs_code && <div className="text-xs text-gray-400">{task.wbs_code}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                      <td className="px-4 py-3">
                        {task.assignee_name ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={task.assignee_name} size="xs" />
                            <span className="text-xs text-gray-600">{task.assignee_name}</span>
                          </div>
                        ) : <span className="text-xs text-gray-400">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                        {task.end_date ? format(parseISO(task.end_date), 'MMM d') : '—'}
                      </td>
                      <td className="px-4 py-3 w-32 hidden md:table-cell">
                        <Progress value={task.completion_percent} size="sm" showLabel />
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={e => { e.stopPropagation(); handleDeleteTask(task.id) }} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'gantt' && (
        <div className="h-[calc(100vh-300px)] min-h-[500px]">
          <GanttChart
            tasks={tasks}
            onTaskClick={task => { setEditTask(task); setShowTaskForm(true) }}
            projectStart={project.start_date}
            projectEnd={project.end_date}
            onTaskUpdate={async (taskId, start, end) => {
              await tasksApi.update(taskId, { start_date: start, end_date: end })
              await loadProject()
            }}
          />
        </div>
      )}

      {activeTab === 'sprint' && (
        <div className="space-y-6">
          <SprintBoard
            tasks={tasks}
            projectId={Number(id)}
            onTaskUpdate={handleTaskUpdate}
            onTaskClick={task => { setEditTask(task); setShowTaskForm(true) }}
            onAddTask={status => { setDefaultTaskStatus(status); setEditTask(null); setShowTaskForm(true) }}
          />
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <BurndownChart projectId={Number(id)} />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <VelocityChart projectId={Number(id)} />
          </div>
        </div>
      )}

      {activeTab === 'budget' && budget && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 md:col-span-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Budget by Category</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={budget.byCategory} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="planned" name="Planned" fill="#dbeafe" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" name="Actual" radius={[4, 4, 0, 0]}>
                    {budget.byCategory.map((entry, i) => <Cell key={i} fill={BUDGET_COLORS[entry.category] || '#94a3b8'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="col-span-12 md:col-span-4 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Budget Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Budget</span>
                  <span className="font-bold text-gray-900">{formatCurrency(budget.project.budget)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Amount Spent</span>
                  <span className="font-bold text-gray-900">{formatCurrency(budget.project.spent)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Remaining</span>
                  <span className={`font-bold ${budget.project.budget - budget.project.spent < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(budget.project.budget - budget.project.spent)}</span>
                </div>
                <Progress value={budgetPct} size="md" color={budgetPct > 90 ? 'red' : budgetPct > 75 ? 'yellow' : 'blue'} showLabel />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Line Items</h3>
              <div className="space-y-2">
                {budget.byCategory.map(cat => (
                  <div key={cat.category}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="capitalize text-gray-600">{cat.category}</span>
                      <span className="text-gray-500">{formatCurrency(cat.actual)} / {formatCurrency(cat.planned)}</span>
                    </div>
                    <Progress value={cat.planned > 0 ? (cat.actual / cat.planned) * 100 : 0} size="sm" color={cat.actual > cat.planned ? 'red' : 'blue'} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'risks' && (
        <div className="grid grid-cols-12 gap-5">
          {/* Risk matrix */}
          <div className="col-span-12 md:col-span-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <RiskMatrix risks={risks} />
            </div>
          </div>
          {/* Risk list */}
          <div className="col-span-12 md:col-span-7">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">{risks.length} Risks</h3>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded font-medium">
                  {risks.filter(r => r.score >= 6 && r.status !== 'closed').length} critical
                </span>
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded font-medium">
                  {risks.filter(r => r.score >= 3 && r.score < 6 && r.status !== 'closed').length} medium
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {risks.sort((a, b) => b.score - a.score).map(risk => (
                <div key={risk.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${risk.score >= 6 ? 'bg-red-100 text-red-700' : risk.score >= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                          Score: {risk.score}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded capitalize ${risk.status === 'open' ? 'bg-orange-100 text-orange-700' : risk.status === 'mitigating' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{risk.status}</span>
                        <span className="text-xs text-gray-400 capitalize">{risk.category}</span>
                      </div>
                      <div className="font-medium text-gray-800 text-sm">{risk.title}</div>
                      {risk.description && <div className="text-xs text-gray-500 mt-1">{risk.description}</div>}
                      {risk.mitigation_plan && (
                        <div className="text-xs text-blue-600 mt-1.5 flex items-start gap-1 bg-blue-50 rounded px-2 py-1">
                          <CheckCircle size={11} className="mt-0.5 flex-shrink-0" />
                          {risk.mitigation_plan}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-gray-400">P: <span className="capitalize font-medium">{risk.probability}</span></div>
                      <div className="text-xs text-gray-400">I: <span className="capitalize font-medium">{risk.impact}</span></div>
                      {risk.owner_name && <div className="text-xs text-gray-500 mt-1">{risk.owner_name}</div>}
                    </div>
                  </div>
                </div>
              ))}
              {risks.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No risks registered</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Member</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Department</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Role</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Allocation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} size="sm" />
                      <div>
                        <div className="text-sm font-medium text-gray-800">{m.name}</div>
                        <div className="text-xs text-gray-400">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500">{m.department || '—'}</td>
                  <td className="px-5 py-3 text-sm text-gray-600 capitalize">{m.role}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Progress value={m.allocation_percent} max={100} size="sm" className="w-24" />
                      <span className="text-sm font-medium text-gray-700">{m.allocation_percent}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Task modal */}
      <Modal
        isOpen={showTaskForm}
        onClose={() => { setShowTaskForm(false); setEditTask(null) }}
        title={editTask ? 'Edit Task' : 'New Task'}
        size="lg"
      >
        <TaskForm
          task={editTask || undefined}
          defaultStatus={defaultTaskStatus}
          onSubmit={handleTaskSave}
          onCancel={() => { setShowTaskForm(false); setEditTask(null) }}
          loading={savingTask}
        />
        {editTask?.id && (
          <div className="mt-2 px-1">
            <TaskComments taskId={editTask.id} />
          </div>
        )}
        {editTask?.id && (
          <div className="mt-2 px-1">
            <TimeTracker
              taskId={editTask.id}
              taskName={editTask.name || ''}
              projectId={Number(id)}
              onTimeLogged={() => loadProject()}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
