import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Plus, Edit, Trash2, ChevronRight, BarChart2, Calendar, Users, DollarSign,
  AlertTriangle, GitBranch, List, Kanban, Clock, CheckCircle, TrendingUp, TrendingDown,
  Activity, Flag, X, Save, Target, Zap, Shield
} from 'lucide-react'
import { projectsApi, tasksApi, risksApi, budgetApi, reportsApi } from '../api'
import { Project, Task, Risk, BudgetLine, Milestone, TaskStatus } from '../types'
import { HealthBadge, PriorityBadge, StatusBadge } from '../components/ui/Badge'
import Progress from '../components/ui/Progress'
import Modal from '../components/ui/Modal'
import GanttChart from '../components/gantt/GanttChart'
import KanbanBoard from '../components/kanban/KanbanBoard'
import TaskForm from '../components/forms/TaskForm'
import Avatar from '../components/ui/Avatar'
import CommentThread from '../components/ui/CommentThread'
import ImportTasks from '../components/ui/ImportTasks'
import { format, parseISO } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend, AreaChart, Area
} from 'recharts'

type Tab = 'overview' | 'tasks' | 'gantt' | 'budget' | 'risks' | 'team' | 'activity' | 'sprint'

function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n}`
}

const BUDGET_COLORS: Record<string, string> = {
  labor: '#3b82f6', materials: '#10b981', infrastructure: '#8b5cf6', software: '#f59e0b',
  equipment: '#06b6d4', travel: '#ec4899', overhead: '#6366f1', other: '#94a3b8'
}

const RISK_PROB: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }
const RISK_IMPACT: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }

interface EVMData {
  PV: number; EV: number; AC: number; SPI: number; CPI: number
  EAC: number; ETC: number; VAC: number; CV: number; SV: number
  budget: number; completion: number; plannedPct: number; sCurveData: Array<{ month: string; planned: number; actual: number; earned: number }>
}

function EVMPanel({ evm }: { evm: EVMData }) {
  const cpiColor = evm.CPI >= 1 ? 'text-green-600' : evm.CPI >= 0.85 ? 'text-yellow-600' : 'text-red-600'
  const spiColor = evm.SPI >= 1 ? 'text-green-600' : evm.SPI >= 0.85 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="space-y-5">
      {/* EVM KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'CPI', value: evm.CPI.toFixed(2), sub: 'Cost Performance', color: cpiColor, desc: evm.CPI >= 1 ? 'Under budget' : 'Over budget' },
          { label: 'SPI', value: evm.SPI.toFixed(2), sub: 'Schedule Performance', color: spiColor, desc: evm.SPI >= 1 ? 'Ahead of schedule' : 'Behind schedule' },
          { label: 'EAC', value: formatCurrency(evm.EAC), sub: 'Estimate at Completion', color: 'text-gray-900', desc: evm.VAC < 0 ? `${formatCurrency(Math.abs(evm.VAC))} over budget` : `${formatCurrency(evm.VAC)} under budget` },
          { label: 'ETC', value: formatCurrency(evm.ETC), sub: 'Estimate to Complete', color: 'text-gray-900', desc: `Remaining cost estimate` },
        ].map(kpi => (
          <div key={kpi.label} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">{kpi.sub}</div>
            <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
            <div className="text-xs font-semibold text-gray-700 mt-0.5">{kpi.label}</div>
            <div className="text-xs text-gray-400 mt-1">{kpi.desc}</div>
          </div>
        ))}
      </div>

      {/* EV breakdown */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Earned Value Analysis</h4>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Planned Value (PV)', value: formatCurrency(evm.PV), desc: `${evm.plannedPct}% planned`, color: 'bg-blue-100 text-blue-700' },
            { label: 'Earned Value (EV)', value: formatCurrency(evm.EV), desc: `${evm.completion}% actual`, color: 'bg-green-100 text-green-700' },
            { label: 'Actual Cost (AC)', value: formatCurrency(evm.AC), desc: 'Actual spend', color: 'bg-purple-100 text-purple-700' },
          ].map(item => (
            <div key={item.label} className="text-center">
              <div className={`text-xs font-medium px-2 py-1 rounded mb-1 ${item.color}`}>{item.label}</div>
              <div className="text-lg font-bold text-gray-900">{item.value}</div>
              <div className="text-xs text-gray-400">{item.desc}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-200">
          <div className="text-center">
            <span className="text-xs text-gray-500">Schedule Variance (SV)</span>
            <div className={`text-sm font-bold ${evm.SV >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {evm.SV >= 0 ? '+' : ''}{formatCurrency(evm.SV)}
            </div>
          </div>
          <div className="text-center">
            <span className="text-xs text-gray-500">Cost Variance (CV)</span>
            <div className={`text-sm font-bold ${evm.CV >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {evm.CV >= 0 ? '+' : ''}{formatCurrency(evm.CV)}
            </div>
          </div>
        </div>
      </div>

      {/* S-Curve */}
      {evm.sCurveData.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">S-Curve (Cost Over Time)</h4>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={evm.sCurveData} margin={{ left: 10, right: 10 }}>
              <defs>
                <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={Math.floor(evm.sCurveData.length / 6)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Area type="monotone" dataKey="planned" name="Planned (PV)" stroke="#3b82f6" fill="url(#pvGrad)" strokeWidth={2} />
              <Line type="monotone" dataKey="actual" name="Actual (AC)" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="earned" name="Earned (EV)" stroke="#22c55e" strokeWidth={2} dot={false} strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function RiskMatrix({ risks }: { risks: Risk[] }) {
  const levels = ['low', 'medium', 'high', 'critical'] as const
  const cellColor = (prob: number, impact: number) => {
    const score = prob * impact
    if (score >= 9) return 'bg-red-500'
    if (score >= 6) return 'bg-orange-400'
    if (score >= 3) return 'bg-yellow-400'
    return 'bg-green-400'
  }

  const riskInCell = (prob: string, impact: string) =>
    risks.filter(r => r.probability === prob && r.impact === impact && r.status !== 'closed')

  return (
    <div className="overflow-auto">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Risk Matrix</h4>
      <div className="flex gap-2">
        <div className="flex flex-col justify-end gap-1 pb-6 pr-1 text-xs text-gray-500">
          {['critical', 'high', 'medium', 'low'].map(p => (
            <div key={p} className="h-12 flex items-center justify-end capitalize font-medium w-14 text-right leading-tight">{p}</div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {['critical', 'high', 'medium', 'low'].map(prob => (
            <div key={prob} className="flex gap-1">
              {['low', 'medium', 'high', 'critical'].map(impact => {
                const cell = riskInCell(prob, impact)
                const pi = RISK_PROB[prob] * RISK_IMPACT[impact]
                const bg = pi >= 9 ? 'bg-red-100 border-red-300' : pi >= 6 ? 'bg-orange-100 border-orange-300' : pi >= 3 ? 'bg-yellow-100 border-yellow-300' : 'bg-green-100 border-green-300'
                return (
                  <div key={impact} className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center ${bg} relative group cursor-default`}>
                    {cell.length > 0 && (
                      <div className="w-7 h-7 rounded-full bg-gray-800 text-white text-xs font-bold flex items-center justify-center">
                        {cell.length}
                      </div>
                    )}
                    {/* Tooltip */}
                    {cell.length > 0 && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                        {cell.map(r => <div key={r.id} className="truncate">• {r.title}</div>)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          {/* Impact labels */}
          <div className="flex gap-1 mt-1">
            {['low', 'medium', 'high', 'critical'].map(i => (
              <div key={i} className="w-12 text-center text-xs text-gray-500 capitalize font-medium leading-tight">{i}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs">
        {[['bg-green-100 border-green-300', 'Low'], ['bg-yellow-100 border-yellow-300', 'Medium'], ['bg-orange-100 border-orange-300', 'High'], ['bg-red-100 border-red-300', 'Critical']].map(([cls, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded border-2 ${cls}`} />
            <span className="text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface RiskFormData {
  title: string; description: string; category: string; probability: string; impact: string
  status: string; response: string; mitigation_plan: string
}

function RiskForm({ onSubmit, onCancel, initial, loading }: {
  onSubmit: (data: RiskFormData) => void
  onCancel: () => void
  initial?: Partial<RiskFormData>
  loading: boolean
}) {
  const [form, setForm] = useState<RiskFormData>({
    title: initial?.title || '', description: initial?.description || '',
    category: initial?.category || 'technical', probability: initial?.probability || 'medium',
    impact: initial?.impact || 'medium', status: initial?.status || 'open',
    response: initial?.response || 'mitigate', mitigation_plan: initial?.mitigation_plan || '',
  })
  const set = (k: keyof RiskFormData, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
        <input value={form.title} onChange={e => set('title', e.target.value)} className="input-field" placeholder="Risk title..." />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="input-field resize-none" placeholder="Describe the risk..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)} className="input-field">
            {['technical', 'schedule', 'budget', 'resource', 'external', 'quality'].map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className="input-field">
            {['open', 'mitigating', 'closed'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Probability</label>
          <select value={form.probability} onChange={e => set('probability', e.target.value)} className="input-field">
            {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Impact</label>
          <select value={form.impact} onChange={e => set('impact', e.target.value)} className="input-field">
            {['low', 'medium', 'high', 'critical'].map(i => <option key={i} value={i} className="capitalize">{i}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Response</label>
          <select value={form.response} onChange={e => set('response', e.target.value)} className="input-field">
            {['mitigate', 'avoid', 'transfer', 'accept'].map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Mitigation Plan</label>
        <textarea value={form.mitigation_plan} onChange={e => set('mitigation_plan', e.target.value)} rows={2} className="input-field resize-none" placeholder="How will you mitigate this risk?" />
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={() => onSubmit(form)} disabled={!form.title || loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={14} />}
          Save Risk
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  )
}

function MilestoneForm({ onSubmit, onCancel, initial, loading }: {
  onSubmit: (data: Partial<Milestone>) => void
  onCancel: () => void
  initial?: Partial<Milestone>
  loading: boolean
}) {
  const [form, setForm] = useState({ name: initial?.name || '', date: initial?.date || '', status: initial?.status || 'upcoming', description: initial?.description || '' })
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Milestone Name *</label>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="Milestone name..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Date *</label>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'upcoming' | 'achieved' | 'missed' }))} className="input-field">
            <option value="upcoming">Upcoming</option>
            <option value="achieved">Achieved</option>
            <option value="missed">Missed</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="input-field resize-none" />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSubmit(form)} disabled={!form.name || !form.date || loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={14} />}
          Save
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  )
}

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
  const [activity, setActivity] = useState<Array<Record<string, any>>>([])
  const [evm, setEvm] = useState<EVMData | null>(null)
  const [loading, setLoading] = useState(true)
  const [taskView, setTaskView] = useState<'kanban' | 'list'>('kanban')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [savingTask, setSavingTask] = useState(false)
  const [defaultTaskStatus, setDefaultTaskStatus] = useState<TaskStatus>('todo')
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([])
  const [bulkAction, setBulkAction] = useState('')
  const [showRiskForm, setShowRiskForm] = useState(false)
  const [editRisk, setEditRisk] = useState<Risk | null>(null)
  const [savingRisk, setSavingRisk] = useState(false)
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [editMilestone, setEditMilestone] = useState<Milestone | null>(null)
  const [savingMilestone, setSavingMilestone] = useState(false)

  const loadProject = useCallback(async () => {
    if (!id) return
    const [projRes, tasksRes, risksRes, budgetRes, activityRes, evmRes] = await Promise.all([
      projectsApi.get(Number(id)),
      tasksApi.list(Number(id)),
      risksApi.list(Number(id)),
      budgetApi.get(Number(id)),
      projectsApi.getActivity(Number(id)),
      reportsApi.evm(Number(id)),
    ])
    setProject(projRes.data.project)
    setTasks(tasksRes.data.tasks)
    setRisks(risksRes.data.risks)
    setBudget(budgetRes.data)
    setMilestones(projRes.data.milestones)
    setMembers(projRes.data.members)
    setTaskStats(projRes.data.taskStats)
    setActivity(activityRes.data.activity)
    setEvm(evmRes.data)
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
      if (editTask?.id) await tasksApi.update(editTask.id, data)
      else await tasksApi.create(Number(id), data)
      setShowTaskForm(false); setEditTask(null)
      await loadProject()
    } finally { setSavingTask(false) }
  }

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Delete this task?')) return
    await tasksApi.delete(taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const handleRiskSave = async (data: Record<string, any>) => {
    setSavingRisk(true)
    try {
      const prob: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }
      const imp: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }
      const score = (prob[data.probability] || 2) * (imp[data.impact] || 2)
      const payload = { ...data, score }
      if (editRisk?.id) await risksApi.update(editRisk.id, payload)
      else await risksApi.create(Number(id), payload)
      setShowRiskForm(false); setEditRisk(null)
      await loadProject()
    } finally { setSavingRisk(false) }
  }

  const handleDeleteRisk = async (riskId: number) => {
    if (!confirm('Delete this risk?')) return
    await risksApi.delete(riskId)
    setRisks(prev => prev.filter(r => r.id !== riskId))
  }

  const handleMilestoneSave = async (data: Partial<Milestone>) => {
    setSavingMilestone(true)
    try {
      if (editMilestone?.id) await projectsApi.updateMilestone(Number(id), editMilestone.id, data)
      else await projectsApi.createMilestone(Number(id), data)
      setShowMilestoneForm(false); setEditMilestone(null)
      await loadProject()
    } finally { setSavingMilestone(false) }
  }

  const handleDeleteMilestone = async (mid: number) => {
    if (!confirm('Delete this milestone?')) return
    await projectsApi.deleteMilestone(Number(id), mid)
    setMilestones(prev => prev.filter(m => m.id !== mid))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!project) return <div className="text-center text-gray-400 py-12">Project not found</div>

  const TABS: { id: Tab; label: string; icon: typeof BarChart2 }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'tasks', label: 'Tasks', icon: List },
    { id: 'gantt', label: 'Gantt', icon: GitBranch },
    { id: 'budget', label: 'Budget & EVM', icon: DollarSign },
    { id: 'risks', label: `Risks (${risks.filter(r => r.status !== 'closed').length})`, icon: AlertTriangle },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'sprint', label: 'Sprints', icon: Zap },
  ]

  const budgetPct = project.budget > 0 ? Math.round((project.spent / project.budget) * 100) : 0

  function getActivityText(action: string, details?: string) {
    try {
      const d = details ? JSON.parse(details) : {}
      switch (action) {
        case 'task_completed': return `completed task "${d.task}"`
        case 'health_changed': return `changed health from ${d.from} to ${d.to}`
        case 'risk_raised': return `raised risk: ${d.risk}`
        case 'comment_added': return `commented: "${d.message}"`
        case 'created': return `created the project`
        default: return action.replace(/_/g, ' ')
      }
    } catch { return action }
  }

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
            <div className="w-4 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <StatusBadge status={project.status} />
                <HealthBadge health={project.health} />
                <PriorityBadge priority={project.priority} />
                {project.phase && <span className="text-sm text-gray-500 capitalize">{project.phase}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                const name = prompt(`Clone project as:`, `${project.name} (Copy)`)
                if (name === null) return
                try {
                  const r = await projectsApi.clone(project.id, name || undefined)
                  navigate(`/projects/${r.data.project.id}`)
                } catch { alert('Clone failed') }
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              title="Clone this project"
            >
              <Save size={14} /> Clone
            </button>
            <button
              onClick={() => window.open(`/print/project/${project.id}`, '_blank')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              title="Export PDF Report"
            >
              <Flag size={14} /> Report
            </button>
            {evm && (
              <div className="hidden md:flex items-center gap-4 bg-gray-50 rounded-xl px-4 py-2 border border-gray-200">
                <div className="text-center">
                  <div className={`text-sm font-bold ${evm.CPI >= 1 ? 'text-green-600' : evm.CPI >= 0.85 ? 'text-yellow-600' : 'text-red-600'}`}>{evm.CPI.toFixed(2)}</div>
                  <div className="text-xs text-gray-400">CPI</div>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-center">
                  <div className={`text-sm font-bold ${evm.SPI >= 1 ? 'text-green-600' : evm.SPI >= 0.85 ? 'text-yellow-600' : 'text-red-600'}`}>{evm.SPI.toFixed(2)}</div>
                  <div className="text-xs text-gray-400">SPI</div>
                </div>
              </div>
            )}
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{project.completion_percent}%</div>
              <div className="text-xs text-gray-400">Complete</div>
            </div>
            <div className="w-14 h-14">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={project.color} strokeWidth="3.5"
                  strokeDasharray={`${project.completion_percent} ${100 - project.completion_percent}`}
                  strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Budget', main: formatCurrency(project.budget),
            sub: `${formatCurrency(project.spent)} spent (${budgetPct}%)`,
            extra: <Progress value={budgetPct} size="sm" color={budgetPct > 90 ? 'red' : 'blue'} className="mt-1" />
          },
          {
            label: 'Tasks', main: `${taskStats?.done || 0} / ${taskStats?.total || 0}`,
            sub: `${taskStats?.in_progress || 0} in progress · ${taskStats?.blocked || 0} blocked`
          },
          {
            label: 'Timeline', main: project.end_date ? format(parseISO(project.end_date), 'MMM d, yyyy') : '—',
            sub: project.start_date ? `Started ${format(parseISO(project.start_date), 'MMM d')}` : 'No start date'
          },
          {
            label: 'Team', main: `${members.length} members`,
            extra: (
              <div className="flex -space-x-1 mt-1">
                {members.slice(0, 5).map(m => <Avatar key={m.id} name={m.name} size="xs" className="ring-2 ring-white" />)}
                {members.length > 5 && <div className="w-6 h-6 rounded-full bg-gray-200 ring-2 ring-white flex items-center justify-center text-xs text-gray-600">+{members.length - 5}</div>}
              </div>
            )
          },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
            <div className="font-bold text-gray-900 text-sm">{stat.main}</div>
            {stat.sub && <div className="text-xs text-gray-400 mt-0.5">{stat.sub}</div>}
            {stat.extra}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0.5 overflow-x-auto scrollbar-hide">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-8 space-y-5">
            {project.description && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{project.description}</p>
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Flag size={16} className="text-gray-400" /> Milestones</h3>
                <button onClick={() => { setEditMilestone(null); setShowMilestoneForm(true) }} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                  <Plus size={12} /> Add
                </button>
              </div>
              {milestones.length === 0 ? (
                <p className="text-sm text-gray-400">No milestones defined</p>
              ) : (
                <div className="relative pl-4">
                  <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-gray-200" />
                  {milestones.map(m => (
                    <div key={m.id} className="relative flex items-start gap-3 pb-4 group">
                      <div className={`absolute -left-2 w-4 h-4 rounded-full border-2 ${m.status === 'achieved' ? 'bg-green-500 border-green-500' : m.status === 'missed' ? 'bg-red-500 border-red-500' : 'bg-white border-blue-500'} flex-shrink-0 mt-0.5`} />
                      <div className="ml-4 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{m.name}</span>
                          <span className="text-xs text-gray-400">{format(parseISO(m.date), 'MMM d, yyyy')}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${m.status === 'achieved' ? 'bg-green-100 text-green-700' : m.status === 'missed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{m.status}</span>
                        </div>
                        {m.description && <div className="text-xs text-gray-500 mt-0.5">{m.description}</div>}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditMilestone(m); setShowMilestoneForm(true) }} className="p-1 text-gray-400 hover:text-blue-500"><Edit size={12} /></button>
                        <button onClick={() => handleDeleteMilestone(m.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="col-span-12 lg:col-span-4 space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-orange-400" /> Risk Summary</h3>
              <RiskMatrix risks={risks} />
            </div>
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

      {/* Tasks tab */}
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
            <div className="flex items-center gap-2">
              <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors" title="Import tasks from CSV">
                <ArrowLeft size={14} className="rotate-90" /> Import CSV
              </button>
              <button onClick={() => { setEditTask(null); setShowTaskForm(true) }} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                <Plus size={14} /> Add Task
              </button>
            </div>
          </div>
          {taskView === 'kanban' ? (
            <div className="h-[calc(100vh-380px)] min-h-[400px]">
              <KanbanBoard tasks={tasks} projectId={project.id} onTaskUpdate={handleTaskUpdate} onTaskClick={task => { setEditTask(task); setShowTaskForm(true) }} onAddTask={status => { setDefaultTaskStatus(status); setEditTask(null); setShowTaskForm(true) }} />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Bulk action bar */}
              {selectedTaskIds.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border-b border-blue-200">
                  <span className="text-sm font-medium text-blue-700">{selectedTaskIds.length} selected</span>
                  <select value={bulkAction} onChange={async e => {
                    const action = e.target.value
                    if (!action) return
                    const [field, val] = action.split(':')
                    await tasksApi.bulkUpdate(selectedTaskIds, { [field]: val || null })
                    setBulkAction('')
                    setSelectedTaskIds([])
                    loadProject()
                  }} className="text-sm border border-blue-300 rounded-lg px-2 py-1 focus:outline-none bg-white">
                    <option value="">Apply action…</option>
                    <option value="status:todo">→ To Do</option>
                    <option value="status:in_progress">→ In Progress</option>
                    <option value="status:review">→ In Review</option>
                    <option value="status:done">→ Done</option>
                    <option value="priority:critical">Priority: Critical</option>
                    <option value="priority:high">Priority: High</option>
                    <option value="priority:medium">Priority: Medium</option>
                    <option value="priority:low">Priority: Low</option>
                  </select>
                  <button onClick={() => setSelectedTaskIds([])} className="text-xs text-blue-500 hover:text-blue-700 ml-auto">Clear selection</button>
                </div>
              )}
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 w-8">
                      <input type="checkbox" className="rounded" checked={selectedTaskIds.length === tasks.filter(t => !t.parent_id).length && tasks.length > 0}
                        onChange={e => setSelectedTaskIds(e.target.checked ? tasks.filter(t => !t.parent_id).map(t => t.id) : [])} />
                    </th>
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
                    <tr key={task.id} className={`hover:bg-gray-50 ${selectedTaskIds.includes(task.id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="rounded" checked={selectedTaskIds.includes(task.id)}
                          onChange={e => setSelectedTaskIds(prev => e.target.checked ? [...prev, task.id] : prev.filter(id => id !== task.id))} />
                      </td>
                      <td className="px-4 py-3 cursor-pointer" onClick={() => { setEditTask(task); setShowTaskForm(true) }}>
                        <div className="flex items-center gap-2">
                          {task.is_critical === 1 && <span className="w-1.5 h-4 rounded bg-red-400 flex-shrink-0" />}
                          <div>
                            <div className="text-sm font-medium text-gray-800">{task.name}</div>
                            {task.wbs_code && <div className="text-xs text-gray-400">{task.wbs_code}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 cursor-pointer" onClick={() => { setEditTask(task); setShowTaskForm(true) }}><StatusBadge status={task.status} /></td>
                      <td className="px-4 py-3 cursor-pointer" onClick={() => { setEditTask(task); setShowTaskForm(true) }}>
                        {task.assignee_name ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={task.assignee_name} size="xs" />
                            <span className="text-xs text-gray-600">{task.assignee_name}</span>
                          </div>
                        ) : <span className="text-xs text-gray-400">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell cursor-pointer" onClick={() => { setEditTask(task); setShowTaskForm(true) }}>{task.end_date ? format(parseISO(task.end_date), 'MMM d') : '—'}</td>
                      <td className="px-4 py-3 w-32 hidden md:table-cell cursor-pointer" onClick={() => { setEditTask(task); setShowTaskForm(true) }}><Progress value={task.completion_percent} size="sm" showLabel /></td>
                      <td className="px-4 py-3">
                        <button onClick={e => { e.stopPropagation(); handleDeleteTask(task.id) }} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
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
          <GanttChart tasks={tasks} onTaskClick={task => { setEditTask(task); setShowTaskForm(true) }} projectStart={project.start_date} projectEnd={project.end_date} />
        </div>
      )}

      {activeTab === 'budget' && budget && (
        <div className="space-y-5">
          {/* EVM Section */}
          {evm && project.budget > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-500" />
                Earned Value Management (EVM)
              </h3>
              <EVMPanel evm={evm} />
            </div>
          )}
          {/* Budget breakdown */}
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 md:col-span-8">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Budget by Category</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={budget.byCategory}>
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
                  {[
                    { label: 'Total Budget', value: formatCurrency(budget.project.budget) },
                    { label: 'Amount Spent', value: formatCurrency(budget.project.spent) },
                    { label: 'Remaining', value: formatCurrency(budget.project.budget - budget.project.spent), colored: true },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{item.label}</span>
                      <span className={`font-bold ${item.colored ? (budget.project.budget - budget.project.spent < 0 ? 'text-red-600' : 'text-green-600') : 'text-gray-900'}`}>{item.value}</span>
                    </div>
                  ))}
                  <Progress value={budgetPct} size="md" color={budgetPct > 90 ? 'red' : budgetPct > 75 ? 'yellow' : 'blue'} showLabel />
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">By Category</h3>
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
        </div>
      )}

      {activeTab === 'risks' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{risks.length} Risks</h3>
            <button onClick={() => { setEditRisk(null); setShowRiskForm(true) }} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              <Plus size={14} /> Add Risk
            </button>
          </div>
          {/* Risk Matrix visualization */}
          <div className="mb-5 bg-white rounded-xl border border-gray-200 p-5">
            <RiskMatrix risks={risks} />
          </div>
          <div className="grid grid-cols-1 gap-3">
            {risks.map(risk => (
              <div key={risk.id} className="bg-white rounded-xl border border-gray-200 p-4 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${risk.score >= 9 ? 'bg-red-100 text-red-700' : risk.score >= 6 ? 'bg-orange-100 text-orange-700' : risk.score >= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                        Score: {risk.score}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded capitalize ${risk.status === 'open' ? 'bg-orange-100 text-orange-700' : risk.status === 'mitigating' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{risk.status}</span>
                      <span className="text-xs text-gray-400 capitalize">{risk.category}</span>
                      <span className="text-xs text-gray-400">P:{risk.probability} × I:{risk.impact}</span>
                    </div>
                    <div className="font-medium text-gray-800">{risk.title}</div>
                    {risk.description && <div className="text-sm text-gray-500 mt-1">{risk.description}</div>}
                    {risk.mitigation_plan && (
                      <div className="text-xs text-blue-600 mt-1.5 flex items-start gap-1">
                        <CheckCircle size={12} className="mt-0.5 flex-shrink-0" />
                        {risk.mitigation_plan}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => { setEditRisk(risk); setShowRiskForm(true) }} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"><Edit size={14} /></button>
                    <button onClick={() => handleDeleteRisk(risk.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
            {risks.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                <Shield size={32} className="mx-auto mb-2 opacity-30" />
                No risks registered
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                {['Member', 'Department', 'Role', 'Allocation'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-5 py-3 uppercase tracking-wider">{h}</th>
                ))}
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

      {activeTab === 'activity' && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-7">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Activity Log</h3>
              </div>
              {activity.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">No activity recorded</div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                  {activity.map(item => (
                    <div key={item.id} className="flex items-start gap-3 px-5 py-3">
                      <Avatar name={item.user_name || 'U'} size="xs" className="mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-700">
                          <span className="font-medium">{item.user_name}</span>{' '}
                          {getActivityText(item.action, item.details)}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 flex-shrink-0">
                        {format(parseISO(item.created_at), 'MMM d, HH:mm')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="col-span-12 lg:col-span-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Discussion</h3>
              <CommentThread entityType="project" entityId={project.id} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sprint' && (() => {
        const sprintMap: Record<string, { name: string; tasks: typeof tasks }> = {}
        for (const t of tasks) {
          const key = t.sprint || '__backlog__'
          if (!sprintMap[key]) sprintMap[key] = { name: t.sprint || 'Backlog', tasks: [] }
          sprintMap[key].tasks.push(t)
        }
        const sprints = Object.entries(sprintMap).sort(([a], [b]) => {
          if (a === '__backlog__') return 1
          if (b === '__backlog__') return -1
          return a.localeCompare(b)
        })
        const velocityData = sprints.filter(([k]) => k !== '__backlog__').map(([, s]) => ({
          sprint: s.name,
          total: s.tasks.reduce((sum, t) => sum + (t.story_points || 0), 0),
          done: s.tasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (t.story_points || 0), 0),
        }))

        return (
          <div className="space-y-5">
            {velocityData.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Velocity Chart (Story Points)</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={velocityData} margin={{ left: 0, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="sprint" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" name="Total Points" fill="#dbeafe" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="done" name="Done Points" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {sprints.map(([key, sprint]) => {
              const totalPts = sprint.tasks.reduce((sum, t) => sum + (t.story_points || 0), 0)
              const donePts = sprint.tasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (t.story_points || 0), 0)
              const donePct = totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0
              return (
                <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900">{sprint.name}</h3>
                      <span className="text-xs text-gray-500">{sprint.tasks.length} tasks</span>
                      {totalPts > 0 && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">{donePts}/{totalPts} pts</span>}
                    </div>
                    {totalPts > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-gray-200 rounded-full">
                          <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${donePct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{donePct}%</span>
                      </div>
                    )}
                  </div>
                  <table className="w-full">
                    <tbody className="divide-y divide-gray-50">
                      {sprint.tasks.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setEditTask(t); setShowTaskForm(true) }}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {t.is_critical === 1 && <span className="w-1 h-4 rounded bg-red-400 flex-shrink-0" />}
                              <span className="text-sm text-gray-800">{t.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 w-28"><StatusBadge status={t.status} /></td>
                          <td className="px-4 py-2.5 text-xs text-gray-500 w-32">
                            {t.assignee_name ? (
                              <div className="flex items-center gap-1.5">
                                <Avatar name={t.assignee_name} size="xs" />
                                <span>{t.assignee_name}</span>
                              </div>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right w-20">
                            {t.story_points != null && (
                              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{t.story_points} pts</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
            {tasks.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">No tasks yet — add tasks with sprint names and story points to use this view</div>
            )}
          </div>
        )
      })()}

      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import Tasks from CSV" size="lg">
        <ImportTasks projectId={project.id} onDone={() => { setShowImport(false); loadProject() }} onCancel={() => setShowImport(false)} />
      </Modal>

      {/* Task modal */}
      <Modal isOpen={showTaskForm} onClose={() => { setShowTaskForm(false); setEditTask(null) }} title={editTask ? 'Edit Task' : 'New Task'} size="md">
        <TaskForm task={editTask || undefined} projectId={project.id} defaultStatus={defaultTaskStatus} onSubmit={handleTaskSave} onCancel={() => { setShowTaskForm(false); setEditTask(null) }} loading={savingTask} />
      </Modal>

      {/* Risk modal */}
      <Modal isOpen={showRiskForm} onClose={() => { setShowRiskForm(false); setEditRisk(null) }} title={editRisk ? 'Edit Risk' : 'New Risk'} size="md">
        <RiskForm
          onSubmit={handleRiskSave as any}
          onCancel={() => { setShowRiskForm(false); setEditRisk(null) }}
          initial={editRisk || undefined}
          loading={savingRisk}
        />
      </Modal>

      {/* Milestone modal */}
      <Modal isOpen={showMilestoneForm} onClose={() => { setShowMilestoneForm(false); setEditMilestone(null) }} title={editMilestone ? 'Edit Milestone' : 'New Milestone'} size="sm">
        <MilestoneForm
          onSubmit={handleMilestoneSave}
          onCancel={() => { setShowMilestoneForm(false); setEditMilestone(null) }}
          initial={editMilestone || undefined}
          loading={savingMilestone}
        />
      </Modal>
    </div>
  )
}

