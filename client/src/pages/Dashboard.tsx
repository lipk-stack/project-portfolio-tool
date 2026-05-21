import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Minus, FolderOpen, CheckCircle, AlertTriangle, DollarSign,
  Users, Shield, Calendar, Activity, Clock, ArrowRight, Sparkles, Target, Zap,
  LucideIcon
} from 'lucide-react'
import { dashboardApi, reportsApi, goalsApi } from '../api'
import { DashboardSummary, Milestone, ActivityItem } from '../types'
import Card from '../components/ui/Card'
import { HealthDot } from '../components/ui/Badge'
import Progress from '../components/ui/Progress'
import Avatar from '../components/ui/Avatar'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts'

interface Insight { type: string; severity: string; title: string; detail: string }

function KPICard({ title, value, subtitle, icon: Icon, color, trend, onClick }: {
  title: string; value: string | number; subtitle: string
  icon: LucideIcon; color: string; trend?: 'up' | 'down' | 'neutral'; onClick?: () => void
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400'
  return (
    <Card className={`relative overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full opacity-5 -translate-y-1/2 translate-x-1/2 ${color}`} />
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} bg-opacity-15`}>
          <Icon size={20} className={color.replace('bg-', 'text-')} />
        </div>
        {trend && <TrendIcon size={16} className={trendColor} />}
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-0.5">{value}</div>
      <div className="text-sm font-medium text-gray-600">{title}</div>
      <div className="text-xs text-gray-400 mt-1">{subtitle}</div>
    </Card>
  )
}

function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n}`
}

const HEALTH_COLORS = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444' }

const INSIGHT_SEVERITY_STYLE: Record<string, { bg: string; border: string; dot: string; icon: string }> = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500', icon: 'text-red-600' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', icon: 'text-amber-600' },
  info: { bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500', icon: 'text-blue-600' },
}

