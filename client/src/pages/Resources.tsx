import { useEffect, useState } from 'react'
import { resourcesApi } from '../api'
import { ResourceSummary } from '../types'
import Card from '../components/ui/Card'
import Progress from '../components/ui/Progress'
import Avatar from '../components/ui/Avatar'
import { Users, TrendingUp, AlertTriangle, Clock, LucideIcon, Calendar, Activity } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'
import { format, addWeeks, startOfWeek, subWeeks } from 'date-fns'

interface UtilizationRow {
  id: number
  name: string
  department: string
  capacity: number
  week: string
  logged_hours: number
}

export default function Resources() {
  const [resources, setResources] = useState<ResourceSummary[]>([])
  const [matrix, setMatrix] = useState<{
    users: Array<{ id: number; name: string; department: string }>
    projects: Array<{ id: number; name: string; color: string }>
    matrix: Array<{ user_id: number; project_id: number; allocation_percent: number | null }>
  } | null>(null)
  const [utilization, setUtilization] = useState<UtilizationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'overview' | 'matrix' | 'heatmap'>('overview')

  useEffect(() => {
    Promise.all([
      resourcesApi.list(),
      resourcesApi.allocationMatrix(),
      resourcesApi.utilization(),
    ]).then(([rRes, mRes, uRes]) => {
      setResources(rRes.data.resources)
      setMatrix(mRes.data)
      setUtilization(uRes.data.utilization)
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

  const radarData = chartData.map(d => ({
    subject: d.department,
    value: Math.min(d.utilization, 150),
    fullMark: 150,
  }))

  // Build heatmap: 8-week grid
  const now = new Date()
  const weeks: string[] = []
  for (let i = 7; i >= 0; i--) {
    const wk = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
    weeks.push(format(wk, 'yyyy-ww'))
  }

  const utilMap: Record<string, Record<string, number>> = {}
  for (const row of utilization) {
    if (!utilMap[row.id]) utilMap[row.id] = {}
    if (row.week) utilMap[row.id][row.week] = row.logged_hours
  }

  const heatmapUsers = resources.slice(0, 20)

  function heatColor(hours: number, capacity: number): string {
    if (hours === 0) return '#f1f5f9'
    const pct = (hours / (capacity / 5)) * 100 // weekly capacity = annual / 52 ≈ daily / 5
    if (pct > 120) return '#ef4444'
    if (pct > 100) return '#f97316'
    if (pct > 80) return '#22c55e'
    if (pct > 50) return '#86efac'
    return '#dbeafe'
  }

  function heatLabel(hours: number, capacity: number): string {
    if (hours === 0) return ''
    const pct = Math.round((hours / (capacity / 5)) * 100)
    return `${pct}%`
  }

  const weekLabels = weeks.map(w => {
    const parts = w.split('-')
    const year = parseInt(parts[0])
    const week = parseInt(parts[1])
    const d = addWeeks(new Date(year, 0, 1), week - 1)
    return format(startOfWeek(d, { weekStartsOn: 1 }), 'MMM d')
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resource Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{resources.length} team members · avg {avgUtilization}% utilization</p>
        </div>
        <div className="flex items-center gap-2">
          {([
            { key: 'overview', icon: Activity, label: 'Overview' },
            { key: 'matrix', icon: Users, label: 'Matrix' },
            { key: 'heatmap', icon: Calendar, label: 'Heatmap' },
          ] as const).map(v => (
            <button
              key={v.key}
              onClick={() => setActiveView(v.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${activeView === v.key ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <v.icon size={14} />
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

      {/* Overallocation warnings */}
      {overallocated.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm font-semibold text-red-700">{overallocated.length} team member{overallocated.length > 1 ? 's' : ''} over capacity</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {overallocated.map(r => (
              <div key={r.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-red-200">
                <Avatar name={r.name} size="xs" />
                <span className="text-sm font-medium text-gray-800">{r.name}</span>
                <span className="text-sm font-bold text-red-600">{r.total_allocation}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overview */}
      {activeView === 'overview' && (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-4">
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
              <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                {[['#22c55e', 'Optimal (80-100%)'], ['#3b82f6', 'Available'], ['#ef4444', 'Over capacity']].map(([c, l]) => (
                  <div key={l} className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} /><span className="text-gray-500">{l}</span></div>
                ))}
              </div>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">Department Radar</h3>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} />
                  <Radar name="Utilization" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <Card padding="none">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Team Allocation</h3>
              </div>
              <div className="divide-y divide-gray-50 max-h-[300px] overflow-y-auto">
                {resources.map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <Avatar name={r.name} size="xs" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-800 truncate">{r.name}</span>
                        <span className={`text-xs font-bold ml-2 ${r.total_allocation > 100 ? 'text-red-500' : r.total_allocation < 50 ? 'text-yellow-600' : 'text-green-600'}`}>{r.total_allocation}%</span>
                      </div>
                      <Progress value={r.total_allocation} max={100} size="sm" color={r.total_allocation > 100 ? 'red' : r.total_allocation > 80 ? 'green' : 'blue'} />
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {r.projects?.filter(p => p.status === 'active').slice(0, 3).map(p => (
                          <span key={p.project_id} className="text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: p.color }}>
                            {p.project_name.length > 10 ? p.project_name.slice(0, 10) + '…' : p.project_name}
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
      )}

      {/* Matrix view */}
      {activeView === 'matrix' && matrix && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Allocation Matrix</h3>
            <p className="text-xs text-gray-400 mt-0.5">% allocation of each team member per active project</p>
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
                        <span className={`text-xs font-bold ${total > 100 ? 'text-red-600' : total > 80 ? 'text-green-600' : 'text-gray-500'}`}>{total}%</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Heatmap view */}
      {activeView === 'heatmap' && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Capacity Heatmap</h3>
              <p className="text-xs text-gray-400 mt-0.5">Hours logged per week vs. weekly capacity (last 8 weeks)</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {[
                { color: '#f1f5f9', label: 'No hours' },
                { color: '#dbeafe', label: 'Low (<50%)' },
                { color: '#86efac', label: 'Moderate' },
                { color: '#22c55e', label: 'Optimal' },
                { color: '#f97316', label: 'High' },
                { color: '#ef4444', label: 'Over' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: color, border: '1px solid #e2e8f0' }} />
                  <span className="text-gray-500">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-auto p-4">
            <table className="w-full border-separate" style={{ borderSpacing: '3px' }}>
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 px-2 py-1 w-40">Team Member</th>
                  {weekLabels.map((w, i) => (
                    <th key={i} className="text-center text-xs font-medium text-gray-500 px-1 py-1 min-w-[72px]">{w}</th>
                  ))}
                  <th className="text-center text-xs font-semibold text-gray-500 px-2 py-1">Total</th>
                </tr>
              </thead>
              <tbody>
                {heatmapUsers.map(r => {
                  const weeklyCapacity = (r.capacity || 40) / 52 * 5
                  const totalHours = weeks.reduce((sum, w) => sum + (utilMap[r.id]?.[w] || 0), 0)
                  return (
                    <tr key={r.id}>
                      <td className="py-1">
                        <div className="flex items-center gap-2">
                          <Avatar name={r.name} size="xs" />
                          <div>
                            <div className="text-xs font-medium text-gray-700 truncate max-w-[110px]">{r.name}</div>
                            <div className="text-xs text-gray-400">{r.department}</div>
                          </div>
                        </div>
                      </td>
                      {weeks.map((w, wi) => {
                        const hours = utilMap[r.id]?.[w] || 0
                        const bg = heatColor(hours, r.capacity || 40)
                        const label = heatLabel(hours, r.capacity || 40)
                        return (
                          <td key={wi} className="text-center">
                            <div
                              className="w-full h-10 rounded flex flex-col items-center justify-center text-xs font-medium cursor-default transition-transform hover:scale-105"
                              style={{ backgroundColor: bg, border: '1px solid #e2e8f0' }}
                              title={`${r.name} · Week of ${weekLabels[wi]} · ${hours.toFixed(1)}h logged · ${Math.round((r.capacity || 40) / 5 * 5)}h weekly capacity`}
                            >
                              {hours > 0 ? (
                                <>
                                  <span style={{ color: hours > 0 ? '#374151' : '#94a3b8' }}>{hours.toFixed(1)}h</span>
                                  <span className="text-gray-500" style={{ fontSize: 9 }}>{label}</span>
                                </>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </div>
                          </td>
                        )
                      })}
                      <td className="text-center">
                        <span className="text-xs font-bold text-gray-700">{totalHours.toFixed(1)}h</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
