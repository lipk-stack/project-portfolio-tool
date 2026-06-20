import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { portfoliosApi, projectsApi, budgetApi, reportsApi, exportApi, insightsApi } from '../api'
import { Portfolio as PortfolioType, Project, Rag } from '../types'
import { HealthBadge, PriorityBadge, HealthDot } from '../components/ui/Badge'
import { HealthChip } from '../components/HealthInsights'
import Progress from '../components/ui/Progress'
import Card from '../components/ui/Card'
import { format, parseISO } from 'date-fns'
import { TrendingUp, DollarSign, FolderOpen, Target, BarChart3, AlertTriangle, LucideIcon, FileText, ChevronDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'

function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n}`
}

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
const HEALTH_COLORS: Record<string, string> = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444' }
const STATUS_COLORS: Record<string, string> = { planning: '#94a3b8', active: '#3b82f6', on_hold: '#f59e0b', completed: '#22c55e', cancelled: '#ef4444' }

export default function Portfolio() {
  const [portfolios, setPortfolios] = useState<PortfolioType[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [budgetData, setBudgetData] = useState<{ overview: Array<{ id: number; name: string; budget: number; spent: number; health: string; color: string; completion_percent: number }> } | null>(null)
  const [loading, setLoading] = useState(true)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [healthScores, setHealthScores] = useState<Record<number, { score: number; rag: Rag }>>({})
  const navigate = useNavigate()

  const downloadBriefing = async (id: number | 'all', name: string) => {
    await exportApi.downloadWithAuth(reportsApi.portfolioPdfUrl(id), `briefing-${name}.pdf`)
    setBriefingOpen(false)
  }

  useEffect(() => {
    Promise.all([
      portfoliosApi.list(),
      projectsApi.list(),
      budgetApi.portfolioOverview(),
    ]).then(([pRes, projRes, budRes]) => {
      setPortfolios(pRes.data.portfolios)
      setProjects(projRes.data.projects)
      setBudgetData(budRes.data)
    }).finally(() => setLoading(false))

    insightsApi.portfolio().then(r => {
      const map: Record<number, { score: number; rag: Rag }> = {}
      for (const p of r.data.projects) map[p.id] = { score: p.score, rag: p.rag }
      setHealthScores(map)
    }).catch(() => {})
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const activeProjects = projects.filter(p => p.status === 'active')
  const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0)
  const totalSpent = projects.reduce((sum, p) => sum + (p.spent || 0), 0)
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">{portfolios.length} portfolios · {projects.length} projects</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setBriefingOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 bg-white"
          >
            <FileText size={14} /> Briefing PDF <ChevronDown size={12} />
          </button>
          {briefingOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setBriefingOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-40 overflow-hidden">
                <button
                  onClick={() => downloadBriefing('all', 'All Portfolios')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 text-left"
                >
                  <FileText size={14} /> All Portfolios
                </button>
                <div className="border-t border-gray-100" />
                {portfolios.map(p => (
                  <button
                    key={p.id}
                    onClick={() => downloadBriefing(p.id, p.name)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                  >
                    <FileText size={14} className="text-gray-400" /> {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Portfolio KPIs */}
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

      {/* Charts row */}
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
                    {['Project', 'Health', 'Score', 'Priority', 'Progress', 'Budget', 'Timeline', 'Risks'].map(h => (
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
                      <td className="px-4 py-3">
                        {healthScores[p.id] ? <HealthChip score={healthScores[p.id].score} rag={healthScores[p.id].rag} /> : <span className="text-xs text-gray-300">—</span>}
                      </td>
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

      {/* Projects without portfolio */}
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
    </div>
  )
}
