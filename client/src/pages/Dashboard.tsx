import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Minus, FolderOpen, CheckCircle, AlertTriangle,
  DollarSign, Users, Shield, Calendar, Activity, Clock, ArrowRight,
  LucideIcon, Lightbulb, Zap, Map
} from 'lucide-react'
import { dashboardApi, exportApi } from '../api'
import { DashboardSummary, Milestone, ActivityItem } from '../types'
import Card from '../components/ui/Card'
import { HealthDot } from '../components/ui/Badge'
import Progress from '../components/ui/Progress'
import Avatar from '../components/ui/Avatar'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts'

function KPICard({ title, value, subtitle, icon: Icon, color, trend }: {
  title: string; value: string | number; subtitle: string
  icon: LucideIcon; color: string; trend?: 'up' | 'down' | 'neutral'
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400'
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-20 h-20 rounded-full opacity-10 -translate-y-1/2 translate-x-1/2 ${color}`} />
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
const SEVERITY_CONFIG = {
  critical: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', icon: 'text-red-500', dot: 'bg-red-500' },
  warning: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800', icon: 'text-yellow-500', dot: 'bg-yellow-500' },
  info: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: 'text-blue-500', dot: 'bg-blue-500' },
}

function getActionText(action: string, details?: string): string {
  try {
    const d = details ? JSON.parse(details) : {}
    switch (action) {
      case 'task_completed': return `Completed task "${d.task || ''}"`
      case 'health_changed': return `Changed health from ${d.from} to ${d.to}`
      case 'risk_raised': return `Raised risk: ${d.risk || d.title || ''}`
      case 'comment_added': return d.preview ? `Commented: "${d.preview}"` : 'Added a comment'
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
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    dashboardApi.summary().then(r => setData(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!data) return null
  const { kpis, upcomingMilestones, recentActivity, portfolioHealth, resourceUtilization, weeklyHours, insights } = data

  const pieData = [
    { name: 'On Track', value: kpis.onTrack, color: '#22c55e' },
    { name: 'At Risk', value: kpis.atRisk, color: '#f59e0b' },
    { name: 'Off Track', value: kpis.behind, color: '#ef4444' },
  ].filter(d => d.value > 0)

  const weeklyData = weeklyHours.slice(-14).map(d => ({
    date: format(parseISO(d.date), 'MMM d'),
    hours: d.total_hours,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/roadmap')} className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
            <Map size={15} /> Roadmap
          </button>
          <button onClick={() => navigate('/projects')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <FolderOpen size={16} /> All Projects
          </button>
        </div>
      </div>

      {/* Smart Insights */}
      {insights && insights.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Lightbulb size={15} className="text-yellow-500" />
            Smart Insights
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.map((insight, i) => {
              const cfg = SEVERITY_CONFIG[insight.severity]
              return (
                <div key={i} className={`rounded-xl border p-3.5 ${cfg.bg}`}>
                  <div className="flex items-start gap-2.5">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
                    <div>
                      <div className={`text-xs font-semibold mb-0.5 ${cfg.text}`}>{insight.title}</div>
                      <div className="text-xs text-gray-600 leading-relaxed">{insight.message}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Active Projects" value={kpis.activeProjects} subtitle={`${kpis.totalProjects} total · ${kpis.completed} completed`} icon={FolderOpen} color="bg-blue-500" trend="neutral" />
        <KPICard title="On Track" value={kpis.onTrack} subtitle={`${kpis.atRisk} at risk · ${kpis.behind} behind`} icon={CheckCircle} color="bg-green-500" trend={kpis.behind > 2 ? 'down' : 'up'} />
        <KPICard title="Budget Used" value={`${kpis.budgetUtilization}%`} subtitle={`${formatCurrency(kpis.totalSpent)} of ${formatCurrency(kpis.totalBudget)}`} icon={DollarSign} color={kpis.budgetUtilization > 90 ? 'bg-red-500' : 'bg-purple-500'} />
        <KPICard title="Open Risks" value={kpis.openRisks} subtitle={`${kpis.highRisks} high severity`} icon={Shield} color={kpis.highRisks > 3 ? 'bg-red-500' : 'bg-orange-500'} trend={kpis.highRisks > 3 ? 'down' : 'neutral'} />
      </div>

      {/* Additional KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Clock size={16} className="text-red-500" />
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">{kpis.overdueTaskCount}</div>
            <div className="text-xs text-gray-500">Overdue Tasks</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap size={16} className="text-blue-500" />
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">{kpis.avgVelocity}</div>
            <div className="text-xs text-gray-500">Avg Sprint Velocity</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Users size={16} className="text-green-500" />
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">{resourceUtilization.length}</div>
            <div className="text-xs text-gray-500">Team Members</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <CheckCircle size={16} className="text-purple-500" />
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">{kpis.completed}</div>
            <div className="text-xs text-gray-500">Completed Projects</div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Portfolio Health */}
        <div className="col-span-12 lg:col-span-8">
          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Portfolio Health</h2>
              <button onClick={() => navigate('/portfolio')} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">View all <ArrowRight size={14} /></button>
            </div>
            <div className="divide-y divide-gray-50">
              {portfolioHealth.slice(0, 6).map(project => (
                <div key={project.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/projects/${project.id}`)}>
                  <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <HealthDot health={project.health} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-800 truncate">{project.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0 capitalize">{project.status.replace('_', ' ')}</span>
                    </div>
                    <Progress value={project.completion_percent} size="sm" color="auto" />
                  </div>
                  <div className="text-right flex-shrink-0 w-24">
                    <div className="text-sm font-semibold text-gray-700">{project.completion_percent}%</div>
                    <div className="text-xs text-gray-400">{formatCurrency(project.spent)} spent</div>
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

        {/* Health Pie + Team Util */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Card>
            <h2 className="font-semibold text-gray-900 mb-4">Project Health</h2>
            {pieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value">
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {pieData.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-gray-600">{d.name}</span>
                      <span className="text-xs font-bold text-gray-900 ml-auto">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center py-4">No active projects</div>
            )}
          </Card>

          <Card>
            <h2 className="font-semibold text-gray-900 mb-3">Team Utilization</h2>
            <div className="space-y-3">
              {resourceUtilization.slice(0, 5).map(r => (
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

        {/* Weekly Hours Chart */}
        {weeklyData.length > 0 && (
          <div className="col-span-12 lg:col-span-8">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Hours Logged (Last 2 Weeks)</h2>
                <button onClick={() => exportApi.timelog()} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Export →</button>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={1} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`${v}h`, 'Hours Logged']} />
                  <Area type="monotone" dataKey="hours" stroke="#3b82f6" fill="url(#hoursGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* Upcoming Milestones */}
        <div className={`col-span-12 ${weeklyData.length > 0 ? 'md:col-span-6 lg:col-span-4' : 'md:col-span-6'}`}>
          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Calendar size={16} className="text-gray-400" /> Upcoming Milestones</h2>
            </div>
            {upcomingMilestones.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No upcoming milestones in 30 days</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcomingMilestones.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: (m as Milestone & { project_color?: string }).project_color || '#3b82f6' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{m.name}</div>
                      <div className="text-xs text-gray-400 truncate">{(m as Milestone & { project_name?: string }).project_name}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-medium text-gray-700">{format(parseISO(m.date), 'MMM d')}</div>
                      <div className="text-xs text-gray-400">{formatDistanceToNow(parseISO(m.date), { addSuffix: true })}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="col-span-12 md:col-span-6">
          <Card padding="none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Activity size={16} className="text-gray-400" /> Recent Activity</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {recentActivity.slice(0, 6).map(item => (
                <div key={item.id} className="flex items-start gap-3 px-5 py-3">
                  <Avatar name={(item as ActivityItem & { user_name?: string }).user_name || 'U'} size="xs" className="mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-700">
                      <span className="font-medium">{(item as ActivityItem & { user_name?: string }).user_name}</span>{' '}
                      {getActionText(item.action, item.details)}
                    </div>
                    {(item as ActivityItem & { project_name?: string }).project_name && (
                      <div className="text-xs text-blue-600 truncate">{(item as ActivityItem & { project_name?: string }).project_name}</div>
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
