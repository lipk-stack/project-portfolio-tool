import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, ChevronRight, BarChart2, Calendar, Users, DollarSign,
  AlertTriangle, GitBranch, List, Kanban, Edit, CheckCircle, Activity,
  FileText, Bug, ExternalLink, TrendingUp, TrendingDown, Minus, XCircle
} from 'lucide-react'
import { projectsApi, tasksApi, risksApi, budgetApi, issuesApi, changeRequestsApi, evmApi, sprintsApi } from '../api'
import { Project, Task, Risk, BudgetLine, Milestone, TaskStatus, Issue, ChangeRequest, EVMData, Sprint } from '../types'
import { HealthBadge, PriorityBadge, StatusBadge } from '../components/ui/Badge'
import Progress from '../components/ui/Progress'
import Modal from '../components/ui/Modal'
import GanttChart from '../components/gantt/GanttChart'
import KanbanBoard from '../components/kanban/KanbanBoard'
import TaskForm from '../components/forms/TaskForm'
import RiskForm from '../components/forms/RiskForm'
import IssueForm from '../components/forms/IssueForm'
import Avatar from '../components/ui/Avatar'
import { format, parseISO, isPast, differenceInDays } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, RadialBarChart, RadialBar } from 'recharts'
import { useToast } from '../components/ui/Toast'

type Tab = 'overview' | 'tasks' | 'gantt' | 'budget' | 'risks' | 'issues' | 'changes' | 'sprints' | 'team' | 'docs'

