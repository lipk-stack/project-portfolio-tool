import { useEffect, useState } from 'react'
import { reportsApi } from '../api'
import Card from '../components/ui/Card'
import Progress from '../components/ui/Progress'
import { BarChart2, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, PieChart, Pie, Legend, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts'

interface ReportData {
  projectsByStatus: Array<{ status: string; count: number }>
  projectsByHealth: Array<{ health: string; count: number }>
  budgetPerformance: Array<{ name: string; budget: number; spent: number; completion_percent: number; spend_rate: number; health: string; color: string }>
  taskCompletionByProject: Array<{ name: string; color: string; total_tasks: number; done_tasks: number; completion_rate: number }>
  velocityData: Array<{ week: string; points_completed: number }>
  hoursLogged: Array<{ name: string; color: string; total_hours: number; total_cost: number }>
  overdueTaskCount: number
  avgProjectCompletion: number
}

function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n}`
}

const STATUS_COLORS: Record<string, string> = { planning: '#94a3b8', active: '#3b82f6', on_hold: '#f59e0b', completed: '#22c55e', cancelled: '#ef4444' }
const HEALTH_COLORS: Record<string, string> = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444' }

export default function Reports() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reportsApi.overview().then(r => setData(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!data) return null

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Portfolio-wide performance metrics</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: CheckCircle, label: 'Avg Completion', value: `${data.avgProjectCompletion}%`, color: 'text-green-600 bg-green-50' },
          { icon: AlertCircle, label: 'Overdue Tasks', value: data.overdueTaskCount, color: data.overdueTaskCount > 5 ? 'text-red-600 bg-red-50' : 'text-yellow-600 bg-yellow-50' },
          { icon: TrendingUp, label: 'Active Projects', value: data.projectsByStatus.find(s => s.status === 'active')?.count || 0, color: 'text-blue-600 bg-blue-50' },
          { icon: BarChart2, label: 'Completed', value: data.projectsByStatus.find(s => s.status === 'completed')?.count || 0, color: 'text-purple-600 bg-purple-50' },
        ].map((kpi, i) => (
          <Card key={i} className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${kpi.color} flex items-center justify-center flex-shrink-0`}>
              <kpi.icon size={22} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
              <div className="text-sm text-gray-500">{kpi.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Row 1: Budget Performance + Health */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8">
          <Card>
            <h3 className="font-semibold text-gray-900 mb-1">Budget Performance by Project</h3>
            <p className="text-xs text-gray-400 mb-4">Spend rate vs. planned budget</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.budgetPerformance} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={45} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[0, 120]} />
                <Tooltip formatter={(v: number, name: string) => [name === 'spend_rate' ? `${v}%` : `${v}%`, name === 'spend_rate' ? 'Budget Used' : 'Completion']} />
                <Legend />
                <Bar dataKey="completion_percent" name="Completion %" fill="#dbeafe" radius={[3, 3, 0, 0]} />
                <Bar dataKey="spend_rate" name="Budget Used %" radius={[3, 3, 0, 0]}>
                  {data.budgetPerformance.map((d, i) => <Cell key={i} fill={d.spend_rate > 100 ? '#ef4444' : d.spend_rate > 90 ? '#f59e0b' : d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
        <div className="col-span-12 lg:col-span-4 space-y-5">
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Project Health</h3>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={data.projectsByHealth.map(d => ({ ...d, color: HEALTH_COLORS[d.health] }))} cx="50%" cy="50%" outerRadius={60} dataKey="count">
                  {data.projectsByHealth.map((d, i) => <Cell key={i} fill={HEALTH_COLORS[d.health]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1">
              {data.projectsByHealth.map(d => (
                <div key={d.health} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: HEALTH_COLORS[d.health] }} />
                    <span className="text-xs text-gray-600 capitalize">{d.health === 'green' ? 'On Track' : d.health === 'yellow' ? 'At Risk' : 'Off Track'}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{d.count}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Project Status</h3>
            <div className="space-y-2">
              {data.projectsByStatus.map(d => (
                <div key={d.status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.status] }} />
                    <span className="text-xs capitalize text-gray-600">{d.status.replace('_', ' ')}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{d.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Task Completion */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-6">
          <Card>
            <h3 className="font-semibold text-gray-900 mb-1">Task Completion by Project</h3>
            <p className="text-xs text-gray-400 mb-4">Completed / Total tasks</p>
            <div className="space-y-3">
              {data.taskCompletionByProject.map(p => (
                <div key={p.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-sm text-gray-700 truncate max-w-[180px]">{p.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{p.done_tasks}/{p.total_tasks} tasks</span>
                  </div>
                  <Progress value={p.completion_rate} size="sm" color="auto" showLabel />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <Card>
            <h3 className="font-semibold text-gray-900 mb-1">Hours Logged (Last 30 Days)</h3>
            <p className="text-xs text-gray-400 mb-4">By project</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.hoursLogged} layout="vertical" margin={{ left: 80, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(v: number, name: string) => [name === 'total_hours' ? `${v}h` : formatCurrency(v), name === 'total_hours' ? 'Hours' : 'Labor Cost']} />
                <Bar dataKey="total_hours" name="Hours" radius={[0, 4, 4, 0]}>
                  {data.hoursLogged.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>

      {/* Velocity */}
      {data.velocityData.length > 0 && (
        <Card>
          <h3 className="font-semibold text-gray-900 mb-1">Sprint Velocity</h3>
          <p className="text-xs text-gray-400 mb-4">Story points completed per week (last 12 weeks)</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.velocityData}>
              <defs>
                <linearGradient id="velocityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="points_completed" name="Story Points" stroke="#3b82f6" fill="url(#velocityGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}