function getActionText(action: string, details?: string): string {
  try {
    const d = details ? JSON.parse(details) : {}
    switch (action) {
      case 'task_completed': return `Completed task "${d.task || ''}"`
      case 'health_changed': return `Changed health from ${d.from} to ${d.to}`
      case 'risk_raised': return `Raised risk: ${d.risk || d.title || ''}`
      case 'comment_added': return d.message ? `"${d.message}"` : 'Added a comment'
      case 'milestone_approaching': return `Milestone "${d.milestone}" in ${d.daysLeft} days`
      case 'budget_updated': return d.note || 'Updated budget'
      case 'created': return `Created project "${d.name || ''}"`
      case 'task_created': return `Created task "${d.name || ''}"`
      default: return action.replace(/_/g, ' ')
    }
  } catch { return action }
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])
  const [goals, setGoals] = useState<Array<{ id: number; title: string; progress_pct: number; status: string; category: string }>>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      dashboardApi.summary(),
      reportsApi.insights(),
      goalsApi.list(),
    ]).then(([summaryRes, insightRes, goalsRes]) => {
      setData(summaryRes.data)
      setInsights(insightRes.data.insights || [])
      setGoals(goalsRes.data.goals || [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!data) return null
  const { kpis, upcomingMilestones, recentActivity, portfolioHealth, resourceUtilization, weeklyHours } = data

  const pieData = [
    { name: 'On Track', value: kpis.onTrack, color: HEALTH_COLORS.green },
    { name: 'At Risk', value: kpis.atRisk, color: HEALTH_COLORS.yellow },
    { name: 'Off Track', value: kpis.behind, color: HEALTH_COLORS.red },
  ].filter(d => d.value > 0)

  const criticalInsights = insights.filter(i => i.severity === 'critical')
  const warningInsights = insights.filter(i => i.severity === 'warning')

  const weekHoursData = (weeklyHours as Array<{ date: string; total_hours: number }>).map(w => ({
    day: format(parseISO(w.date), 'EEE'),
    hours: w.total_hours,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/timeline')} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            <Calendar size={16} /> Timeline
          </button>
          <button onClick={() => navigate('/projects')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <FolderOpen size={16} /> All Projects
          </button>
        </div>
      </div>

      {/* Smart Insights Banner */}
      {insights.length > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-blue-200" />
            <span className="text-sm font-semibold text-blue-100">Smart Insights</span>
            <span className="ml-auto text-xs text-blue-200">{insights.length} action item{insights.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {insights.slice(0, 3).map((insight, i) => {
              const style = INSIGHT_SEVERITY_STYLE[insight.severity]
              return (
                <div key={i} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-white/10 border border-white/20`}>
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${style.dot}`} />
                  <div>
                    <p className="text-sm font-medium text-white leading-snug">{insight.title}</p>
                    <p className="text-xs text-blue-200 mt-0.5">{insight.detail}</p>
                  </div>
                </div>
              )
            })}
          </div>
          {insights.length > 3 && (
            <button onClick={() => navigate('/reports')} className="mt-3 text-xs text-blue-200 hover:text-white flex items-center gap-1 transition-colors">
              View all {insights.length} insights <ArrowRight size={12} />
            </button>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Active Projects"
          value={kpis.activeProjects}
          subtitle={`${kpis.totalProjects} total · ${kpis.completed} completed`}
          icon={FolderOpen}
          color="bg-blue-500"
          trend="neutral"
          onClick={() => navigate('/projects')}
        />
        <KPICard
          title="On Track"
          value={kpis.onTrack}
          subtitle={`${kpis.atRisk} at risk · ${kpis.behind} behind`}
          icon={CheckCircle}
          color="bg-green-500"
          trend={kpis.behind > 2 ? 'down' : 'up'}
          onClick={() => navigate('/portfolio')}
        />
        <KPICard
          title="Budget Used"
          value={`${kpis.budgetUtilization}%`}
          subtitle={`${formatCurrency(kpis.totalSpent)} of ${formatCurrency(kpis.totalBudget)}`}
          icon={DollarSign}
          color={kpis.budgetUtilization > 90 ? 'bg-red-500' : 'bg-purple-500'}
          trend={kpis.budgetUtilization > 90 ? 'down' : 'neutral'}
        />
        <KPICard
          title="Open Risks"
          value={kpis.openRisks}
          subtitle={`${kpis.highRisks} high severity`}
          icon={Shield}
          color={kpis.highRisks > 3 ? 'bg-red-500' : 'bg-orange-500'}
          trend={kpis.highRisks > 3 ? 'down' : 'neutral'}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Portfolio Health table */}
        <div className="col-span-12 lg:col-span-8">
          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Target size={16} className="text-gray-400" />
                Portfolio Health
              </h2>
              <button onClick={() => navigate('/portfolio')} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">View all <ArrowRight size={14} /></button>
            </div>
            <div className="divide-y divide-gray-50">
              {(portfolioHealth as Array<Record<string, any>>).slice(0, 7).map(project => (
                <div key={project.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/projects/${project.id}`)}>
                  <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <HealthDot health={project.health} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-800 truncate">{project.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0 capitalize hidden md:inline">{project.status.replace('_', ' ')}</span>
                    </div>
                    <Progress value={project.completion_percent} size="sm" color="auto" />
                  </div>
                  <div className="text-right flex-shrink-0 w-20">
                    <div className="text-sm font-semibold text-gray-700">{project.completion_percent}%</div>
                    <div className="text-xs text-gray-400">{formatCurrency(project.spent)}</div>
                  </div>
                  <div className="text-right flex-shrink-0 hidden md:block w-20">
                    <div className="text-xs text-gray-500">Budget</div>
                    <div className={`text-sm font-medium ${project.budget > 0 && project.spent / project.budget > 0.9 ? 'text-red-600' : 'text-gray-700'}`}>
                      {project.budget > 0 ? `${Math.round((project.spent / project.budget) * 100)}%` : '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="col-span-12 lg:col-span-4 space-y-5">
          {/* Health donut */}
          <Card>
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Zap size={15} className="text-gray-400" />Project Health</h2>
            {pieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={110} height={110}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" strokeWidth={0}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {pieData.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-gray-600 flex-1">{d.name}</span>
                      <span className="text-xs font-bold text-gray-900">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center py-4">No active projects</div>
            )}
          </Card>

          {/* Team utilization */}
          <Card>
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Users size={15} className="text-gray-400" />Team Utilization</h2>
            <div className="space-y-3">
              {(resourceUtilization as Array<Record<string, any>>).slice(0, 5).map(r => (
                <div key={r.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.name} size="xs" />
                      <span className="text-xs font-medium text-gray-700 truncate max-w-[100px]">{r.name}</span>
                    </div>
                    <span className={`text-xs font-semibold ${r.total_allocation > 100 ? 'text-red-500' : r.total_allocation > 80 ? 'text-yellow-600' : 'text-gray-600'}`}>
                      {r.total_allocation}%
                    </span>
                  </div>
                  <Progress value={r.total_allocation} max={100} size="sm" color={r.total_allocation > 100 ? 'red' : r.total_allocation > 80 ? 'yellow' : 'green'} />
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/resources')} className="w-full text-center text-xs text-blue-600 hover:text-blue-700 mt-3 py-1">View all resources →</button>
          </Card>
        </div>

        {/* Weekly hours chart */}
        {weekHoursData.length > 0 && (
          <div className="col-span-12 md:col-span-6">
            <Card>
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Activity size={15} className="text-gray-400" />Hours Logged (This Week)</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={weekHoursData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v}h`, 'Hours']} />
                  <Bar dataKey="hours" fill="#3b82f6" radius={[3, 3, 0, 0]}>
                    {weekHoursData.map((_, i) => (
                      <Cell key={i} fill={['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekHoursData[i].day) ? '#3b82f6' : '#e2e8f0'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* Upcoming Milestones */}
        <div className={`col-span-12 ${weekHoursData.length > 0 ? 'md:col-span-6' : 'md:col-span-6'}`}>
          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Calendar size={16} className="text-gray-400" /> Milestones</h2>
              <span className="text-xs text-gray-400">Next 30 days</span>
            </div>
            {upcomingMilestones.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No upcoming milestones in the next 30 days</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {(upcomingMilestones as Array<Milestone & { project_color?: string; project_name?: string }>).map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/projects/${m.project_id}`)}>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.project_color || '#3b82f6' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{m.name}</div>
                      <div className="text-xs text-gray-400 truncate">{m.project_name}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-semibold text-gray-700">{format(parseISO(m.date), 'MMM d')}</div>
                      <div className="text-xs text-gray-400">{formatDistanceToNow(parseISO(m.date), { addSuffix: true })}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Goals & OKRs widget */}
        {goals.length > 0 && (
          <div className="col-span-12 md:col-span-6">
            <Card padding="none">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Target size={16} className="text-blue-500" /> Goals & OKRs</h2>
                <button onClick={() => navigate('/goals')} className="text-xs text-blue-600 hover:text-blue-700">View all →</button>
              </div>
              <div className="divide-y divide-gray-50">
                {goals.filter(g => g.status === 'active').slice(0, 4).map(g => (
                  <div key={g.id} className="px-5 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/goals')}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 truncate flex-1 mr-2">{g.title}</span>
                      <span className={`text-xs font-bold flex-shrink-0 ${g.progress_pct >= 70 ? 'text-green-600' : g.progress_pct >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>{g.progress_pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className={`h-1.5 rounded-full ${g.progress_pct >= 70 ? 'bg-green-500' : g.progress_pct >= 40 ? 'bg-yellow-500' : 'bg-red-400'}`} style={{ width: `${Math.min(100, g.progress_pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Recent Activity */}
        <div className={`col-span-12 ${goals.length > 0 ? 'md:col-span-6' : ''}`}>
          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Activity size={16} className="text-gray-400" /> Recent Activity</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-50">
              {(recentActivity as Array<ActivityItem & { user_name?: string; project_name?: string }>).slice(0, 8).map((item, i) => (
                <div key={item.id} className={`flex items-start gap-3 px-5 py-3 hover:bg-gray-50 ${i < 2 ? '' : 'border-t border-gray-50'}`}>
                  <Avatar name={item.user_name || 'U'} size="xs" className="mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-700">
                      <span className="font-medium">{item.user_name}</span>{' '}
                      {getActionText(item.action, item.details)}
                    </div>
                    {item.project_name && (
                      <div className="text-xs text-blue-600 truncate mt-0.5">{item.project_name}</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0 flex items-center gap-1">
                    <Clock size={10} />
                    {formatDistanceToNow(parseISO(item.created_at), { addSuffix: true })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
