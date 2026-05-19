import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '../api'
import { Project } from '../types'
import { format, parseISO, differenceInDays, addDays, startOfMonth, eachMonthOfInterval, addMonths, isToday } from 'date-fns'
import { HealthDot, PriorityBadge } from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'

const ROW_HEIGHT = 52
const LEFT_WIDTH = 280
const CELL_WIDTH = 120 // per month
const HEADER_H = 50

const STATUS_COLORS: Record<string, string> = {
  planning: '#94a3b8',
  active: '#3b82f6',
  on_hold: '#f59e0b',
  completed: '#22c55e',
  cancelled: '#ef4444',
}

function formatCurrency(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n}`
}

export default function Roadmap() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const timelineRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    projectsApi.list().then(r => setProjects(r.data.projects)).finally(() => setLoading(false))
  }, [])

  const filtered = projects.filter(p => {
    if (filter === 'all') return p.status !== 'cancelled'
    return p.status === filter
  })

  const allDates = filtered.flatMap(p => [p.start_date, p.end_date].filter(Boolean) as string[])
  const minDate = allDates.length ? new Date(Math.min(...allDates.map(d => new Date(d).getTime()))) : new Date()
  const maxDate = allDates.length ? new Date(Math.max(...allDates.map(d => new Date(d).getTime()))) : addMonths(new Date(), 12)

  const startDate = startOfMonth(addMonths(minDate, -1))
  const endDate = startOfMonth(addMonths(maxDate, 2))
  const months = eachMonthOfInterval({ start: startDate, end: endDate })
  const totalWidth = months.length * CELL_WIDTH

  function xOf(date: Date) {
    const days = differenceInDays(date, startDate)
    const totalDays = differenceInDays(endDate, startDate)
    return (days / totalDays) * totalWidth
  }

  const todayX = xOf(new Date())

  const handleScroll = () => {
    if (leftRef.current && timelineRef.current) {
      leftRef.current.scrollTop = timelineRef.current.scrollTop
    }
  }

  // Scroll to today on mount
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollLeft = Math.max(todayX - 200, 0)
    }
  }, [todayX, loading])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const totalRows = filtered.length
  const totalHeight = totalRows * ROW_HEIGHT

  return (
    <div className="space-y-4 animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio Roadmap</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} projects · Cross-project timeline view</p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'active', 'planning', 'on_hold', 'completed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize border transition-colors ${filter === s ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded" style={{ backgroundColor: c }} />
            <span className="text-xs text-gray-500 capitalize">{s.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Gantt-style timeline */}
      <div className="flex flex-1 overflow-hidden border border-gray-200 rounded-xl bg-white">
        {/* Left: project list */}
        <div className="flex-shrink-0 border-r border-gray-200 flex flex-col" style={{ width: LEFT_WIDTH }}>
          <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200 flex items-end px-4 pb-2" style={{ height: HEADER_H }}>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Project</span>
          </div>
          <div ref={leftRef} className="flex-1 overflow-hidden">
            {filtered.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 px-4 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                style={{ height: ROW_HEIGHT }}
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <HealthDot health={p.health} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800 truncate">{p.name}</div>
                  <div className="text-xs text-gray-400 capitalize">{p.status.replace('_', ' ')} · {p.completion_percent}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: timeline */}
        <div ref={timelineRef} className="flex-1 overflow-auto" onScroll={handleScroll}>
          <div style={{ width: totalWidth, minWidth: '100%' }}>
            {/* Month headers */}
            <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200" style={{ height: HEADER_H }}>
              <div className="flex">
                {months.map((m, i) => {
                  const isCurrentMonth = m.getFullYear() === new Date().getFullYear() && m.getMonth() === new Date().getMonth()
                  return (
                    <div
                      key={i}
                      className={`flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-xs font-medium ${isCurrentMonth ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
                      style={{ width: CELL_WIDTH, height: HEADER_H }}
                    >
                      {format(m, 'MMM yyyy')}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Rows */}
            <div style={{ height: totalHeight, position: 'relative' }}>
              <svg width={totalWidth} height={totalHeight} className="absolute inset-0">
                {/* Background grid */}
                {months.map((_, i) => (
                  <rect key={i} x={i * CELL_WIDTH} y={0} width={CELL_WIDTH} height={totalHeight}
                    fill={i % 2 === 0 ? 'transparent' : '#f8fafc'} />
                ))}
                {months.map((_, i) => (
                  <line key={i} x1={i * CELL_WIDTH} y1={0} x2={i * CELL_WIDTH} y2={totalHeight} stroke="#e2e8f0" strokeWidth={1} />
                ))}
                {filtered.map((_, i) => (
                  <line key={i} x1={0} y1={(i + 1) * ROW_HEIGHT} x2={totalWidth} y2={(i + 1) * ROW_HEIGHT} stroke="#f1f5f9" strokeWidth={1} />
                ))}

                {/* Today line */}
                <line x1={todayX} y1={0} x2={todayX} y2={totalHeight} stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" opacity={0.8} />
                <text x={todayX + 4} y={12} fontSize={10} fill="#3b82f6" fontWeight="600">Today</text>

                {/* Project bars */}
                {filtered.map((p, i) => {
                  if (!p.start_date || !p.end_date) return null
                  const x = xOf(parseISO(p.start_date))
                  const endX = xOf(addDays(parseISO(p.end_date), 1))
                  const w = Math.max(endX - x, 6)
                  const y = i * ROW_HEIGHT + 12
                  const h = ROW_HEIGHT - 24
                  const progressW = w * (p.completion_percent / 100)
                  const barColor = STATUS_COLORS[p.status] || p.color

                  return (
                    <g key={p.id} className="cursor-pointer" onClick={() => navigate(`/projects/${p.id}`)}>
                      {/* BG bar */}
                      <rect x={x} y={y} width={w} height={h} rx={4} fill={barColor} opacity={0.2} />
                      {/* Progress bar */}
                      <rect x={x} y={y} width={progressW} height={h} rx={4} fill={barColor} opacity={0.85} />
                      {/* Border */}
                      <rect x={x} y={y} width={w} height={h} rx={4} fill="none" stroke={barColor} strokeWidth={1.5} />
                      {/* Label */}
                      {w > 60 && (
                        <text x={x + 6} y={y + h / 2 + 4} fontSize={10} fill="white" fontWeight="600" style={{ userSelect: 'none' }}>
                          {p.name.length > Math.floor(w / 7) ? p.name.slice(0, Math.floor(w / 7) - 1) + '…' : p.name}
                        </text>
                      )}
                      <title>{`${p.name} | ${p.start_date} → ${p.end_date} | ${p.completion_percent}% | ${formatCurrency(p.budget)}`}</title>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Summary table */}
      <div className="flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-auto max-h-48">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2">Project</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2 hidden sm:table-cell">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2">Timeline</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-2">Progress</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-2 hidden md:table-cell">Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/projects/${p.id}`)}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="font-medium text-gray-800 text-xs">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 hidden sm:table-cell">
                    <span className="text-xs capitalize text-gray-500">{p.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {p.start_date && p.end_date ? `${format(parseISO(p.start_date), 'MMM yy')} – ${format(parseISO(p.end_date), 'MMM yy')}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className="text-xs font-semibold text-gray-700">{p.completion_percent}%</span>
                  </td>
                  <td className="px-4 py-2 text-right hidden md:table-cell">
                    <span className={`text-xs font-medium ${p.budget > 0 && p.spent > p.budget * 0.9 ? 'text-red-600' : 'text-gray-600'}`}>
                      {formatCurrency(p.spent)} / {formatCurrency(p.budget)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
