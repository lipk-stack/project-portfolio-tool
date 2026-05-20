import { useEffect, useState } from 'react'
import { reportsApi, evmApi, risksApi } from '../api'
import Card from '../components/ui/Card'
import Progress from '../components/ui/Progress'
import { BarChart2, TrendingUp, CheckCircle, AlertCircle, Download, TrendingDown } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, PieChart, Pie, Legend, AreaChart, Area, ReferenceLine
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

interface EVMPortfolio {
  projects: Array<{
    id: number; name: string; color: string; spi: number; cpi: number
    ev: number; acwp: number; pv: number; bac: number; eac: number
    completion_percent: number
  }>
  totals: { pv: number; ev: number; acwp: number; spi: number; cpi: number; eac: number; bac: number }
}

interface RiskSummary {
  total: number
  open: number
  high: number
  byCategory: Array<{ category: string; count: number }>
  byProject: Array<{ project_name: string; count: number; high_count: number }>
}

function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n}`
}

const STATUS_COLORS: Record<string, string> = { planning: '#94a3b8', active: '#3b82f6', on_hold: '#f59e0b', completed: '#22c55e', cancelled: '#ef4444' }
const HEALTH_COLORS: Record<string, string> = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444' }

function spiColor(v: number) { return v >= 0.95 ? '#22c55e' : v >= 0.85 ? '#f59e0b' : '#ef4444' }
function cpiColor(v: number) { return v >= 0.95 ? '#22c55e' : v >= 0.85 ? '#f59e0b' : '#ef4444' }

function exportCSV(data: ReportData, evm: EVMPortfolio | null) {
  const rows: string[][] = []

  rows.push(['PORTFOLIO REPORT', new Date().toLocaleDateString()])
  rows.push([])
  rows.push(['BUDGET PERFORMANCE'])
  rows.push(['Project', 'Budget', 'Spent', 'Completion%', 'Spend Rate%', 'Health'])
  data.budgetPerformance.forEach(p => {
    rows.push([p.name, String(p.budget), String(p.spent), String(p.completion_percent), String(p.spend_rate), p.health])
  })

  rows.push([])
  rows.push(['TASK COMPLETION'])
  rows.push(['Project', 'Total Tasks', 'Done Tasks', 'Completion Rate%'])
  data.taskCompletionByProject.forEach(p => {
    rows.push([p.name, String(p.total_tasks), String(p.done_tasks), String(p.completion_rate)])
  })

  rows.push([])
  rows.push(['HOURS LOGGED (Last 30 Days)'])
  rows.push(['Project', 'Hours', 'Labor Cost'])
  data.hoursLogged.forEach(p => {
    rows.push([p.name, String(p.total_hours), String(p.total_cost)])
  })

  if (evm) {
    rows.push([])
    rows.push(['EVM ANALYSIS'])
    rows.push(['Project', 'BAC', 'PV', 'EV', 'AC', 'SPI', 'CPI', 'EAC', 'Completion%'])
    evm.projects.forEach(p => {
      rows.push([p.name, String(p.bac), String(p.pv.toFixed(0)), String(p.ev.toFixed(0)), String(p.acwp.toFixed(0)), String(p.spi.toFixed(2)), String(p.cpi.toFixed(2)), String(p.eac.toFixed(0)), String(p.completion_percent)])
    })
    rows.push(['PORTFOLIO TOTAL', String(evm.totals.bac), String(evm.totals.pv.toFixed(0)), String(evm.totals.ev.toFixed(0)), String(evm.totals.acwp.toFixed(0)), String(evm.totals.spi.toFixed(2)), String(evm.totals.cpi.toFixed(2)), String(evm.totals.eac.toFixed(0)), ''])
  }

  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `portfolio-report-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const [data, setData] = useState<ReportData | null>(null)
  const [evm, setEvm] = useState<EVMPortfolio | null>(null)
  const [risks, setRisks] = useState<RiskSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'evm' | 'risks'>('overview')

  useEffect(() => {
    Promise.all([
      reportsApi.overview(),
      evmApi.portfolio(),
      risksApi.portfolioSummary(),
    ]).then(([rRes, eRes, rkRes]) => {
      setData(rRes.data)
      setEvm(eRes.data)
      setRisks(rkRes.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!data) return null

  const evmChartData = evm?.projects.map(p => ({
    name: p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name,
    spi: parseFloat(p.spi.toFixed(2)),
    cpi: parseFloat(p.cpi.toFixed(2)),
    color: p.color,
  })) || []

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Portfolio-wide performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            {(['overview', 'evm', 'risks'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 text-sm capitalize transition-colors ${activeTab === tab ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                {tab === 'evm' ? 'EVM Analysis' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => data && exportCSV(data, evm)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: CheckCircle, label: 'Avg Completion', value: `${data.avgProjectCompletion}%`, color: 'text-green-600 bg-green-50' },
          { icon: AlertCircle, label: 'Overdue Tasks', value: data.overdueTaskCount, color: data.overdueTaskCount > 5 ? 'text-red-600 bg-red-50' : 'text-yellow-600 bg-yellow-50' },
          { icon: TrendingUp, label: 'Active Projects', value: data.projectsByStatus.find(s => s.status === 'active')?.count || 0, color: 'text-blue-600 bg-blue-50' },
          { icon: BarChart2, label: 'Portfolio SPI', value: evm ? evm.totals.spi.toFixed(2) : '—', color: evm && evm.totals.spi >= 0.95 ? 'text-green-600 bg-green-50' : evm && evm.totals.spi >= 0.85 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50' },
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

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-8">
              <Card>
                <h3 className="font-semibold text-gray-900 mb-1">Budget Performance by Project</h3>
                <p className="text-xs text-gray-400 mb-4">Spend rate vs. completion percentage</p>
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
            <div className="col-span-12 lg:col-span-4 space-y-4">
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">Project Health</h3>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={data.projectsByHealth} cx="50%" cy="50%" outerRadius={60} dataKey="count" nameKey="health">
                      {data.projectsByHealth.map((d, i) => <Cell key={i} fill={HEALTH_COLORS[d.health]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1">
                  {data.projectsByHealth.map(d => (
                    <div key={d.health} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: HEALTH_COLORS[d.health] }} />
                        <span className="text-xs text-gray-600">{d.health === 'green' ? 'On Track' : d.health === 'yellow' ? 'At Risk' : 'Off Track'}</span>
                      </div>
                      <span className="text-xs font-bold text-gray-900">{d.count}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <h3 className="font-semibold text-gray-900 mb-3">By Status</h3>
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

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-6">
              <Card>
                <h3 className="font-semibold text-gray-900 mb-1">Task Completion by Project</h3>
                <p className="text-xs text-gray-400 mb-4">Completed vs. total tasks</p>
                <div className="space-y-3">
                  {data.taskCompletionByProject.map(p => (
                    <div key={p.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                          <span className="text-sm text-gray-700 truncate max-w-[180px]">{p.name}</span>
                        </div>
                        <span className="text-xs text-gray-500">{p.done_tasks}/{p.total_tasks}</span>
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
        </>
      )}

      {/* EVM Analysis Tab */}
      {activeTab === 'evm' && evm && (
        <>
          {/* Portfolio EVM Totals */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: 'Portfolio BAC', value: formatCurrency(evm.totals.bac), sub: 'Budget at Completion' },
              { label: 'Planned Value', value: formatCurrency(evm.totals.pv), sub: 'BCWS' },
              { label: 'Earned Value', value: formatCurrency(evm.totals.ev), sub: 'BCWP' },
              { label: 'Actual Cost', value: formatCurrency(evm.totals.acwp), sub: 'ACWP' },
              { label: 'Portfolio SPI', value: evm.totals.spi.toFixed(2), sub: 'Schedule Perf.', highlight: spiColor(evm.totals.spi) },
              { label: 'Portfolio CPI', value: evm.totals.cpi.toFixed(2), sub: 'Cost Perf.', highlight: cpiColor(evm.totals.cpi) },
            ].map((m, i) => (
              <Card key={i} className="text-center">
                <div className="text-xs text-gray-400 mb-1">{m.label}</div>
                <div className="text-xl font-bold" style={{ color: m.highlight || '#111827' }}>{m.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{m.sub}</div>
              </Card>
            ))}
          </div>

          {/* SPI/CPI Bar Chart */}
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-8">
              <Card>
                <h3 className="font-semibold text-gray-900 mb-1">SPI &amp; CPI by Project</h3>
                <p className="text-xs text-gray-400 mb-4">Schedule Performance Index and Cost Performance Index (1.0 = on plan)</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={evmChartData} margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 1.5]} tickFormatter={v => v.toFixed(1)} />
                    <Tooltip formatter={(v: number, name: string) => [v.toFixed(2), name]} />
                    <Legend />
                    <ReferenceLine y={1.0} stroke="#6b7280" strokeDasharray="4 2" label={{ value: '1.0 Target', position: 'right', fontSize: 10 }} />
                    <Bar dataKey="spi" name="SPI" radius={[3, 3, 0, 0]}>
                      {evmChartData.map((d, i) => <Cell key={i} fill={spiColor(d.spi)} fillOpacity={0.85} />)}
                    </Bar>
                    <Bar dataKey="cpi" name="CPI" radius={[3, 3, 0, 0]}>
                      {evmChartData.map((d, i) => <Cell key={i} fill={cpiColor(d.cpi)} fillOpacity={0.55} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <div className="col-span-12 lg:col-span-4">
              <Card>
                <h3 className="font-semibold text-gray-900 mb-3">EVM Quadrant</h3>
                <p className="text-xs text-gray-400 mb-3">SPI vs CPI positioning</p>
                <div className="relative w-full aspect-square max-w-[240px] mx-auto">
                  <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 rounded-lg overflow-hidden">
                    <div className="bg-yellow-50 border-r border-b border-gray-200 flex items-center justify-center text-xs text-gray-400 text-center p-1">Under budget<br />Behind schedule</div>
                    <div className="bg-green-50 border-b border-gray-200 flex items-center justify-center text-xs text-gray-400 text-center p-1">Under budget<br />Ahead schedule</div>
                    <div className="bg-red-50 border-r border-gray-200 flex items-center justify-center text-xs text-gray-400 text-center p-1">Over budget<br />Behind schedule</div>
                    <div className="bg-blue-50 flex items-center justify-center text-xs text-gray-400 text-center p-1">Over budget<br />Ahead schedule</div>
                  </div>
                  {evm.projects.map(p => {
                    const x = Math.min(Math.max((p.spi / 1.5) * 100, 5), 95)
                    const y = Math.min(Math.max((1 - p.cpi / 1.5) * 100, 5), 95)
                    return (
                      <div
                        key={p.id}
                        className="absolute w-3 h-3 rounded-full border-2 border-white shadow-sm"
                        style={{ left: `${x}%`, top: `${y}%`, backgroundColor: p.color, transform: 'translate(-50%,-50%)' }}
                        title={`${p.name}: SPI=${p.spi.toFixed(2)}, CPI=${p.cpi.toFixed(2)}`}
                      />
                    )
                  })}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                  <span>← Behind Schedule</span><span>Ahead Schedule →</span>
                </div>
              </Card>
            </div>
          </div>

          {/* EVM Table */}
          <Card padding="none">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">EVM Detail by Project</h3>
            </div>
            <div className="overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Project', 'BAC', 'PV (BCWS)', 'EV (BCWP)', 'AC (ACWP)', 'SV', 'CV', 'SPI', 'CPI', 'EAC', 'Completion'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {evm.projects.map(p => {
                    const sv = p.ev - p.pv
                    const cv = p.ev - p.acwp
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 text-sm">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                            <span className="font-medium text-gray-800">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatCurrency(p.bac)}</td>
                        <td className="px-4 py-3 text-gray-600">{formatCurrency(p.pv)}</td>
                        <td className="px-4 py-3 text-gray-600">{formatCurrency(p.ev)}</td>
                        <td className="px-4 py-3 text-gray-600">{formatCurrency(p.acwp)}</td>
                        <td className={`px-4 py-3 font-medium ${sv >= 0 ? 'text-green-600' : 'text-red-600'}`}>{sv >= 0 ? '+' : ''}{formatCurrency(sv)}</td>
                        <td className={`px-4 py-3 font-medium ${cv >= 0 ? 'text-green-600' : 'text-red-600'}`}>{cv >= 0 ? '+' : ''}{formatCurrency(cv)}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: spiColor(p.spi) }}>{p.spi.toFixed(2)}</span></td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: cpiColor(p.cpi) }}>{p.cpi.toFixed(2)}</span></td>
                        <td className="px-4 py-3 text-gray-600">{formatCurrency(p.eac)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${p.completion_percent}%`, backgroundColor: p.completion_percent > 80 ? '#22c55e' : p.completion_percent > 50 ? '#3b82f6' : '#f59e0b' }} />
                            </div>
                            <span className="text-xs text-gray-500">{p.completion_percent}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr className="font-semibold text-sm">
                    <td className="px-4 py-3 text-gray-900">Portfolio Total</td>
                    <td className="px-4 py-3 text-gray-900">{formatCurrency(evm.totals.bac)}</td>
                    <td className="px-4 py-3 text-gray-900">{formatCurrency(evm.totals.pv)}</td>
                    <td className="px-4 py-3 text-gray-900">{formatCurrency(evm.totals.ev)}</td>
                    <td className="px-4 py-3 text-gray-900">{formatCurrency(evm.totals.acwp)}</td>
                    <td className={`px-4 py-3 ${evm.totals.ev - evm.totals.pv >= 0 ? 'text-green-600' : 'text-red-600'}`}>{evm.totals.ev - evm.totals.pv >= 0 ? '+' : ''}{formatCurrency(evm.totals.ev - evm.totals.pv)}</td>
                    <td className={`px-4 py-3 ${evm.totals.ev - evm.totals.acwp >= 0 ? 'text-green-600' : 'text-red-600'}`}>{evm.totals.ev - evm.totals.acwp >= 0 ? '+' : ''}{formatCurrency(evm.totals.ev - evm.totals.acwp)}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: spiColor(evm.totals.spi) }}>{evm.totals.spi.toFixed(2)}</span></td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: cpiColor(evm.totals.cpi) }}>{evm.totals.cpi.toFixed(2)}</span></td>
                    <td className="px-4 py-3 text-gray-900">{formatCurrency(evm.totals.eac)}</td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Risk Analysis Tab */}
      {activeTab === 'risks' && risks && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Risks', value: risks.total, color: 'bg-blue-500', icon: AlertCircle },
              { label: 'Open Risks', value: risks.open, color: 'bg-yellow-500', icon: TrendingUp },
              { label: 'High Severity', value: risks.high, color: 'bg-red-500', icon: AlertCircle },
              { label: 'Mitigated', value: risks.total - risks.open, color: 'bg-green-500', icon: CheckCircle },
            ].map((k, i) => (
              <Card key={i}>
                <div className={`w-10 h-10 ${k.color} bg-opacity-15 rounded-xl flex items-center justify-center mb-3`}>
                  <k.icon size={20} className={k.color.replace('bg-', 'text-')} />
                </div>
                <div className="text-2xl font-bold text-gray-900">{k.value}</div>
                <div className="text-sm text-gray-500">{k.label}</div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-5">
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">Risks by Category</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={risks.byCategory} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="count" name="Risks" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
            <div className="col-span-12 lg:col-span-7">
              <Card padding="none">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Risk Exposure by Project</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {risks.byProject.map(p => (
                    <div key={p.project_name} className="flex items-center gap-4 px-5 py-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-800">{p.project_name}</span>
                          <div className="flex items-center gap-2">
                            {p.high_count > 0 && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">{p.high_count} high</span>
                            )}
                            <span className="text-xs text-gray-500">{p.count} total</span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min((p.count / Math.max(...risks.byProject.map(x => x.count))) * 100, 100)}%`,
                              backgroundColor: p.high_count > 2 ? '#ef4444' : p.high_count > 0 ? '#f59e0b' : '#22c55e'
                            }}
                          />
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
    </div>
  )
}
