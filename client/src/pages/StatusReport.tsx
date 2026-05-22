import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { ArrowLeft, Printer, CheckCircle, AlertTriangle, Clock, DollarSign, Users, Target, TrendingUp, TrendingDown, Shield } from 'lucide-react'
import { projectsApi, tasksApi, risksApi, budgetApi, evmApi } from '../api'

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

const HEALTH_LABELS: Record<string, string> = { green: 'On Track', yellow: 'At Risk', red: 'Off Track' }
const HEALTH_COLORS: Record<string, string> = { green: 'text-green-700 bg-green-50 border-green-200', yellow: 'text-amber-700 bg-amber-50 border-amber-200', red: 'text-red-700 bg-red-50 border-red-200' }

export default function StatusReport() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [risks, setRisks] = useState<any[]>([])
  const [budget, setBudget] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [milestones, setMilestones] = useState<any[]>([])
  const [evmProjects, setEvmProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      projectsApi.get(Number(id)),
      tasksApi.list(Number(id)),
      risksApi.list(Number(id)),
      budgetApi.get(Number(id)),
      evmApi.metrics(),
    ]).then(([projRes, tasksRes, risksRes, budgetRes, evmRes]) => {
      setProject(projRes.data.project)
      setMembers(projRes.data.members)
      setMilestones(projRes.data.milestones)
      setTasks(tasksRes.data.tasks)
      setRisks(risksRes.data.risks)
      setBudget(budgetRes.data)
      setEvmProjects(evmRes.data.projects || [])
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!project) return <div className="text-center text-gray-500 py-8">Project not found</div>

  const evm = evmProjects.find((p: any) => p.id === Number(id))
  const openRisks = risks.filter(r => r.status === 'open')
  const criticalRisks = openRisks.filter(r => r.score >= 6)
  const doneTasks = tasks.filter(t => t.status === 'done')
  const overdueTasks = tasks.filter(t => t.end_date && new Date(t.end_date) < new Date() && t.status !== 'done')
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress' || t.status === 'review')
  const upcomingMilestones = milestones.filter(m => m.status !== 'missed' && new Date(m.date) > new Date()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const budgetPct = project.budget > 0 ? Math.round((project.spent / project.budget) * 100) : 0

  // Suppress unused variable warning - budget is loaded but not currently used in display
  void budget

  return (
    <div className="max-w-4xl mx-auto">
      {/* Toolbar - hidden in print */}
      <div className="flex items-center gap-4 mb-6 print:hidden">
        <Link to={`/projects/${id}`} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
          <ArrowLeft size={16} /> Back to Project
        </Link>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          <Printer size={16} /> Export PDF
        </button>
      </div>

      {/* Report */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm print:shadow-none print:border-0">
        {/* Header */}
        <div className="border-b border-gray-200 p-8 print:p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Weekly Status Report</div>
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${HEALTH_COLORS[project.health]}`}>
                  {HEALTH_LABELS[project.health] || project.health}
                </span>
                <span className="text-gray-400 text-sm">•</span>
                <span className="text-gray-600 text-sm capitalize">{project.status?.replace('_', ' ')}</span>
                {project.phase && <><span className="text-gray-400 text-sm">•</span><span className="text-gray-600 text-sm">{project.phase}</span></>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Report Date</div>
              <div className="text-lg font-semibold text-gray-800">{format(new Date(), 'MMMM d, yyyy')}</div>
              {project.manager_name && (
                <div className="text-sm text-gray-500 mt-1">PM: {project.manager_name}</div>
              )}
            </div>
          </div>
        </div>

        <div className="p-8 print:p-6 space-y-8">
          {/* Summary KPIs */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Executive Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Target, label: 'Completion', value: `${project.completion_percent}%`, sub: `${doneTasks.length}/${tasks.length} tasks done`, good: project.completion_percent > 50 },
                { icon: DollarSign, label: 'Budget', value: `${budgetPct}%`, sub: `${formatCurrency(project.spent)} of ${formatCurrency(project.budget)}`, good: budgetPct < 90 },
                { icon: Shield, label: 'Open Risks', value: openRisks.length, sub: `${criticalRisks.length} critical`, good: criticalRisks.length === 0 },
                { icon: Clock, label: 'Overdue', value: overdueTasks.length, sub: `${inProgressTasks.length} in progress`, good: overdueTasks.length === 0 },
              ].map(({ icon: Icon, label, value, sub, good }) => (
                <div key={label} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={14} className={good ? 'text-green-500' : 'text-red-500'} />
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
                  </div>
                  <div className={`text-2xl font-bold ${good ? 'text-gray-900' : 'text-red-600'}`}>{value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* EVM Metrics */}
          {evm && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Earned Value Performance</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 rounded-lg p-4">
                {[
                  { label: 'CPI (Cost)', value: evm.CPI?.toFixed(2), good: evm.CPI >= 1, desc: evm.CPI >= 1 ? 'Under budget' : 'Over budget' },
                  { label: 'SPI (Schedule)', value: evm.SPI?.toFixed(2), good: evm.SPI >= 1, desc: evm.SPI >= 1 ? 'Ahead' : 'Behind' },
                  { label: 'EAC', value: formatCurrency(evm.EAC), good: evm.EAC <= evm.BAC, desc: `vs ${formatCurrency(evm.BAC)} budget` },
                  { label: 'VAC', value: formatCurrency(Math.abs(evm.VAC)), good: evm.VAC >= 0, desc: evm.VAC >= 0 ? 'Favorable' : 'Unfavorable' },
                ].map(({ label, value, good, desc }) => (
                  <div key={label}>
                    <div className="text-xs text-gray-500 mb-1">{label}</div>
                    <div className={`text-xl font-bold flex items-center gap-1 ${good ? 'text-green-700' : 'text-red-700'}`}>
                      {value}
                      {good ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    </div>
                    <div className="text-xs text-gray-400">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Schedule Progress</h2>
            <div className="space-y-1 mb-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Overall Completion</span>
                <span className="font-semibold text-gray-900">{project.completion_percent}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${project.completion_percent}%` }} />
              </div>
            </div>
            {project.start_date && project.end_date && (
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Start: {format(parseISO(project.start_date), 'MMM d, yyyy')}</span>
                <span>End: {format(parseISO(project.end_date), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>

          {/* Upcoming Milestones */}
          {upcomingMilestones.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Upcoming Milestones</h2>
              <div className="space-y-2">
                {upcomingMilestones.slice(0, 4).map(m => (
                  <div key={m.id} className="flex items-center gap-4 py-2 border-b border-gray-50">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.status === 'achieved' ? 'bg-green-500' : 'bg-blue-500'}`} />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-800">{m.name}</span>
                      {m.description && <span className="text-xs text-gray-400 ml-2">— {m.description}</span>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-700">{format(parseISO(m.date), 'MMM d, yyyy')}</div>
                      <div className="text-xs text-gray-400">{formatDistanceToNow(parseISO(m.date), { addSuffix: true })}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tasks in Progress */}
          {inProgressTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Work in Progress ({inProgressTasks.length})</h2>
              <div className="space-y-2">
                {inProgressTasks.slice(0, 6).map(t => (
                  <div key={t.id} className="flex items-center gap-3 py-2 border-b border-gray-50">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status === 'review' ? 'bg-amber-400' : 'bg-blue-500'}`} />
                    <div className="flex-1">
                      <span className="text-sm text-gray-800">{t.name}</span>
                      {t.assignee_name && <span className="text-xs text-gray-400 ml-2">· {t.assignee_name}</span>}
                    </div>
                    <div className="text-xs text-gray-500">{t.completion_percent}% complete</div>
                    {t.end_date && <div className="text-xs text-gray-400">{format(parseISO(t.end_date), 'MMM d')}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overdue Tasks */}
          {overdueTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-red-500 uppercase tracking-wider mb-4">⚠ Overdue Tasks ({overdueTasks.length})</h2>
              <div className="space-y-2">
                {overdueTasks.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center gap-3 py-2 border-b border-red-50 bg-red-50/30 px-3 rounded">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-800">{t.name}</span>
                      {t.assignee_name && <span className="text-xs text-gray-400 ml-2">· {t.assignee_name}</span>}
                    </div>
                    <div className="text-xs text-red-600 font-medium">
                      {t.end_date ? `Due ${format(parseISO(t.end_date), 'MMM d')}` : 'No due date'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risks */}
          {openRisks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Open Risks ({openRisks.length})</h2>
              <div className="space-y-2">
                {openRisks.sort((a, b) => b.score - a.score).slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-start gap-3 py-2 border-b border-gray-50">
                    <div className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center text-xs font-bold text-white ${r.score >= 6 ? 'bg-red-500' : r.score >= 4 ? 'bg-amber-500' : 'bg-yellow-400'}`}>
                      {r.score}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-800">{r.title}</div>
                      {r.mitigation_plan && <div className="text-xs text-gray-500 mt-0.5">Mitigation: {r.mitigation_plan}</div>}
                    </div>
                    <div className="text-xs text-gray-400 capitalize">{r.category}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team */}
          {members.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Team ({members.length})</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {members.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-800">{m.name}</div>
                      <div className="text-xs text-gray-400">{m.role} · {m.allocation_percent}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-100 pt-6 text-xs text-gray-400 flex justify-between">
            <span>Generated by ProjectPulse · {format(new Date(), 'MMMM d, yyyy HH:mm')}</span>
            <span>Confidential</span>
          </div>
        </div>
      </div>
    </div>
  )
}
