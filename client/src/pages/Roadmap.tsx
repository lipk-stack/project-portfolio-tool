import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { evmApi } from '../api'
import { format, parseISO, differenceInDays, addDays, startOfMonth, endOfMonth, eachMonthOfInterval, addMonths } from 'date-fns'
import { HealthDot, PriorityBadge } from '../components/ui/Badge'
import Progress from '../components/ui/Progress'
import { Filter } from 'lucide-react'

interface RoadmapProject {
  id: number
  name: string
  status: string
  priority: string
  health: string
  color: string
  start_date?: string
  end_date?: string
  completion_percent: number
  portfolio_name?: string
  manager_name?: string
  budget: number
  spent: number
  task_count: number
  done_tasks: number
}

interface RoadmapMilestone {
  id: number
  name: string
  date: string
  status: string
  project_id: number
  project_name: string
  project_color: string
}

function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n}`
}

const LEFT_WIDTH = 280
const ROW_HEIGHT = 44
const HEADER_HEIGHT = 64

export default function Roadmap() {
  const [projects, setProjects] = useState<RoadmapProject[]>([])
  const [milestones, setMilestones] = useState<RoadmapMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState<'month' | 'quarter'>('month')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const navigate = useNavigate()

  useEffect(() => {
    evmApi.roadmap().then(r => {
      setProjects(r.data.projects)
      setMilestones(r.data.milestones)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = projects.filter(p => filterStatus === 'all' || p.status === filterStatus)

  const allDates = filtered.flatMap(p => [p.start_date, p.end_date].filter(Boolean) as string[])
  const minDate = allDates.length ? new Date(Math.min(...allDates.map(d => new Date(d).getTime()))) : new Date()
  const maxDate = allDates.length ? new Date(Math.max(...allDates.map(d => new Date(d).getTime()))) : addMonths(new Date(), 6)

  const startDate = startOfMonth(addMonths(minDate, -1))
  const endDate = endOfMonth(addMonths(maxDate, 1))

  const CELL_WIDTH = zoom === 'month' ? 140 : 60
  const columns = eachMonthOfInterval({ start: startDate, end: endDate })
  const totalWidth = columns.length * CELL_WIDTH

  function xOf(date: Date): number {
    return differenceInDays(date, startDate) * (CELL_WIDTH / (zoom === 'month' ? 30.44 : 7.6))
  }

  const todayX = xOf(new Date())
  const totalHeight = filtered.length * ROW_HEIGHT

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4 animate-fade-in h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Portfolio Roadmap</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} projects across all portfolios</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
            {(['month', 'quarter'] as const).map(z => (
              <button key={z} onClick={() => setZoom(z)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${zoom === z ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50'}`}>
                {z === 'month' ? 'Monthly' : 'Quarterly'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Projects', value: filtered.length, color: 'text-blue-600' },
          { label: 'Active', value: filtered.filter(p => p.status === 'active').length, color: 'text-green-600' },
          { label: 'At Risk', value: filtered.filter(p => p.health === 'red' || p.health === 'yellow').length, color: 'text-yellow-600' },
          { label: 'Total Budget', value: formatCurrency(filtered.reduce((s, p) => s + p.budget, 0)), color: 'text-purple-600' },
        ].map(item => (
          <div key={item.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Gantt Timeline */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 320px)', minHeight: 400 }}>
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel */}
          <div className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col" style={{ width: LEFT_WIDTH }}>
            <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-end px-4 pb-2" style={{ height: HEADER_HEIGHT }}>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Project</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.map(p => (
                <div key={p.id}
                  className="flex items-center gap-3 px-3 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => navigate(`/projects/${p.id}`)}
                >
                  <div className="w-2 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <HealthDot health={p.health as any} />
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{p.name}</span>
                    </div>
                    <div className="text-xs text-gray-400 truncate">{p.portfolio_name}</div>
                  </div>
                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex-shrink-0">{p.completion_percent}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline panel */}
          <div className="flex-1 overflow-auto">
            <div style={{ width: totalWidth, minWidth: '100%' }}>
              {/* Month headers */}
              <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700" style={{ height: HEADER_HEIGHT }}>
                {/* Quarter row */}
                <div className="flex" style={{ height: 28 }}>
                  {columns.reduce((acc: JSX.Element[], col, i) => {
                    const qtr = Math.floor(col.getMonth() / 3)
                    const isFirstOfQtr = col.getMonth() % 3 === 0
                    if (isFirstOfQtr || i === 0) {
                      const qtrCols = columns.slice(i).filter(c => Math.floor(c.getMonth() / 3) === qtr && c.getFullYear() === col.getFullYear()).length
                      acc.push(
                        <div key={i} className="border-r border-gray-200 dark:border-gray-700 flex items-center px-2 bg-gray-100 dark:bg-gray-700/50" style={{ width: qtrCols * CELL_WIDTH, flexShrink: 0 }}>
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Q{qtr + 1} {col.getFullYear()}</span>
                        </div>
                      )
                    }
                    return acc
                  }, [])}
                </div>
                {/* Month row */}
                <div className="flex" style={{ height: 36 }}>
                  {columns.map((col, i) => (
                    <div key={i} className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 font-medium" style={{ width: CELL_WIDTH }}>
                      {format(col, zoom === 'month' ? 'MMM yyyy' : 'MMM')}
                    </div>
                  ))}
                </div>
              </div>

              {/* Project bars */}
              <div style={{ height: totalHeight, position: 'relative' }}>
                <svg width={totalWidth} height={totalHeight} className="absolute inset-0">
                  {/* Grid */}
                  {columns.map((_, i) => (
                    <line key={i} x1={i * CELL_WIDTH} y1={0} x2={i * CELL_WIDTH} y2={totalHeight} stroke="#e2e8f0" strokeWidth={1} opacity={0.5} />
                  ))}
                  {filtered.map((_, i) => (
                    <line key={i} x1={0} y1={(i + 1) * ROW_HEIGHT} x2={totalWidth} y2={(i + 1) * ROW_HEIGHT} stroke="#f1f5f9" strokeWidth={1} />
                  ))}
                  {/* Today */}
                  <line x1={todayX} y1={0} x2={todayX} y2={totalHeight} stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" opacity={0.8} />
                  <rect x={todayX - 20} y={0} width={40} height={18} rx={4} fill="#3b82f6" opacity={0.9} />
                  <text x={todayX} y={12} fontSize={9} fill="white" textAnchor="middle" fontWeight="bold">TODAY</text>

                  {/* Project bars */}
                  {filtered.map((p, i) => {
                    if (!p.start_date || !p.end_date) return null
                    const x = xOf(parseISO(p.start_date))
                    const endX = xOf(addDays(parseISO(p.end_date), 1))
                    const w = Math.max(endX - x, 8)
                    const y = i * ROW_HEIGHT + 8
                    const h = ROW_HEIGHT - 16
                    const progressW = Math.max(w * (p.completion_percent / 100), 0)

                    return (
                      <g key={p.id} className="cursor-pointer" onClick={() => navigate(`/projects/${p.id}`)}>
                        <rect x={x} y={y} width={w} height={h} rx={6} ry={6} fill={p.color} opacity={0.2} />
                        <rect x={x} y={y} width={progressW} height={h} rx={6} ry={6} fill={p.color} opacity={0.85} />
                        {p.health === 'red' && <rect x={x} y={y} width={w} height={h} rx={6} ry={6} fill="none" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 2" />}
                        {w > 60 && (
                          <text x={x + 8} y={y + h / 2 + 4} fontSize={10} fill={p.completion_percent > 50 ? 'white' : p.color} fontWeight="600" style={{ userSelect: 'none' }}>
                            {p.name.length > Math.floor(w / 7) ? p.name.slice(0, Math.floor(w / 7) - 1) + '…' : p.name}
                          </text>
                        )}
                        <title>{`${p.name}\n${p.start_date} → ${p.end_date}\n${p.completion_percent}% complete\nBudget: ${formatCurrency(p.budget)} | Spent: ${formatCurrency(p.spent)}`}</title>
                      </g>
                    )
                  })}

                  {/* Milestones */}
                  {milestones.filter(m => filtered.find(p => p.id === m.project_id)).map(m => {
                    const projectIdx = filtered.findIndex(p => p.id === m.project_id)
                    if (projectIdx === -1) return null
                    const mx = xOf(parseISO(m.date))
                    const my = projectIdx * ROW_HEIGHT + ROW_HEIGHT / 2
                    const size = 7
                    const color = m.status === 'achieved' ? '#22c55e' : m.status === 'missed' ? '#ef4444' : '#f59e0b'
                    return (
                      <g key={m.id}>
                        <polygon points={`${mx},${my - size} ${mx + size},${my} ${mx},${my + size} ${mx - size},${my}`} fill={color} stroke="white" strokeWidth={1.5} />
                        <title>{`${m.name}\n${m.date} · ${m.status}`}</title>
                      </g>
                    )
                  })}
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          <div className="flex items-center gap-1.5"><div className="w-8 h-3 rounded bg-blue-400 opacity-80" /><span>Progress</span></div>
          <div className="flex items-center gap-1.5"><div className="w-8 h-3 rounded bg-blue-200" /><span>Remaining</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded border-2 border-red-500 bg-transparent" /><span>At Risk</span></div>
          <div className="flex items-center gap-1.5">
            <svg width={14} height={14}><polygon points="7,0 14,7 7,14 0,7" fill="#f59e0b" /></svg>
            <span>Milestone</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-4" style={{ background: 'repeating-linear-gradient(180deg, #3b82f6 0px, #3b82f6 4px, transparent 4px, transparent 8px)' }} />
            <span>Today</span>
          </div>
        </div>
      </div>
    </div>
  )
}
