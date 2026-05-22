import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Shield, AlertTriangle, Filter, ChevronDown, ExternalLink, CheckCircle } from 'lucide-react'
import { projectsApi, risksApi } from '../api'
import { Risk, Project } from '../types'

type RiskStatus = 'all' | 'open' | 'mitigating' | 'closed'
type SortKey = 'score' | 'project' | 'status' | 'date'

interface RiskWithProject extends Risk {
  project_name?: string
  project_color?: string
}

const SCORE_STYLES = (score: number) =>
  score >= 6 ? 'bg-red-100 text-red-800 font-bold'
  : score >= 4 ? 'bg-amber-100 text-amber-800 font-semibold'
  : score >= 2 ? 'bg-yellow-100 text-yellow-800'
  : 'bg-green-100 text-green-800'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-red-50 text-red-700',
  mitigating: 'bg-amber-50 text-amber-700',
  closed: 'bg-green-50 text-green-700',
}

const CATEGORY_COLORS: Record<string, string> = {
  technical: 'bg-blue-100 text-blue-700',
  financial: 'bg-purple-100 text-purple-700',
  schedule: 'bg-orange-100 text-orange-700',
  resource: 'bg-cyan-100 text-cyan-700',
  external: 'bg-pink-100 text-pink-700',
  operational: 'bg-indigo-100 text-indigo-700',
}

export default function RiskRegister() {
  const [allRisks, setAllRisks] = useState<RiskWithProject[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<RiskStatus>('open')
  const [sortBy, setSortBy] = useState<SortKey>('score')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [expandedRisk, setExpandedRisk] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      const projRes = await projectsApi.list()
      const projects: Project[] = projRes.data.projects || []
      const riskArrays = await Promise.all(
        projects.map(p =>
          risksApi.list(p.id).then(r =>
            (r.data.risks || []).map((risk: Risk) => ({
              ...risk,
              project_name: p.name,
              project_color: p.color,
            }))
          )
        )
      )
      setAllRisks(riskArrays.flat())
    }
    load().finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => {
    const cats = new Set(allRisks.map(r => r.category).filter(Boolean))
    return ['all', ...Array.from(cats)]
  }, [allRisks])

  const filtered = useMemo(() => {
    let risks = [...allRisks]
    if (statusFilter !== 'all') risks = risks.filter(r => r.status === statusFilter)
    if (categoryFilter !== 'all') risks = risks.filter(r => r.category === categoryFilter)
    risks.sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score
      if (sortBy === 'project') return (a.project_name || '').localeCompare(b.project_name || '')
      if (sortBy === 'status') return a.status.localeCompare(b.status)
      if (sortBy === 'date') return new Date(b.identified_date).getTime() - new Date(a.identified_date).getTime()
      return 0
    })
    return risks
  }, [allRisks, statusFilter, sortBy, categoryFilter])

  const counts = {
    critical: allRisks.filter(r => r.score >= 6 && r.status === 'open').length,
    high: allRisks.filter(r => r.score >= 4 && r.score < 6 && r.status === 'open').length,
    open: allRisks.filter(r => r.status === 'open').length,
    mitigating: allRisks.filter(r => r.status === 'mitigating').length,
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Risk Register</h1>
          <p className="text-sm text-gray-500 mt-0.5">{allRisks.length} total risks across all projects</p>
        </div>
        <div className="flex items-center gap-3">
          {counts.critical > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
              <AlertTriangle size={14} />
              {counts.critical} Critical
            </div>
          )}
        </div>
      </div>

      {/* Risk summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Critical', count: counts.critical, color: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
          { label: 'High', count: counts.high, color: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400' },
          { label: 'Open', count: counts.open, color: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
          { label: 'Mitigating', count: counts.mitigating, color: 'bg-purple-50 border-purple-200', text: 'text-purple-700', dot: 'bg-purple-400' },
        ].map(({ label, count, color, text, dot }) => (
          <div key={label} className={`flex items-center gap-3 p-4 rounded-xl border ${color}`}>
            <div className={`w-3 h-3 rounded-full ${dot}`} />
            <div>
              <div className={`text-2xl font-bold ${text}`}>{count}</div>
              <div className={`text-xs ${text} opacity-75`}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['open', 'mitigating', 'all', 'closed'] as RiskStatus[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                statusFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === 'all' ? 'All Status' : s}
            </button>
          ))}
        </div>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 bg-white"
        >
          {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
        </select>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortKey)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 bg-white"
        >
          <option value="score">Sort: Risk Score</option>
          <option value="project">Sort: Project</option>
          <option value="status">Sort: Status</option>
          <option value="date">Sort: Date Identified</option>
        </select>

        <span className="text-sm text-gray-500 ml-auto">{filtered.length} risks</span>
      </div>

      {/* Risk table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider w-12">Score</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">Risk</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider hidden md:table-cell">Project</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider hidden lg:table-cell">Category</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">P x I</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">Status</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider hidden md:table-cell">Identified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(risk => (
              <>
                <tr
                  key={risk.id}
                  className="hover:bg-blue-50/30 cursor-pointer transition-colors"
                  onClick={() => setExpandedRisk(expandedRisk === risk.id ? null : risk.id)}
                >
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm ${SCORE_STYLES(risk.score)}`}>
                      {risk.score}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{risk.title}</div>
                    {risk.owner_name && <div className="text-xs text-gray-400">Owner: {risk.owner_name}</div>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: risk.project_color }} />
                      <span className="text-sm text-gray-600">{risk.project_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {risk.category && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${CATEGORY_COLORS[risk.category] || 'bg-gray-100 text-gray-600'}`}>
                        {risk.category}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 capitalize">
                    {risk.probability} x {risk.impact}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_STYLES[risk.status] || ''}`}>
                      {risk.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-400">
                    {format(parseISO(risk.identified_date), 'MMM d, yyyy')}
                  </td>
                </tr>
                {expandedRisk === risk.id && (
                  <tr key={`${risk.id}-detail`} className="bg-blue-50/20">
                    <td colSpan={7} className="px-6 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {risk.description && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Description</div>
                            <p className="text-sm text-gray-700">{risk.description}</p>
                          </div>
                        )}
                        {risk.mitigation_plan && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Mitigation Plan</div>
                            <p className="text-sm text-gray-700">{risk.mitigation_plan}</p>
                          </div>
                        )}
                        {risk.response && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Response Strategy</div>
                            <p className="text-sm text-gray-700 capitalize">{risk.response}</p>
                          </div>
                        )}
                        {risk.target_date && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Target Resolution</div>
                            <p className="text-sm text-gray-700">{format(parseISO(risk.target_date), 'MMMM d, yyyy')}</p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle size={32} className="mx-auto mb-3 text-green-400" />
            <p className="text-gray-500">No risks match your filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
