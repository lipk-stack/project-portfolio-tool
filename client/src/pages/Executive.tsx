import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, DollarSign, Calendar, Users, BarChart2, ArrowRight, Printer, Target, Shield } from 'lucide-react'
import { reportsApi, evmApi } from '../api'
import { format } from 'date-fns'

interface InsightItem {
  id: string
  type: 'cost' | 'schedule' | 'risk' | 'resource' | 'quality'
  severity: 'critical' | 'warning' | 'info' | 'success'
  title: string
  description: string
  project?: string
  action?: string
  metric?: string
}

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-50 border-red-200', icon: 'text-red-500', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  warning: { bg: 'bg-amber-50 border-amber-200', icon: 'text-amber-500', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  info: { bg: 'bg-blue-50 border-blue-200', icon: 'text-blue-500', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' },
  success: { bg: 'bg-green-50 border-green-200', icon: 'text-green-500', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
}

const TYPE_ICONS = {
  cost: DollarSign,
  schedule: Calendar,
  risk: Shield,
  resource: Users,
  quality: Target,
}

export default function Executive() {
  const [insights, setInsights] = useState<InsightItem[]>([])
  const [evmData, setEvmData] = useState<any>(null)
  const [overview, setOverview] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      evmApi.insights(),
      evmApi.metrics(),
      reportsApi.overview(),
    ]).then(([insightRes, evmRes, overviewRes]) => {
      setInsights(insightRes.data?.insights || [])
      setEvmData(evmRes.data)
      setOverview(overviewRes.data)
    }).finally(() => setLoading(false))
  }, [])

  const criticals = insights.filter(i => i.severity === 'critical')
  const warnings = insights.filter(i => i.severity === 'warning')

  const activeProjects = overview?.projectsByStatus?.find((s: any) => s.status === 'active')?.count || 0
  const onTrack = overview?.projectsByHealth?.find((h: any) => h.health === 'green')?.count || 0
  const atRisk = (overview?.projectsByHealth || []).filter((h: any) => h.health === 'yellow' || h.health === 'red').reduce((s: number, h: any) => s + h.count, 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between print:block">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executive Report</h1>
          <p className="text-gray-500 text-sm mt-0.5">Portfolio Performance Summary · {format(new Date(), 'MMMM d, yyyy')}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors print:hidden"
        >
          <Printer size={16} />
          Print / PDF
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Projects', value: activeProjects, icon: BarChart2, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'On Track', value: onTrack, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'At Risk', value: atRisk, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Portfolio CPI', value: evmData?.portfolio?.CPI?.toFixed(2) || '–', icon: TrendingUp, color: (evmData?.portfolio?.CPI || 1) >= 1 ? 'text-green-600' : 'text-red-600', bg: (evmData?.portfolio?.CPI || 1) >= 1 ? 'bg-green-50' : 'bg-red-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={color} size={20} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* EVM Summary */}
      {evmData?.portfolio && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white">
          <h2 className="text-base font-semibold mb-4 text-slate-300 uppercase tracking-wider text-xs">Earned Value Management — Portfolio</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Cost Performance (CPI)', value: evmData.portfolio.CPI?.toFixed(2), good: evmData.portfolio.CPI >= 1, suffix: '', desc: evmData.portfolio.CPI >= 1 ? 'Under budget' : 'Over budget' },
              { label: 'Schedule Performance (SPI)', value: evmData.portfolio.SPI?.toFixed(2), good: evmData.portfolio.SPI >= 1, suffix: '', desc: evmData.portfolio.SPI >= 1 ? 'Ahead of schedule' : 'Behind schedule' },
              { label: 'Est. at Completion (EAC)', value: formatCurrency(evmData.portfolio.EAC), good: evmData.portfolio.EAC <= evmData.portfolio.BAC, suffix: '', desc: `vs ${formatCurrency(evmData.portfolio.BAC)} budget` },
              { label: 'Variance at Completion', value: formatCurrency(Math.abs(evmData.portfolio.VAC)), good: evmData.portfolio.VAC >= 0, suffix: '', desc: evmData.portfolio.VAC >= 0 ? 'Under budget' : 'Over budget' },
            ].map(({ label, value, good, desc }) => (
              <div key={label}>
                <div className={`text-2xl font-bold ${good ? 'text-green-400' : 'text-red-400'}`}>{value}</div>
                <div className="text-slate-300 text-sm mt-0.5">{label}</div>
                <div className="text-slate-400 text-xs mt-0.5">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Insights */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Portfolio Intelligence</h2>
              <p className="text-xs text-gray-500 mt-0.5">{insights.length} insights · {criticals.length} critical, {warnings.length} warnings</p>
            </div>
            <div className="flex gap-2">
              {criticals.length > 0 && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">{criticals.length} Critical</span>}
              {warnings.length > 0 && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">{warnings.length} Warnings</span>}
            </div>
          </div>
          <div className="space-y-3">
            {insights.map(insight => {
              const styles = SEVERITY_STYLES[insight.severity]
              const Icon = TYPE_ICONS[insight.type] || Target
              return (
                <div key={insight.id} className={`border rounded-lg p-4 ${styles.bg}`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${styles.icon} flex-shrink-0`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{insight.title}</span>
                        {insight.metric && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles.badge}`}>{insight.metric}</span>}
                        {insight.project && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{insight.project}</span>}
                      </div>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{insight.description}</p>
                      {insight.action && (
                        <div className="flex items-center gap-1 mt-2">
                          <ArrowRight size={12} className="text-gray-400" />
                          <span className="text-xs text-gray-500 font-medium">{insight.action}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {insights.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
                <p className="text-sm">No critical issues detected. Portfolio is healthy.</p>
              </div>
            )}
          </div>
        </div>

        {/* Project Health Summary */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Project Performance</h2>
            <div className="space-y-3">
              {(evmData?.projects || []).slice(0, 6).map((p: any) => (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700 truncate pr-2">{p.name}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-xs font-bold ${p.CPI >= 1 ? 'text-green-600' : 'text-red-600'}`}>CPI {p.CPI}</span>
                      {p.CPI >= 1 ? <TrendingUp size={12} className="text-green-500" /> : <TrendingDown size={12} className="text-red-500" />}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${p.CPI >= 1 ? 'bg-green-500' : p.CPI >= 0.9 ? 'bg-amber-400' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, p.completion_percent)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    <span>{p.completion_percent}% done</span>
                    <span>SPI {p.SPI}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: 'View Full Reports', to: '/reports', icon: BarChart2 },
                { label: 'Review Risks', to: '/projects', icon: Shield },
                { label: 'Resource Utilization', to: '/resources', icon: Users },
                { label: 'Portfolio Roadmap', to: '/roadmap', icon: Calendar },
              ].map(({ label, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors group"
                >
                  <Icon size={16} className="text-gray-400 group-hover:text-blue-500" />
                  <span className="text-sm text-gray-600 group-hover:text-blue-700">{label}</span>
                  <ArrowRight size={14} className="ml-auto text-gray-300 group-hover:text-blue-400" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
