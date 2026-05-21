import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  format, addDays, differenceInDays, startOfWeek, eachWeekOfInterval,
  eachMonthOfInterval, parseISO, isToday, isSameMonth, addMonths
} from 'date-fns'
import { Calendar, ZoomIn, ZoomOut, ChevronDown, ChevronRight, Layers } from 'lucide-react'
import api from '../api'

type Zoom = 'week' | 'month' | 'quarter'

interface TimelineProject {
  id: number; name: string; status: string; health: string; priority: string
  color: string; completion_percent: number; start_date: string; end_date: string
  manager_name: string; portfolio_name: string; portfolio_id: number
}
interface TimelineMilestone {
  id: number; name: string; date: string; status: string; project_id: number
  project_name: string; project_color: string
}

const HEALTH_COLORS: Record<string, string> = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444' }
const ROW_HEIGHT = 44
const HEADER_HEIGHT = 64
const LEFT_WIDTH = 280

function getZoom(zoom: Zoom) {
  if (zoom === 'week') return { cellWidth: 120, fmt: "'W'w", topFmt: 'MMM yyyy' }
  if (zoom === 'month') return { cellWidth: 160, fmt: 'MMM', topFmt: 'yyyy' }
  return { cellWidth: 200, fmt: 'QQQ', topFmt: 'yyyy' }
}

