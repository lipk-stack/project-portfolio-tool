import { useEffect, useState } from 'react'
import { resourcesApi } from '../api'
import api from '../api'
import { ResourceSummary } from '../types'
import Card from '../components/ui/Card'
import Progress from '../components/ui/Progress'
import Avatar from '../components/ui/Avatar'
import { Users, TrendingUp, AlertTriangle, Clock, LucideIcon, Activity } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { format, parseISO } from 'date-fns'

type ViewType = 'overview' | 'matrix' | 'heatmap'

interface HeatmapUser {
  id: number; name: string; department: string; capacity: number
  weeks: Array<{ week: string; hours: number; utilPct: number }>
}

function HeatCell({ utilPct, hours }: { utilPct: number; hours: number }) {
  const bg = utilPct === 0 ? 'bg-gray-100'
    : utilPct < 50 ? 'bg-blue-100'
    : utilPct < 80 ? 'bg-green-200'
    : utilPct < 100 ? 'bg-yellow-300'
    : utilPct < 120 ? 'bg-orange-400'
    : 'bg-red-500'
  const text = utilPct >= 100 ? 'text-white' : 'text-gray-700'
  return (
    <div
      className={`w-10 h-8 rounded flex items-center justify-center text-xs font-medium ${bg} ${text} cursor-default`}
      title={`${hours}h logged (${utilPct}% utilization)`}
    >
      {hours > 0 ? `${hours}` : ''}
    </div>
  )
}

