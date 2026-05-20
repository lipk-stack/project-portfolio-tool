import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { portfoliosApi, projectsApi, budgetApi, evmApi } from '../api'
import { Portfolio as PortfolioType, Project } from '../types'
import { HealthBadge, PriorityBadge } from '../components/ui/Badge'
import Progress from '../components/ui/Progress'
import Card from '../components/ui/Card'
import { format, parseISO, differenceInDays, addMonths, startOfMonth, endOfMonth, isWithinInterval, isBefore, isAfter, eachMonthOfInterval } from 'date-fns'
import { TrendingUp, DollarSign, FolderOpen, Target, AlertTriangle, LucideIcon, Map, List, BarChart3 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'

function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n}`
}

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
const HEALTH_COLORS: Record<string, string> = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444' }
const STATUS_COLORS: Record<string, string> = { planning: '#94a3b8', active: '#3b82f6', on_hold: '#f59e0b', completed: '#22c55e', cancelled: '#ef4444' }

interface EVMProject {
  id: number; name: string; color: string; spi: number; cpi: number
  ev: number; acwp: number; pv: number; bac: number; eac: number; completion_percent: number
}

function RoadmapView({ projects }: { projects: Project[] }) {
  const navigate = useNavigate()
  const now = new Date()

  const datedProjects = projects.filter(p => p.start_date || p.end_date)
  if (datedProjects.length === 0) {
    return (
      <Card className="text-center py-12 text-gray-400">
        <Map size={32} className="mx-auto mb-2 opacity-30" />
        <p>No projects have date ranges set. Add start/end dates to see the roadmap.</p>
      </Card>
    )
  }

  const allDates = datedProjects.flatMap(p => [
    p.start_date ? parseISO(p.start_date) : null,
    p.end_date ? parseISO(p.end_date) : null,
  ]).filter(Boolean) as Date[]

  const minDate = startOfMonth(allDates.reduce((a, b) => isBefore(a, b) ? a : b))
  const maxDate = endOfMonth(allDates.reduce((a, b) => isAfter(a, b) ? a : b))
  const months = eachMonthOfInterval({ start: minDate, end: maxDate })

  const totalDays = differenceInDays(maxDate, minDate) || 1

  function pct(date: Date) {
    return Math.max(0, Math.min(100, (differenceInDays(date, minDate) / totalDays) * 100))
  }

  const todayPct = pct(now)

  return (
    <Card padding="none">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Portfolio Roadmap</h3>
        <p className="text-xs text-gray-400 mt-0.5">Project timelines · {format(minDate, 'MMM yyyy')} – {format(maxDate, 'MMM yyyy')}</p>
      </div>
      <div className="overflow-auto">
        <div className="min-w-[800px]">
          {/* Month header */}
          <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
            <div className="w-52 flex-shrink-0 px-4 py-2 text-xs font-semibold text-gray-500">Project</div>
            <div className="flex-1 relative">
              <div className="flex h-full">
                {months.map((m, i) => (
                  <div key={i} className="flex-1 text-xs text-gray-400 font-medium border-l border-gray-200 px-1 py-2 text-center">
                    {format(m, 'MMM yy')}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Project rows */}
          <div className="divide-y divide-gray-50">
            {datedProjects.map(p => {
              const start = p.start_date ? parseISO(p.start_date) : minDate
              const end = p.end_date ? parseISO(p.end_date) : maxDate
              const left = pct(start)
              const width = Math.max(0.5, pct(end) - left)
              const barColor = p.health === 'red' ? '#ef4444' : p.health === 'yellow' ? '#f59e0b' : p.color
              const today = new Date()
              const isPast = isAfter(today, end)
              const isFuture = isBefore(today, start)
              const daysLeft = differenceInDays(end, today)

              return (
                <div key={p.id} className="flex items-center hover:bg-blue-50/20 transition-colors cursor-pointer group" onClick={() => navigate(`/projects/${p.id}`)}>
                  <div className="w-52 flex-shrink-0 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
                        <div className="text-xs text-gray-400 capitalize">{p.status.replace('_', ' ')}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 relative py-3 pr-4 h-12">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {months.map((_, i) => (
                        <div key={i} className="flex-1 border-l border-gray-100" />
                      ))}
                    </div>
                    {/* Today line */}
                    {todayPct > 0 && todayPct < 100 && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-blue-400 opacity-60 pointer-events-none z-10"
                        style={{ left: `${todayPct}%` }}
                      />
                    )}
                    {/* Project bar */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-6 rounded-full flex items-center group-hover:opacity-90 transition-opacity shadow-sm"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        backgroundColor: barColor,
                        opacity: isPast ? 0.5 : 1,
                      }}
                      title={`${p.name}: ${p.start_date ? format(parseISO(p.start_date), 'MMM d, yyyy') : '—'} → ${p.end_date ? format(parseISO(p.end_date), 'MMM d, yyyy') : '—'}`}
                    >
                      {/* Completion fill */}
                      <div
                        className="h-full rounded-full bg-white/30"
                        style={{ width: `${p.completion_percent}%` }}
                      />
                      {width > 8 && (
                        <span className="absolute inset-0 flex items-center px-2 text-xs text-white font-medium truncate whitespace-nowrap">
                          {p.completion_percent}%
                        </span>
                      )}
                    </div>
                    {/* Days remaining badge */}
                    {!isPast && !isFuture && width < 5 && (
                      <div className="absolute top-1/2 -translate-y-1/2 ml-1 text-xs text-gray-500 whitespace-nowrap" style={{ left: `${left + width}%` }}>
                        {daysLeft}d
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
            <div className="flex items-center gap-1.5"><div className="w-3 h-1 bg-blue-400 opacity-60" /><span>Today</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-3 rounded-full bg-white/30 border border-gray-200" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.4) 60%, transparent 60%)' }} /><span>Completion fill</span></div>
            {Object.entries(HEALTH_COLORS).map(([h, c]) => (
              <div key={h} className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded-full" style={{ backgroundColor: c }} />
                <span className="capitalize">{h === 'green' ? 'On track' : h === 'yellow' ? 'At risk' : 'Off track'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function Portfolio() {
  const [portfolios, setPortfolios] = useState<PortfolioType[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [budgetData, setBudgetData] = useState<{ overview: Array<{ id: number; name: string; budget: number; spent: number; health: string; color: string; completion_percent: number }> } | null>(null)
  const [evmProjects, setEvmProjects] = useState<EVMProject[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'overview' | 'roadmap' | 'evm'>('overview')
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      portfoliosApi.list(),
      projectsApi.list(),
      budgetApi.portfolioOverview(),
      evmApi.portfolio(),
    ]).then(([pRes, projRes, budRes, evmRes]) => {
      setPortfolios(pRes.data.portfolios)
      setProjects(projRes.data.projects)
      setBudgetData(budRes.data)
      setEvmProjects(evmRes.data.projects || [])
    }).finally(() => setLoading(false))
  }, [])

  const activeProjects = useMemo(() => projects.filter(p => p.status === 'active'), [projects])
  const totalBudget = useMemo(() => projects.reduce((sum, p) => sum + (p.budget || 0), 0), [projects])
  const totalSpent = useMemo(() => projects.reduce((sum, p) => sum + (p.spent || 0), 0), [projects])
  const avgCompletion = activeProjects.length ? Math.round(activeProjects.reduce((sum, p) => sum + p.completion_percent, 0) / activeProjects.length) : 0

  const healthCounts = {
    green: activeProjects.filter(p => p.health === 'green').length,
    yellow: activeProjects.filter(p => p.health === 'yellow').length,
    red: activeProjects.filter(p => p.health === 'red').length,
  }

  const statusChartData = ['planning', 'active', 'on_hold', 'completed', 'cancelled'].map(s => ({
    name: s.replace('_', ' '),
    count: projects.filter(p => p.status === s).length,
    color: STATUS_COLORS[s],
  })).filter(d => d.count > 0)

  const budgetChartData = (budgetData?.overview || []).slice(0, 8).map(p => ({
    name: p.name.length > 15 ? p.name.slice(0, 15) + '…' : p.name,
    planned: p.budget,
    spent: p.spent,
    color: p.color,
  }))

  const sortedProjects = [...projects].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">{portfolios.length} portfolios · {projects.length} projects</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            {([
              { key: 'overview', icon: List, label: 'Overview' },
              { key: 'roadmap', icon: Map, label: 'Roadmap' },
              { key: 'evm', icon: BarChart3, label: 'Performance' },
            ] as const).map(v => (
              <button
                key={v.key}
                onClick={() => setActiveView(v.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${activeView === v.key ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <v.icon size={14} />
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { icon: FolderOpen, label: 'Active Projects', value: activeProjects.length, sub: `${projects.filter(p => p.status === 'completed').length} completed`, color: 'bg-blue-500' },
          { icon: Target, label: 'Avg Completion', value: `${avgCompletion}%`, sub: `${healthCounts.green} on track`, color: 'bg-green-500' },
          { icon: DollarSign, label: 'Total Budget', value: formatCurrency(totalBudget), sub: `${formatCurrency(totalSpent)} spent (${totalBudget ? Math.round(totalSpent / totalBudget * 100) : 0}%)`, color: 'bg-purple-500' },
          { icon: AlertTriangle, label: 'Needs Attention', value: healthCounts.red + healthCounts.yellow, sub: `${healthCounts.red} off track, ${healthCounts.yellow} at risk`, color: healthCounts.red > 0 ? 'bg-red-500' : 'bg-orange-500' },
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

      {/* Roadmap view */}
      {activeView === 'roadmap' && <RoadmapView projects={sortedProjects} />}

      {/* EVM Performance view */}
      {activeView === 'evm' && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Portfolio Performance</h3>
            <p className="text-xs text-gray-400 mt-0.5">Earned Value Management indicators per project</p>
          </div>
          <div className="overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Project', 'Completion', 'SPI', 'CPI', 'Planned Value', 'Earned Value', 'Actual Cost', 'EAC', 'Health'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {evmProjects.map(p => {
                  const spiOk = p.spi >= 0.95
                  const cpiOk = p.cpi >= 0.95
                  const spiWarn = p.spi >= 0.85
                  const cpiWarn = p.cpi >= 0.85
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/projects/${p.id}`)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                          <span className="text-sm font-medium text-gray-800">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${p.completion_percent}%`, backgroundColor: p.color }} />
                          </div>
                          <span className="text-xs text-gray-500">{p.completion_percent}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${spiOk ? 'text-green-600' : spiWarn ? 'text-yellow-600' : 'text-red-600'}`}>{p.spi.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${cpiOk ? 'text-green-600' : cpiWarn ? 'text-yellow-600' : 'text-red-600'}`}>{p.cpi.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(p.pv)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(p.ev)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(p.acwp)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">{formatCurrency(p.eac)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          !spiOk || !cpiOk ? (!spiWarn || !cpiWarn ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700') : 'bg-green-100 text-green-700'
                        }`}>
                          {!spiOk || !cpiOk ? (!spiWarn || !cpiWarn ? 'Off Track' : 'At Risk') : 'On Track'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Overview */}
      {activeView === 'overview' && (
        <>
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-8">
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">Budget: Planned vs Actual</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={budgetChartData} margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="planned" name="Budget" fill="#dbeafe" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="spent" name="Spent" radius={[3, 3, 0, 0]}>
                      {budgetChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
            <div className="col-span-12 lg:col-span-4">
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">By Status</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="count">
                      {statusChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {statusChartData.map(d => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-xs capitalize text-gray-600">{d.name}</span>
                      </div>
                      <span className="text-xs font-bold text-gray-900">{d.count}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* Portfolio sections */}
          {portfolios.map(portfolio => {
            const portProjects = sortedProjects.filter(p => p.portfolio_id === portfolio.id)
            if (portProjects.length === 0) return null
            return (
              <div key={portfolio.id}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{portfolio.name}</h2>
                    {portfolio.description && <p className="text-sm text-gray-500">{portfolio.description}</p>}
                  </div>
                  <div className="text-sm text-gray-500">{portProjects.length} projects · {formatCurrency(portfolio.total_budget || 0)} budget</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        {['Project', 'Health', 'Priority', 'Progress', 'Budget', 'Timeline', 'Risks'].map(h => (
                          <th key={h} className={`text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider ${['Budget', 'Timeline', 'Risks'].includes(h) ? 'hidden md:table-cell' : ''}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {portProjects.map(p => (
                        <tr key={p.id} className="hover:bg-blue-50/30 cursor-pointer transition-colors" onClick={() => navigate(`/projects/${p.id}`)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                              <div>
                                <div className="text-sm font-medium text-gray-900">{p.name}</div>
                                <div className="text-xs text-gray-400 capitalize">{p.status.replace('_', ' ')}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3"><HealthBadge health={p.health} /></td>
                          <td className="px-4 py-3"><PriorityBadge priority={p.priority} /></td>
                          <td className="px-4 py-3 w-48">
                            <div className="flex items-center gap-2">
                              <Progress value={p.completion_percent} size="sm" color="auto" className="flex-1" />
                              <span className="text-xs text-gray-500 w-8">{p.completion_percent}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="text-xs font-medium text-gray-700">{formatCurrency(p.spent)}</div>
                            <div className="text-xs text-gray-400">of {formatCurrency(p.budget)}</div>
                            {p.budget > 0 && (
                              <div className={`text-xs font-medium ${p.spent / p.budget > 0.9 ? 'text-red-600' : 'text-gray-500'}`}>
                                {Math.round(p.spent / p.budget * 100)}%
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">
                            {p.end_date ? format(parseISO(p.end_date), 'MMM d, yyyy') : '—'}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={`text-sm font-bold ${(p.open_risk_count || 0) > 2 ? 'text-red-600' : 'text-gray-600'}`}>{p.open_risk_count || 0}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

          {/* Standalone projects */}
          {(() => {
            const orphans = sortedProjects.filter(p => !p.portfolio_id)
            if (!orphans.length) return null
            return (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Standalone Projects</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {orphans.map(p => (
                    <div key={p.id} className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/projects/${p.id}`)}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="font-medium text-gray-800 text-sm">{p.name}</span>
                      </div>
                      <Progress value={p.completion_percent} size="sm" color="auto" showLabel />
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