function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n}`
}

const BUDGET_COLORS: Record<string, string> = {
  labor: '#3b82f6', materials: '#10b981', infrastructure: '#8b5cf6',
  software: '#f59e0b', equipment: '#06b6d4', travel: '#ec4899', overhead: '#6366f1', other: '#94a3b8',
}

function EVMGauge({ label, value, good, bad }: { label: string; value: number; good: boolean; bad: boolean }) {
  const color = bad ? '#ef4444' : good ? '#22c55e' : '#f59e0b'
  const Icon = bad ? TrendingDown : good ? TrendingUp : Minus
  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <div className={`text-2xl font-bold`} style={{ color }}>{value.toFixed(2)}</div>
      <div className="flex items-center justify-center gap-1 mt-0.5">
        <Icon size={12} style={{ color }} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
    </div>
  )
}

export default function ProjectDetail() {
  const { id, tab } = useParams<{ id: string; tab?: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<Tab>((tab as Tab) || 'overview')
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [risks, setRisks] = useState<Risk[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [changes, setChanges] = useState<ChangeRequest[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [budget, setBudget] = useState<{ lines: BudgetLine[]; byCategory: Array<{ category: string; planned: number; actual: number }>; project: { budget: number; spent: number } } | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [members, setMembers] = useState<Array<{ id: number; name: string; email: string; role: string; allocation_percent: number; department?: string }>>([])
  const [taskStats, setTaskStats] = useState<{ total: number; done: number; in_progress: number; blocked: number; total_estimated: number; total_actual: number } | null>(null)
  const [evm, setEvm] = useState<EVMData | null>(null)
  const [documents, setDocuments] = useState<Array<{ id: number; name: string; url?: string; description?: string; doc_type: string; uploaded_by_name?: string; created_at: string }>>([])
  const [loading, setLoading] = useState(true)
  const [taskView, setTaskView] = useState<'kanban' | 'list'>('kanban')

  // Modal states
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [savingTask, setSavingTask] = useState(false)
  const [defaultTaskStatus, setDefaultTaskStatus] = useState<TaskStatus>('todo')
  const [showRiskForm, setShowRiskForm] = useState(false)
  const [editRisk, setEditRisk] = useState<Risk | null>(null)
  const [savingRisk, setSavingRisk] = useState(false)
  const [showIssueForm, setShowIssueForm] = useState(false)
  const [editIssue, setEditIssue] = useState<Issue | null>(null)
  const [savingIssue, setSavingIssue] = useState(false)
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [editMilestone, setEditMilestone] = useState<Milestone | null>(null)
  const [milestoneForm, setMilestoneForm] = useState({ name: '', date: '', status: 'upcoming', description: '' })
  const [showDocForm, setShowDocForm] = useState(false)
  const [docForm, setDocForm] = useState({ name: '', url: '', description: '', doc_type: 'link' })

  const loadProject = useCallback(async () => {
    if (!id) return
    const [projRes, tasksRes, risksRes, budgetRes, issuesRes, changesRes, sprintsRes, docsRes, evmRes] = await Promise.all([
      projectsApi.get(Number(id)),
      tasksApi.list(Number(id)),
      risksApi.list(Number(id)),
      budgetApi.get(Number(id)),
      issuesApi.list(Number(id)),
      changeRequestsApi.list(Number(id)),
      sprintsApi.list(Number(id)),
      projectsApi.getDocuments(Number(id)),
      evmApi.project(Number(id)),
    ])
    setProject(projRes.data.project)
    setTasks(tasksRes.data.tasks)
    setRisks(risksRes.data.risks)
    setBudget(budgetRes.data)
    setMilestones(projRes.data.milestones)
    setMembers(projRes.data.members)
    setTaskStats(projRes.data.taskStats)
    setIssues(issuesRes.data.issues)
    setChanges(changesRes.data.change_requests)
    setSprints(sprintsRes.data.sprints)
    setDocuments(docsRes.data.documents)
    setEvm(evmRes.data.evm)
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
      setShowTaskForm(false); setEditTask(null)
      await loadProject()
      toast.success(editTask ? 'Task updated' : 'Task created')
    } catch { toast.error('Failed to save task') }
    finally { setSavingTask(false) }
  }

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Delete this task?')) return
    await tasksApi.delete(taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
    toast.success('Task deleted')
  }

  const handleRiskSave = async (data: Partial<Risk>) => {
    setSavingRisk(true)
    try {
      if (editRisk?.id) {
        await risksApi.update(editRisk.id, data)
      } else {
        await risksApi.create(Number(id), data)
      }
      setShowRiskForm(false); setEditRisk(null)
      const res = await risksApi.list(Number(id))
      setRisks(res.data.risks)
      toast.success(editRisk ? 'Risk updated' : 'Risk added')
    } catch { toast.error('Failed to save risk') }
    finally { setSavingRisk(false) }
  }

  const handleDeleteRisk = async (riskId: number) => {
    if (!confirm('Delete this risk?')) return
    await risksApi.delete(riskId)
    setRisks(prev => prev.filter(r => r.id !== riskId))
    toast.success('Risk deleted')
  }

  const handleIssueSave = async (data: Partial<Issue>) => {
    setSavingIssue(true)
    try {
      if (editIssue?.id) {
        await issuesApi.update(editIssue.id, data)
      } else {
        await issuesApi.create(Number(id), data)
      }
      setShowIssueForm(false); setEditIssue(null)
      const res = await issuesApi.list(Number(id))
      setIssues(res.data.issues)
      toast.success(editIssue ? 'Issue updated' : 'Issue reported')
    } catch { toast.error('Failed to save issue') }
    finally { setSavingIssue(false) }
  }

  const handleSaveMilestone = async () => {
    try {
      if (editMilestone?.id) {
        await projectsApi.updateMilestone(Number(id), editMilestone.id, milestoneForm)
      } else {
        await projectsApi.createMilestone(Number(id), milestoneForm)
      }
      setShowMilestoneForm(false); setEditMilestone(null)
      const res = await projectsApi.get(Number(id))
      setMilestones(res.data.milestones)
      toast.success(editMilestone ? 'Milestone updated' : 'Milestone created')
    } catch { toast.error('Failed to save milestone') }
  }

  const handleDeleteMilestone = async (mid: number) => {
    if (!confirm('Delete this milestone?')) return
    await projectsApi.deleteMilestone(Number(id), mid)
    setMilestones(prev => prev.filter(m => m.id !== mid))
    toast.success('Milestone deleted')
  }

  const handleAddDocument = async () => {
    if (!docForm.name) return
    try {
      const res = await projectsApi.createDocument(Number(id), docForm)
      setDocuments(prev => [res.data.document, ...prev])
      setShowDocForm(false)
      setDocForm({ name: '', url: '', description: '', doc_type: 'link' })
      toast.success('Document added')
    } catch { toast.error('Failed to add document') }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!project) return <div className="text-center text-gray-400 py-12">Project not found</div>

  const openIssues = issues.filter(i => i.status === 'open' || i.status === 'in_progress')
  const pendingCRs = changes.filter(c => c.status === 'pending')

  const TABS: Array<{ id: Tab; label: string; icon: any; badge?: number }> = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'tasks', label: 'Tasks', icon: List },
    { id: 'gantt', label: 'Gantt', icon: GitBranch },
    { id: 'sprints', label: 'Sprints', icon: GitBranch, badge: sprints.filter(s => s.status === 'active').length },
    { id: 'budget', label: 'Budget', icon: DollarSign },
    { id: 'risks', label: 'Risks', icon: AlertTriangle, badge: risks.filter(r => r.status !== 'closed').length },
    { id: 'issues', label: 'Issues', icon: Bug, badge: openIssues.length },
    { id: 'changes', label: 'Changes', icon: FileText, badge: pendingCRs.length },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'docs', label: 'Docs', icon: ExternalLink },
  ]

  const budgetPct = project.budget > 0 ? Math.round((project.spent / project.budget) * 100) : 0

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/projects" className="hover:text-gray-700 flex items-center gap-1"><ArrowLeft size={14} /> Projects</Link>
        <ChevronRight size={14} />
        <span className="text-gray-900 font-medium truncate">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-14 rounded-full" style={{ backgroundColor: project.color }} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <StatusBadge status={project.status} />
              <HealthBadge health={project.health} />
              <PriorityBadge priority={project.priority} />
              {project.phase && <span className="text-sm text-gray-500 capitalize">{project.phase}</span>}
              {project.portfolio_name && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{project.portfolio_name}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{project.completion_percent}%</div>
            <div className="text-xs text-gray-400">Complete</div>
          </div>
          <div className="w-16 h-16 relative">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={project.color} strokeWidth="3"
                strokeDasharray={`${project.completion_percent} ${100 - project.completion_percent}`}
                strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Budget', value: formatCurrency(project.budget), sub: `${formatCurrency(project.spent)} spent (${budgetPct}%)`, pct: budgetPct, color: budgetPct > 90 ? 'red' : 'blue' as any },
          { label: 'Tasks', value: `${taskStats?.done || 0}/${taskStats?.total || 0}`, sub: `${taskStats?.in_progress || 0} in progress`, pct: taskStats?.total ? Math.round((taskStats.done / taskStats.total) * 100) : 0, color: 'green' as any },
          { label: 'Risks', value: risks.filter(r => r.status !== 'closed').length, sub: `${risks.filter(r => r.score >= 6 && r.status !== 'closed').length} high/critical`, pct: null, color: 'orange' as any },
          { label: 'Issues', value: openIssues.length, sub: `${issues.filter(i => i.severity === 'critical').length} critical`, pct: null, color: 'red' as any },
          { label: 'Team', value: `${members.length} members`, sub: project.manager_name ? `PM: ${project.manager_name}` : '—', pct: null, color: 'purple' as any },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
            <div className="font-bold text-gray-900 text-sm">{stat.value}</div>
            {stat.pct !== null && <Progress value={stat.pct} size="sm" color={stat.color} className="mt-1" />}
            <div className="text-xs text-gray-400 mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0.5 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <t.icon size={13} /> {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5 ${activeTab === t.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-8 space-y-5">
            {project.description && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{project.description}</p>
              </div>
            )}

            {/* EVM Section */}
            {evm && evm.bac > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-blue-500" /> Earned Value Analysis
                </h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-xs text-blue-600 font-medium">Planned Value (PV)</div>
                    <div className="text-lg font-bold text-blue-700">{formatCurrency(evm.pv)}</div>
                    <div className="text-xs text-blue-500">Budget baseline</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-green-600 font-medium">Earned Value (EV)</div>
                    <div className="text-lg font-bold text-green-700">{formatCurrency(evm.ev)}</div>
                    <div className="text-xs text-green-500">Work accomplished</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3">
                    <div className="text-xs text-orange-600 font-medium">Actual Cost (AC)</div>
                    <div className="text-lg font-bold text-orange-700">{formatCurrency(evm.acwp)}</div>
                    <div className="text-xs text-orange-500">Money spent</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <EVMGauge label="SPI" value={evm.spi} good={evm.spi >= 0.95} bad={evm.spi < 0.85} />
                  <EVMGauge label="CPI" value={evm.cpi} good={evm.cpi >= 0.95} bad={evm.cpi < 0.85} />
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className={`text-lg font-bold ${evm.sv >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(Math.abs(evm.sv))}</div>
                    <div className="text-xs text-gray-500">Sched. Variance {evm.sv >= 0 ? '+' : '-'}</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className={`text-lg font-bold ${evm.cv >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(Math.abs(evm.cv))}</div>
                    <div className="text-xs text-gray-500">Cost Variance {evm.cv >= 0 ? '+' : '-'}</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-3 text-center text-xs">
                  <div><span className="text-gray-500">EAC:</span> <span className="font-semibold text-gray-800">{formatCurrency(evm.eac)}</span></div>
                  <div><span className="text-gray-500">ETC:</span> <span className="font-semibold text-gray-800">{formatCurrency(evm.etc)}</span></div>
                  <div><span className="text-gray-500">VAC:</span> <span className={`font-semibold ${evm.vac >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(evm.vac)}</span></div>
                </div>
              </div>
            )}

            {/* Milestones */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Calendar size={16} className="text-gray-400" /> Milestones</h3>
                <button
                  onClick={() => { setEditMilestone(null); setMilestoneForm({ name: '', date: '', status: 'upcoming', description: '' }); setShowMilestoneForm(true) }}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
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
                      <div className={`absolute -left-2 w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${m.status === 'achieved' ? 'bg-green-500 border-green-500' : m.status === 'missed' ? 'bg-red-500 border-red-500' : 'bg-white border-blue-500'}`} />
                      <div className="ml-4 flex-1">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-gray-800">{m.name}</div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditMilestone(m); setMilestoneForm({ name: m.name, date: m.date, status: m.status, description: m.description || '' }); setShowMilestoneForm(true) }} className="p-1 text-gray-400 hover:text-blue-500"><Edit size={12} /></button>
                            <button onClick={() => handleDeleteMilestone(m.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">{format(parseISO(m.date), 'MMMM d, yyyy')} · <span className="capitalize">{m.status}</span></div>
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
                {[
                  { label: 'Critical', count: risks.filter(r => r.score >= 9 && r.status !== 'closed').length, color: 'text-red-700 bg-red-50' },
                  { label: 'High', count: risks.filter(r => r.score >= 6 && r.score < 9 && r.status !== 'closed').length, color: 'text-orange-600 bg-orange-50' },
                  { label: 'Medium', count: risks.filter(r => r.score >= 3 && r.score < 6 && r.status !== 'closed').length, color: 'text-yellow-600 bg-yellow-50' },
                  { label: 'Low', count: risks.filter(r => r.score < 3 && r.status !== 'closed').length, color: 'text-green-600 bg-green-50' },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{r.label}</span>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded ${r.color}`}>{r.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Issues summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Bug size={16} className="text-red-400" /> Issues</h3>
              <div className="space-y-2">
                {[
                  { label: 'Critical', count: issues.filter(i => i.severity === 'critical' && i.status !== 'closed').length, color: 'text-red-700 bg-red-50' },
                  { label: 'High', count: issues.filter(i => i.severity === 'high' && i.status !== 'closed').length, color: 'text-orange-600 bg-orange-50' },
                  { label: 'Open', count: issues.filter(i => i.status === 'open').length, color: 'text-yellow-600 bg-yellow-50' },
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
              <div className="space-y-2.5">
                {members.slice(0, 6).map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <Avatar name={m.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 truncate">{m.name}</div>
                      <div className="text-xs text-gray-400 capitalize">{m.role}</div>
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">{m.allocation_percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TASKS ── */}
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
            <button onClick={() => { setEditTask(null); setShowTaskForm(true) }} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              <Plus size={14} /> Add Task
            </button>
          </div>
          {taskView === 'kanban' ? (
            <div className="h-[calc(100vh-380px)] min-h-[400px]">
              <KanbanBoard tasks={tasks} onTaskUpdate={handleTaskUpdate}
                onTaskClick={task => { setEditTask(task); setShowTaskForm(true) }}
                onAddTask={status => { setDefaultTaskStatus(status); setEditTask(null); setShowTaskForm(true) }} />
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
                      <td className="px-4 py-3 text-xs hidden md:table-cell">
                        {task.end_date ? (
                          <span className={isPast(parseISO(task.end_date)) && task.status !== 'done' ? 'text-red-600 font-medium' : 'text-gray-500'}>
                            {format(parseISO(task.end_date), 'MMM d')}
                          </span>
                        ) : '—'}
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

      {/* ── GANTT ── */}
      {activeTab === 'gantt' && (
        <div className="h-[calc(100vh-300px)] min-h-[500px]">
          <GanttChart tasks={tasks} onTaskClick={task => { setEditTask(task); setShowTaskForm(true) }}
            projectStart={project.start_date} projectEnd={project.end_date} />
        </div>
      )}

      {/* ── SPRINTS ── */}
      {activeTab === 'sprints' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">{sprints.length} Sprints</h3>
          </div>
          {sprints.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <GitBranch size={32} className="mx-auto mb-2 opacity-30" />
              <p>No sprints created. Go to the Sprints page to create one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sprints.map(sprint => (
                <div key={sprint.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{sprint.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${sprint.status === 'active' ? 'bg-blue-100 text-blue-700' : sprint.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {sprint.status}
                        </span>
                      </div>
                      {sprint.goal && <div className="text-xs text-gray-500 mt-0.5">{sprint.goal}</div>}
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Tasks</div>
                        <div className="font-medium">{sprint.done_count || 0}/{sprint.task_count || 0}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Points</div>
                        <div className="font-medium">{sprint.completed_points || 0}/{sprint.total_points || 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BUDGET ── */}
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
                <div className="flex justify-between"><span className="text-sm text-gray-600">Total Budget</span><span className="font-bold">{formatCurrency(budget.project.budget)}</span></div>
                <div className="flex justify-between"><span className="text-sm text-gray-600">Spent</span><span className="font-bold">{formatCurrency(budget.project.spent)}</span></div>
                <div className="flex justify-between"><span className="text-sm text-gray-600">Remaining</span>
                  <span className={`font-bold ${budget.project.budget - budget.project.spent < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(budget.project.budget - budget.project.spent)}
                  </span>
                </div>
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
      )}

      {/* ── RISKS ── */}
      {activeTab === 'risks' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{risks.length} Risks</h3>
            <button onClick={() => { setEditRisk(null); setShowRiskForm(true) }} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              <Plus size={14} /> Add Risk
            </button>
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
                    </div>
                    <div className="font-medium text-gray-800">{risk.title}</div>
                    {risk.description && <div className="text-sm text-gray-500 mt-1">{risk.description}</div>}
                    {risk.mitigation_plan && (
                      <div className="text-xs text-blue-600 mt-1 flex items-start gap-1">
                        <CheckCircle size={12} className="mt-0.5 flex-shrink-0" />
                        {risk.mitigation_plan}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-xs text-gray-400">P: <span className="capitalize">{risk.probability}</span> · I: <span className="capitalize">{risk.impact}</span></div>
                      {risk.owner_name && <div className="text-xs text-gray-500 mt-0.5">{risk.owner_name}</div>}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditRisk(risk); setShowRiskForm(true) }} className="p-1 text-gray-400 hover:text-blue-500"><Edit size={13} /></button>
                      <button onClick={() => handleDeleteRisk(risk.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {risks.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No risks registered</div>}
          </div>
        </div>
      )}

      {/* ── ISSUES ── */}
      {activeTab === 'issues' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{issues.length} Issues</h3>
            <button onClick={() => { setEditIssue(null); setShowIssueForm(true) }} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              <Plus size={14} /> Report Issue
            </button>
          </div>
          <div className="space-y-3">
            {issues.map(issue => (
              <div key={issue.id} className="bg-white rounded-xl border border-gray-200 p-4 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${issue.severity === 'critical' ? 'bg-red-100 text-red-700' : issue.severity === 'high' ? 'bg-orange-100 text-orange-700' : issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                        {issue.severity}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded capitalize ${issue.status === 'open' ? 'bg-red-50 text-red-600' : issue.status === 'in_progress' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                        {issue.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">{issue.type}</span>
                    </div>
                    <div className="font-medium text-gray-800">{issue.title}</div>
                    {issue.description && <div className="text-sm text-gray-500 mt-1">{issue.description}</div>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      {issue.assignee_name && <span>Assigned to {issue.assignee_name}</span>}
                      {issue.due_date && (
                        <span className={isPast(parseISO(issue.due_date)) && issue.status !== 'resolved' && issue.status !== 'closed' ? 'text-red-500 font-medium' : ''}>
                          Due {format(parseISO(issue.due_date), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => { setEditIssue(issue); setShowIssueForm(true) }} className="p-1 text-gray-400 hover:text-blue-500"><Edit size={13} /></button>
                    <button onClick={async () => { await issuesApi.delete(issue.id); setIssues(prev => prev.filter(i => i.id !== issue.id)); toast.success('Issue deleted') }} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
            {issues.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No issues reported</div>}
          </div>
        </div>
      )}

      {/* ── CHANGES ── */}
      {activeTab === 'changes' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{changes.length} Change Requests</h3>
          </div>
          <div className="space-y-3">
            {changes.map(cr => (
              <div key={cr.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded capitalize font-medium ${cr.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : cr.status === 'approved' ? 'bg-green-100 text-green-700' : cr.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {cr.status}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">{cr.type}</span>
                    </div>
                    <div className="font-medium text-gray-800">{cr.title}</div>
                    {cr.description && <div className="text-sm text-gray-500 mt-1">{cr.description}</div>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      {cr.impact_budget > 0 && <span>+{formatCurrency(cr.impact_budget)} budget</span>}
                      {cr.impact_schedule > 0 && <span>+{cr.impact_schedule}d schedule</span>}
                      {cr.requested_by_name && <span>By {cr.requested_by_name}</span>}
                    </div>
                  </div>
                  {cr.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={async () => {
                          await changeRequestsApi.update(cr.id, { ...cr, status: 'approved', decision_date: new Date().toISOString().split('T')[0] })
                          setChanges(prev => prev.map(c => c.id === cr.id ? { ...c, status: 'approved' } : c))
                          toast.success('CR approved')
                        }}
                        className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={async () => {
                          await changeRequestsApi.update(cr.id, { ...cr, status: 'rejected', decision_date: new Date().toISOString().split('T')[0] })
                          setChanges(prev => prev.map(c => c.id === cr.id ? { ...c, status: 'rejected' } : c))
                          toast.success('CR rejected')
                        }}
                        className="px-3 py-1.5 text-xs bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {changes.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No change requests</div>}
          </div>
        </div>
      )}

      {/* ── TEAM ── */}
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

      {/* ── DOCS ── */}
      {activeTab === 'docs' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{documents.length} Documents & Links</h3>
            <button onClick={() => setShowDocForm(true)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              <Plus size={14} /> Add Link
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {documents.map(doc => (
              <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-4 group flex items-start gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ExternalLink size={16} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 truncate">{doc.name}</div>
                  {doc.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-blue-600 hover:underline truncate block">{doc.url}</a>}
                  {doc.description && <div className="text-xs text-gray-500 mt-0.5">{doc.description}</div>}
                  <div className="text-xs text-gray-400 mt-1">by {doc.uploaded_by_name}</div>
                </div>
                <button onClick={async () => {
                  await projectsApi.deleteDocument(Number(id), doc.id)
                  setDocuments(prev => prev.filter(d => d.id !== doc.id))
                  toast.success('Removed')
                }} className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {documents.length === 0 && (
              <div className="col-span-2 text-center py-8 text-gray-400 text-sm">
                <ExternalLink size={24} className="mx-auto mb-2 opacity-30" />
                No documents or links added
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <Modal isOpen={showTaskForm} onClose={() => { setShowTaskForm(false); setEditTask(null) }} title={editTask ? 'Edit Task' : 'New Task'} size="md">
        <TaskForm task={editTask || undefined} defaultStatus={defaultTaskStatus} onSubmit={handleTaskSave} onCancel={() => { setShowTaskForm(false); setEditTask(null) }} loading={savingTask} />
      </Modal>

      <Modal isOpen={showRiskForm} onClose={() => { setShowRiskForm(false); setEditRisk(null) }} title={editRisk ? 'Edit Risk' : 'Add Risk'} size="md">
        <RiskForm risk={editRisk || undefined} members={members} onSubmit={handleRiskSave} onCancel={() => { setShowRiskForm(false); setEditRisk(null) }} loading={savingRisk} />
      </Modal>

      <Modal isOpen={showIssueForm} onClose={() => { setShowIssueForm(false); setEditIssue(null) }} title={editIssue ? 'Edit Issue' : 'Report Issue'} size="md">
        <IssueForm issue={editIssue || undefined} members={members} onSubmit={handleIssueSave} onCancel={() => { setShowIssueForm(false); setEditIssue(null) }} loading={savingIssue} />
      </Modal>

      <Modal isOpen={showMilestoneForm} onClose={() => { setShowMilestoneForm(false); setEditMilestone(null) }} title={editMilestone ? 'Edit Milestone' : 'Add Milestone'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input type="text" value={milestoneForm.name} onChange={e => setMilestoneForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" value={milestoneForm.date} onChange={e => setMilestoneForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={milestoneForm.status} onChange={e => setMilestoneForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="upcoming">Upcoming</option>
                <option value="achieved">Achieved</option>
                <option value="missed">Missed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input type="text" value={milestoneForm.description} onChange={e => setMilestoneForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowMilestoneForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={handleSaveMilestone} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {editMilestone ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDocForm} onClose={() => setShowDocForm(false)} title="Add Document / Link" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input type="text" value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Technical Spec, Meeting Notes..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <input type="url" value={docForm.url} onChange={e => setDocForm(f => ({ ...f, url: e.target.value }))}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input type="text" value={docForm.description} onChange={e => setDocForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDocForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={handleAddDocument} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