export default function Resources() {
  const [resources, setResources] = useState<ResourceSummary[]>([])
  const [matrix, setMatrix] = useState<{ users: Array<{ id: number; name: string; department: string }>; projects: Array<{ id: number; name: string; color: string }>; matrix: Array<{ user_id: number; project_id: number; allocation_percent: number | null }> } | null>(null)
  const [heatmapData, setHeatmapData] = useState<{ heatmap: HeatmapUser[]; weeks: string[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<ViewType>('overview')

  useEffect(() => {
    Promise.all([
      resourcesApi.list(),
      resourcesApi.allocationMatrix(),
      api.get('/resources/workload-heatmap'),
    ]).then(([rRes, mRes, heatRes]) => {
      setResources(rRes.data.resources)
      setMatrix(mRes.data)
      setHeatmapData(heatRes.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const overallocated = resources.filter(r => r.total_allocation > 100)
  const underutilized = resources.filter(r => r.total_allocation < 50)
  const avgUtilization = resources.length ? Math.round(resources.reduce((s, r) => s + r.total_allocation, 0) / resources.length) : 0

  const deptData = resources.reduce((acc: Record<string, { total: number; count: number }>, r) => {
    const dept = r.department || 'Other'
    if (!acc[dept]) acc[dept] = { total: 0, count: 0 }
    acc[dept].total += r.total_allocation
    acc[dept].count += 1
    return acc
  }, {})

  const chartData = Object.entries(deptData).map(([dept, d]) => ({
    department: dept,
    utilization: Math.round(d.total / d.count),
    headcount: d.count,
  }))

  const views: Array<{ id: ViewType; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'matrix', label: 'Allocation Matrix' },
    { id: 'heatmap', label: 'Workload Heatmap' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resource Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{resources.length} team members · avg {avgUtilization}% utilization</p>
        </div>
        <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
          {views.map(v => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              className={`px-3 py-2 text-sm transition-colors ${activeView === v.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { icon: Users, label: 'Total Resources', value: resources.length, sub: 'Team members', color: 'bg-blue-500' },
          { icon: TrendingUp, label: 'Avg Utilization', value: `${avgUtilization}%`, sub: 'Across all projects', color: avgUtilization > 100 ? 'bg-red-500' : avgUtilization > 80 ? 'bg-green-500' : 'bg-blue-500' },
          { icon: AlertTriangle, label: 'Overallocated', value: overallocated.length, sub: 'Over 100% capacity', color: overallocated.length > 0 ? 'bg-red-500' : 'bg-green-500' },
          { icon: Clock, label: 'Underutilized', value: underutilized.length, sub: 'Under 50% capacity', color: 'bg-yellow-500' },
        ] as Array<{ icon: LucideIcon; label: string; value: string | number; sub: string; color: string }>).map((kpi, i) => (
          <Card key={i}>
            <div className={`w-10 h-10 ${kpi.color} bg-opacity-15 rounded-xl flex items-center justify-center mb-3`}>
              <kpi.icon size={20} className={kpi.color.replace('bg-', 'text-')} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-sm font-medium text-gray-600">{kpi.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{kpi.sub}</div>
          </Card>
        ))}
      </div>

      {activeView === 'overview' && (
        <>
          <div className="grid grid-cols-12 gap-5">
            {/* Utilization by dept */}
            <div className="col-span-12 lg:col-span-5">
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">Utilization by Department</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 150]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <YAxis type="category" dataKey="department" tick={{ fontSize: 11 }} width={60} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Bar dataKey="utilization" name="Avg Utilization" radius={[0, 4, 4, 0]}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.utilization > 100 ? '#ef4444' : d.utilization > 80 ? '#22c55e' : '#3b82f6'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 text-xs flex-wrap">
                  {[['#22c55e', 'Optimal (80-100%)'], ['#3b82f6', 'Available (<80%)'], ['#ef4444', 'Over (>100%)']].map(([c, l]) => (
                    <div key={l} className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                      <span className="text-gray-500">{l}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Resource list */}
            <div className="col-span-12 lg:col-span-7">
              <Card padding="none">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Team Allocation</h3>
                </div>
                <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                  {resources.map(r => (
                    <div key={r.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                      <Avatar name={r.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <span className="text-sm font-medium text-gray-800">{r.name}</span>
                            <span className="text-xs text-gray-400 ml-2">{r.department}</span>
                          </div>
                          <span className={`text-sm font-bold ${r.total_allocation > 100 ? 'text-red-500' : r.total_allocation < 50 ? 'text-yellow-600' : 'text-green-600'}`}>{r.total_allocation}%</span>
                        </div>
                        <Progress value={r.total_allocation} max={100} size="sm" color={r.total_allocation > 100 ? 'red' : r.total_allocation > 80 ? 'green' : 'blue'} />
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {r.projects?.filter(p => p.status === 'active').map(p => (
                            <span key={p.project_id} className="text-xs px-1.5 py-0.5 rounded-md text-white" style={{ backgroundColor: p.color }}>
                              {p.project_name.length > 10 ? p.project_name.slice(0, 10) + '…' : p.project_name} ({p.allocation_percent}%)
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {activeView === 'matrix' && matrix && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Allocation Matrix</h3>
            <p className="text-xs text-gray-400 mt-0.5">% allocation of each team member across active projects</p>
          </div>
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 sticky left-0 bg-gray-50 z-10 min-w-[160px]">Team Member</th>
                  {matrix.projects.map(p => (
                    <th key={p.id} className="text-center text-xs font-semibold text-gray-500 px-3 py-3 min-w-[100px]">
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="truncate max-w-[80px]">{p.name}</span>
                      </div>
                    </th>
                  ))}
                  <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3 min-w-[80px]">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {matrix.users.map(user => {
                  const userMatrix = matrix.matrix.filter(m => m.user_id === user.id)
                  const total = userMatrix.reduce((sum, m) => sum + (m.allocation_percent || 0), 0)
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-2">
                          <Avatar name={user.name} size="xs" />
                          <div>
                            <div className="text-xs font-medium text-gray-800">{user.name}</div>
                            <div className="text-xs text-gray-400">{user.department}</div>
                          </div>
                        </div>
                      </td>
                      {matrix.projects.map(p => {
                        const entry = userMatrix.find(m => m.project_id === p.id)
                        const pct = entry?.allocation_percent || 0
                        return (
                          <td key={p.id} className="px-3 py-3 text-center">
                            {pct > 0 ? (
                              <div className="inline-flex items-center justify-center w-10 h-7 rounded text-xs font-semibold text-white" style={{ backgroundColor: p.color, opacity: Math.max(0.4, pct / 100) }}>
                                {pct}%
                              </div>
                            ) : (
                              <span className="text-gray-200">—</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-3 py-3 text-center">
                        <span className={`text-sm font-bold ${total > 100 ? 'text-red-600' : total > 80 ? 'text-green-600' : 'text-gray-600'}`}>{total}%</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeView === 'heatmap' && heatmapData && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Activity size={16} className="text-gray-400" /> Workload Heatmap</h3>
                <p className="text-xs text-gray-400 mt-0.5">Hours logged per week (last 12 weeks)</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {[['bg-gray-100', '0h'], ['bg-blue-100', 'Low'], ['bg-green-200', 'Optimal'], ['bg-yellow-300', 'High'], ['bg-red-500 text-white', 'Over']].map(([cls, label]) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className={`w-4 h-3 rounded ${cls.split(' ')[0]}`} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-auto">
            <div className="min-w-max">
              {/* Week headers */}
              <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100">
                <div className="w-44 flex-shrink-0 text-xs font-semibold text-gray-400">Team Member</div>
                {heatmapData.weeks.map(w => (
                  <div key={w} className="w-10 flex-shrink-0 text-xs text-gray-400 text-center">
                    {format(parseISO(w), 'M/d')}
                  </div>
                ))}
              </div>
              {/* Rows */}
              <div className="divide-y divide-gray-50">
                {heatmapData.heatmap.map(user => (
                  <div key={user.id} className="flex items-center gap-1 px-4 py-2 hover:bg-gray-50">
                    <div className="w-44 flex-shrink-0 flex items-center gap-2">
                      <Avatar name={user.name} size="xs" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-800 truncate">{user.name}</div>
                        <div className="text-xs text-gray-400 truncate">{user.department}</div>
                      </div>
                    </div>
                    {user.weeks.map((w, i) => (
                      <div key={i} className="flex-shrink-0">
                        <HeatCell utilPct={w.utilPct} hours={w.hours} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