export default function Timeline() {
  const [data, setData] = useState<{ projects: TimelineProject[]; milestones: TimelineMilestone[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState<Zoom>('month')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [groupBy, setGroupBy] = useState<'portfolio' | 'none'>('portfolio')
  const timelineRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/timeline').then(r => {
      setData(r.data)
      // Expand all portfolio groups by default
      const portfolios = new Set<string>()
      for (const p of r.data.projects) portfolios.add(p.portfolio_name || 'Standalone')
      setExpanded(portfolios)
    }).finally(() => setLoading(false))
  }, [])

  const cfg = getZoom(zoom)

  const allDates = data?.projects.flatMap(p => [p.start_date, p.end_date].filter(Boolean)) || []
  const minDate = allDates.length ? new Date(Math.min(...allDates.map(d => new Date(d).getTime()))) : new Date()
  const maxDate = allDates.length ? new Date(Math.max(...allDates.map(d => new Date(d).getTime()))) : addMonths(new Date(), 6)

  const startDate = addDays(startOfWeek(minDate, { weekStartsOn: 1 }), -14)
  const endDate = addDays(maxDate, 30)

  const columns = zoom === 'week'
    ? eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 })
    : eachMonthOfInterval({ start: startDate, end: endDate })

  const totalWidth = columns.length * cfg.cellWidth

  function xOf(date: Date): number {
    const diff = differenceInDays(date, startDate)
    return zoom === 'week' ? (diff / 7) * cfg.cellWidth : (diff / 30.44) * cfg.cellWidth
  }

  const todayX = xOf(new Date())

  const handleTimelineScroll = useCallback(() => {
    if (leftRef.current && timelineRef.current) {
      leftRef.current.scrollTop = timelineRef.current.scrollTop
    }
  }, [])

  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollLeft = Math.max(0, todayX - 300)
    }
  }, [todayX, data])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!data) return null

  // Group projects
  type Row = { type: 'group'; name: string; count: number } | { type: 'project'; project: TimelineProject }
  const rows: Row[] = []

  if (groupBy === 'portfolio') {
    const groups = new Map<string, TimelineProject[]>()
    for (const p of data.projects) {
      const key = p.portfolio_name || 'Standalone'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(p)
    }
    for (const [name, projects] of groups) {
      rows.push({ type: 'group', name, count: projects.length })
      if (expanded.has(name)) {
        for (const p of projects) rows.push({ type: 'project', project: p })
      }
    }
  } else {
    for (const p of data.projects) rows.push({ type: 'project', project: p })
  }

  const totalHeight = rows.length * ROW_HEIGHT

  const zoomLevels: Zoom[] = ['week', 'month', 'quarter']

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio Timeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data.projects.length} projects across all portfolios</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg p-1">
            <Layers size={14} className="text-gray-400 ml-1" />
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value as 'portfolio' | 'none')}
              className="text-sm text-gray-600 bg-transparent focus:outline-none pr-2"
            >
              <option value="portfolio">Group by Portfolio</option>
              <option value="none">No Grouping</option>
            </select>
          </div>
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
            {zoomLevels.map(z => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${zoom === z ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {z}
              </button>
            ))}
          </div>
          <button onClick={() => { const i = zoomLevels.indexOf(zoom); if (i > 0) setZoom(zoomLevels[i - 1]) }} className="p-1.5 rounded text-gray-500 hover:bg-gray-100 border border-gray-200" disabled={zoom === 'week'}><ZoomIn size={14} /></button>
          <button onClick={() => { const i = zoomLevels.indexOf(zoom); if (i < 2) setZoom(zoomLevels[i + 1]) }} className="p-1.5 rounded text-gray-500 hover:bg-gray-100 border border-gray-200" disabled={zoom === 'quarter'}><ZoomOut size={14} /></button>
        </div>
      </div>

      {/* Main Gantt */}
      <div className="flex flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Left panel */}
        <div className="flex-shrink-0 border-r border-gray-200 flex flex-col" style={{ width: LEFT_WIDTH }}>
          <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200 flex items-end px-4 pb-2" style={{ height: HEADER_HEIGHT }}>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Project / Portfolio</span>
          </div>
          <div ref={leftRef} className="flex-1 overflow-hidden">
            {rows.map((row, i) => {
              if (row.type === 'group') {
                const isOpen = expanded.has(row.name)
                return (
                  <div
                    key={`g-${row.name}`}
                    className="flex items-center gap-2 px-3 border-b border-gray-100 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => setExpanded(prev => {
                      const next = new Set(prev)
                      next.has(row.name) ? next.delete(row.name) : next.add(row.name)
                      return next
                    })}
                  >
                    {isOpen ? <ChevronDown size={14} className="text-gray-500 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-500 flex-shrink-0" />}
                    <span className="text-xs font-semibold text-gray-700 truncate">{row.name}</span>
                    <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{row.count}</span>
                  </div>
                )
              }
              const p = row.project
              return (
                <div
                  key={`p-${p.id}`}
                  className={`flex items-center gap-2 px-3 border-b border-gray-100 cursor-pointer hover:bg-blue-50/50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                  style={{ height: ROW_HEIGHT, paddingLeft: groupBy === 'portfolio' ? 28 : 12 }}
                  onClick={() => navigate(`/projects/${p.id}`)}
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-800 truncate">{p.name}</div>
                    <div className="text-xs text-gray-400 truncate capitalize">{p.status.replace('_', ' ')}</div>
                  </div>
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: HEALTH_COLORS[p.health] }}
                    title={p.health}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Right timeline panel */}
        <div ref={timelineRef} className="flex-1 overflow-auto" onScroll={handleTimelineScroll}>
          <div style={{ width: totalWidth, minWidth: '100%' }}>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200" style={{ height: HEADER_HEIGHT }}>
              {/* Top row: year/month groups */}
              <div className="flex" style={{ height: 28 }}>
                {columns.reduce((acc: JSX.Element[], col, i) => {
                  const label = zoom === 'week'
                    ? format(col, 'MMM yyyy')
                    : format(col, 'yyyy')
                  const isFirst = zoom === 'week'
                    ? (i === 0 || !isSameMonth(col, columns[i - 1]))
                    : (i === 0 || col.getFullYear() !== columns[i - 1].getFullYear())
                  if (!isFirst) return acc
                  const count = zoom === 'week'
                    ? columns.filter(c => isSameMonth(c, col)).length
                    : columns.filter(c => c.getFullYear() === col.getFullYear()).length
                  acc.push(
                    <div key={i} className="border-r border-gray-200 flex items-center px-2 flex-shrink-0" style={{ width: count * cfg.cellWidth }}>
                      <span className="text-xs font-semibold text-gray-600">{label}</span>
                    </div>
                  )
                  return acc
                }, [])}
              </div>
              {/* Bottom row: individual cells */}
              <div className="flex" style={{ height: 36 }}>
                {columns.map((col, i) => {
                  const label = format(col, cfg.fmt)
                  const isTodayCol = zoom === 'week' && isToday(col)
                  return (
                    <div
                      key={i}
                      className={`flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-xs font-medium ${isTodayCol ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
                      style={{ width: cfg.cellWidth }}
                    >
                      {label}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Timeline bars SVG */}
            <div style={{ height: totalHeight, position: 'relative' }}>
              <svg width={totalWidth} height={totalHeight} className="absolute inset-0">
                {/* Grid */}
                {columns.map((_, i) => (
                  <line key={i} x1={i * cfg.cellWidth} y1={0} x2={i * cfg.cellWidth} y2={totalHeight} stroke="#f1f5f9" strokeWidth={1} />
                ))}
                {rows.map((_, i) => (
                  <line key={i} x1={0} y1={(i + 1) * ROW_HEIGHT} x2={totalWidth} y2={(i + 1) * ROW_HEIGHT} stroke="#f1f5f9" strokeWidth={1} />
                ))}

                {/* Today line */}
                <line x1={todayX} y1={0} x2={todayX} y2={totalHeight} stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" opacity={0.7} />
                <text x={todayX + 4} y={12} fill="#3b82f6" fontSize={9} fontWeight="600">TODAY</text>

                {/* Project bars */}
                {rows.map((row, i) => {
                  if (row.type === 'group') {
                    // Draw a group background line
                    return <rect key={`gbg-${i}`} x={0} y={i * ROW_HEIGHT} width={totalWidth} height={ROW_HEIGHT} fill="#f8fafc" opacity={0.8} />
                  }
                  const p = row.project
                  if (!p.start_date || !p.end_date) return null
                  const x = xOf(parseISO(p.start_date))
                  const endX = xOf(addDays(parseISO(p.end_date), 1))
                  const w = Math.max(endX - x, 8)
                  const y = i * ROW_HEIGHT + 10
                  const h = ROW_HEIGHT - 20
                  const progressW = w * (p.completion_percent / 100)

                  return (
                    <g key={`bar-${p.id}`} className="cursor-pointer" onClick={() => navigate(`/projects/${p.id}`)}>
                      <rect x={x} y={y} width={w} height={h} rx={5} fill={p.color} opacity={0.2} />
                      <rect x={x} y={y} width={progressW} height={h} rx={5} fill={p.color} opacity={0.85} />
                      {/* Health indicator */}
                      <rect x={x} y={y} width={4} height={h} rx={2} fill={HEALTH_COLORS[p.health]} />
                      {/* Label */}
                      {w > 60 && (
                        <text x={x + 10} y={y + h / 2 + 4} fontSize={10} fill="white" fontWeight="600" style={{ userSelect: 'none' }} opacity={0.9}>
                          {p.completion_percent}%
                        </text>
                      )}
                      <title>{`${p.name} | ${p.start_date} → ${p.end_date} | ${p.completion_percent}% complete`}</title>
                    </g>
                  )
                })}

                {/* Milestones */}
                {data.milestones.map(m => {
                  const rowIdx = rows.findIndex(r => r.type === 'project' && r.project.id === m.project_id)
                  if (rowIdx === -1) return null
                  const mx = xOf(parseISO(m.date))
                  const my = rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2
                  const size = 7
                  const color = m.status === 'achieved' ? '#22c55e' : m.status === 'missed' ? '#ef4444' : '#f59e0b'
                  return (
                    <g key={`ms-${m.id}`}>
                      <polygon points={`${mx},${my - size} ${mx + size},${my} ${mx},${my + size} ${mx - size},${my}`} fill={color} stroke="white" strokeWidth={1.5} />
                      <title>{`${m.name} — ${m.date} (${m.status})`}</title>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-3 text-xs text-gray-500 flex-shrink-0">
        <div className="flex items-center gap-1.5"><div className="w-4 h-3 rounded" style={{ background: 'linear-gradient(90deg, #22c55e 30%, #3b82f6 100%)' }} /><span>Progress bar</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500" /><span>On Track</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500" /><span>At Risk</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /><span>Off Track</span></div>
        <div className="flex items-center gap-1.5">
          <svg width={16} height={16}><polygon points="8,1 15,8 8,15 1,8" fill="#f59e0b" /></svg>
          <span>Milestone</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width={16} height={16}><polygon points="8,1 15,8 8,15 1,8" fill="#22c55e" /></svg>
          <span>Achieved</span>
        </div>
      </div>
    </div>
  )
}
