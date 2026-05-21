import { useState, useRef, useEffect, useCallback } from 'react'
import { format, addDays, addWeeks, addMonths, differenceInDays, startOfWeek, startOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, isToday, isSameMonth, parseISO } from 'date-fns'
import { ChevronDown, ChevronRight, ZoomIn, ZoomOut, Calendar, LucideIcon } from 'lucide-react'
import { Task } from '../../types'

type Zoom = 'day' | 'week' | 'month'

interface BaselineTaskInfo { start_date: string | null; end_date: string | null }

interface GanttProps {
  tasks: Task[]
  onTaskClick?: (task: Task) => void
  onTaskUpdate?: (id: number, start: string, end: string) => void
  projectStart?: string
  projectEnd?: string
  baselineTasks?: Record<number, BaselineTaskInfo>
}

const STATUS_COLORS: Record<string, { bar: string; progress: string }> = {
  done: { bar: '#22c55e', progress: '#16a34a' },
  in_progress: { bar: '#3b82f6', progress: '#1d4ed8' },
  review: { bar: '#f59e0b', progress: '#d97706' },
  blocked: { bar: '#ef4444', progress: '#dc2626' },
  todo: { bar: '#94a3b8', progress: '#64748b' },
}

const PRIORITY_STROKE: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: 'transparent',
  low: 'transparent',
}

const LEFT_WIDTH = 320
const ROW_HEIGHT = 40
const HEADER_HEIGHT = 60

function getZoomConfig(zoom: Zoom) {
  return zoom === 'day'
    ? { cellWidth: 30, labelFormat: 'd', headerFormat: 'MMM yyyy' }
    : zoom === 'week'
    ? { cellWidth: 120, labelFormat: "'W'w", headerFormat: 'MMM yyyy' }
    : { cellWidth: 180, labelFormat: 'MMM', headerFormat: 'yyyy' }
}

function buildTree(tasks: Task[]): Task[] {
  const map = new Map<number, Task & { children: Task[] }>()
  const roots: (Task & { children: Task[] })[] = []
  for (const t of tasks) map.set(t.id, { ...t, children: [] })
  for (const t of tasks) {
    const node = map.get(t.id)!
    if (t.parent_id && map.has(t.parent_id)) {
      map.get(t.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots as Task[]
}

function flattenTree(tasks: Task[], expanded: Set<number>, depth = 0): Array<Task & { depth: number; hasChildren: boolean }> {
  const result: Array<Task & { depth: number; hasChildren: boolean }> = []
  for (const t of tasks) {
    const children = (t as Task & { children?: Task[] }).children || []
    result.push({ ...t, depth, hasChildren: children.length > 0 })
    if (children.length > 0 && expanded.has(t.id)) {
      result.push(...flattenTree(children, expanded, depth + 1))
    }
  }
  return result
}

export default function GanttChart({ tasks, onTaskClick, onTaskUpdate, projectStart, projectEnd, baselineTasks }: GanttProps) {
  const [zoom, setZoom] = useState<Zoom>('week')
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(tasks.filter(t => !t.parent_id).map(t => t.id)))
  const [showBaseline, setShowBaseline] = useState(true)
  const timelineRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)

  const cfg = getZoomConfig(zoom)

  const allDates = tasks.flatMap(t => [t.start_date, t.end_date].filter(Boolean) as string[])
  const minDate = projectStart ? parseISO(projectStart) : allDates.length ? new Date(Math.min(...allDates.map(d => new Date(d).getTime()))) : new Date()
  const maxDate = projectEnd ? parseISO(projectEnd) : allDates.length ? new Date(Math.max(...allDates.map(d => new Date(d).getTime()))) : addMonths(new Date(), 3)

  const startDate = addDays(startOfWeek(minDate, { weekStartsOn: 1 }), -7)
  const endDate = addDays(maxDate, 14)

  const columns = zoom === 'day'
    ? eachDayOfInterval({ start: startDate, end: endDate })
    : zoom === 'week'
    ? eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 })
    : eachMonthOfInterval({ start: startDate, end: endDate })

  const totalWidth = columns.length * cfg.cellWidth

  function xOf(date: Date): number {
    const diff = differenceInDays(date, startDate)
    return zoom === 'day'
      ? diff * cfg.cellWidth
      : zoom === 'week'
      ? (diff / 7) * cfg.cellWidth
      : (diff / 30.44) * cfg.cellWidth
  }

  const tree = buildTree(tasks)
  const flatTasks = flattenTree(tree, expanded)

  const toggleExpanded = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const todayX = xOf(new Date())
  const totalHeight = flatTasks.length * ROW_HEIGHT

  // Sync scroll between left and timeline panels
  const handleTimelineScroll = useCallback(() => {
    if (leftRef.current && timelineRef.current) {
      leftRef.current.scrollTop = timelineRef.current.scrollTop
    }
  }, [])

  // Scroll to today on mount
  useEffect(() => {
    if (timelineRef.current) {
      const scrollX = Math.max(todayX - 200, 0)
      timelineRef.current.scrollLeft = scrollX
    }
  }, [todayX])

  const zoomLevels: Zoom[] = ['day', 'week', 'month']

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-600">Gantt Chart</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 mr-1">Zoom:</span>
          {zoomLevels.map(z => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-3 py-1 text-xs rounded-lg font-medium capitalize transition-colors ${zoom === z ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {z}
            </button>
          ))}
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button onClick={() => { const i = zoomLevels.indexOf(zoom); if (i > 0) setZoom(zoomLevels[i - 1]) }} className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30" disabled={zoom === 'day'}>
            <ZoomIn size={14} />
          </button>
          <button onClick={() => { const i = zoomLevels.indexOf(zoom); if (i < 2) setZoom(zoomLevels[i + 1]) }} className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30" disabled={zoom === 'month'}>
            <ZoomOut size={14} />
          </button>
          {baselineTasks && Object.keys(baselineTasks).length > 0 && (
            <>
              <div className="w-px h-4 bg-gray-200 mx-1" />
              <button
                onClick={() => setShowBaseline(v => !v)}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg border transition-colors ${showBaseline ? 'bg-purple-50 border-purple-300 text-purple-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                <div className="w-3 h-3 rounded border-2 border-purple-400 bg-purple-100" />
                Baseline
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - task list */}
        <div className="flex-shrink-0 border-r border-gray-200 flex flex-col" style={{ width: LEFT_WIDTH }}>
          {/* Header */}
          <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200 flex items-end" style={{ height: HEADER_HEIGHT }}>
            <div className="w-full px-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Task</div>
          </div>
          {/* Task rows */}
          <div ref={leftRef} className="flex-1 overflow-hidden" style={{ overflowY: 'hidden' }}>
            {flatTasks.map((task, i) => {
              const colors = STATUS_COLORS[task.status] || STATUS_COLORS.todo
              return (
                <div
                  key={task.id}
                  className={`flex items-center border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                  style={{ height: ROW_HEIGHT, paddingLeft: 8 + task.depth * 20 }}
                  onClick={() => onTaskClick?.(task)}
                >
                  {task.hasChildren ? (
                    <button
                      className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0 mr-1"
                      onClick={e => { e.stopPropagation(); toggleExpanded(task.id) }}
                    >
                      {expanded.has(task.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  ) : (
                    <div className="w-5 h-5 flex-shrink-0 mr-1 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.bar }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs truncate ${task.is_critical ? 'font-semibold text-red-700' : 'text-gray-700'}`}>
                      {task.wbs_code && <span className="text-gray-400 mr-1">{task.wbs_code}</span>}
                      {task.name}
                    </div>
                    {task.assignee_name && (
                      <div className="text-xs text-gray-400 truncate">{task.assignee_name}</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 px-2 flex-shrink-0">{task.completion_percent}%</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right panel - timeline */}
        <div
          ref={timelineRef}
          className="flex-1 overflow-auto"
          onScroll={handleTimelineScroll}
        >
          <div style={{ width: totalWidth, minWidth: '100%' }}>
            {/* Time header */}
            <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200" style={{ height: HEADER_HEIGHT }}>
              {/* Month/year row */}
              <div className="flex" style={{ height: 28 }}>
                {zoom !== 'month' && columns.reduce((acc: JSX.Element[], col, i) => {
                  const label = format(col, zoom === 'day' ? 'MMM yyyy' : 'yyyy')
                  const isFirst = i === 0 || (zoom === 'day' ? !isSameMonth(col, columns[i - 1]) : col.getFullYear() !== columns[i - 1].getFullYear())
                  if (isFirst) {
                    const count = zoom === 'day'
                      ? columns.filter(c => isSameMonth(c, col)).length
                      : columns.filter(c => c.getFullYear() === col.getFullYear()).length
                    acc.push(
                      <div key={i} className="border-r border-gray-200 flex items-center px-2" style={{ width: count * cfg.cellWidth, flexShrink: 0 }}>
                        <span className="text-xs font-semibold text-gray-600">{label}</span>
                      </div>
                    )
                  }
                  return acc
                }, [])}
              </div>
              {/* Day/week/month columns */}
              <div className="flex" style={{ height: 32 }}>
                {columns.map((col, i) => {
                  const label = format(col, cfg.labelFormat)
                  const isWeekend = zoom === 'day' && (col.getDay() === 0 || col.getDay() === 6)
                  const isTodayCol = isToday(col)
                  return (
                    <div
                      key={i}
                      className={`flex-shrink-0 border-r border-gray-200 flex items-center justify-center text-xs ${isWeekend ? 'bg-gray-100 text-gray-400' : isTodayCol ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-500'}`}
                      style={{ width: cfg.cellWidth }}
                    >
                      {label}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Task bars SVG */}
            <div style={{ height: totalHeight, position: 'relative' }}>
              {/* Background grid */}
              <svg width={totalWidth} height={totalHeight} className="absolute inset-0">
                {/* Weekend highlights for day view */}
                {zoom === 'day' && columns.map((col, i) => {
                  const isWeekend = col.getDay() === 0 || col.getDay() === 6
                  if (!isWeekend) return null
                  return <rect key={i} x={i * cfg.cellWidth} y={0} width={cfg.cellWidth} height={totalHeight} fill="#f8fafc" />
                })}
                {/* Grid lines */}
                {columns.map((_, i) => (
                  <line key={i} x1={i * cfg.cellWidth} y1={0} x2={i * cfg.cellWidth} y2={totalHeight} stroke="#e2e8f0" strokeWidth={1} />
                ))}
                {/* Row separators */}
                {flatTasks.map((_, i) => (
                  <line key={i} x1={0} y1={(i + 1) * ROW_HEIGHT} x2={totalWidth} y2={(i + 1) * ROW_HEIGHT} stroke="#f1f5f9" strokeWidth={1} />
                ))}
                {/* Today line */}
                <line x1={todayX} y1={0} x2={todayX} y2={totalHeight} stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" opacity={0.8} />

                {/* Task bars */}
                {flatTasks.map((task, i) => {
                  if (!task.start_date || !task.end_date) return null
                  const x = xOf(parseISO(task.start_date))
                  const endX = xOf(addDays(parseISO(task.end_date), 1))
                  const w = Math.max(endX - x, 4)
                  const y = i * ROW_HEIGHT + 8
                  const h = ROW_HEIGHT - 16
                  const colors = STATUS_COLORS[task.status] || STATUS_COLORS.todo
                  const progressW = Math.max(w * (task.completion_percent / 100), 0)
                  const isCritical = task.is_critical === 1

                  // Milestone (no duration or story points = milestone if task is very short)
                  const durationDays = differenceInDays(parseISO(task.end_date), parseISO(task.start_date))
                  if (durationDays === 0) {
                    const mx = xOf(parseISO(task.start_date))
                    const my = i * ROW_HEIGHT + ROW_HEIGHT / 2
                    const size = 8
                    return (
                      <g key={task.id} className="cursor-pointer" onClick={() => onTaskClick?.(task)}>
                        <polygon points={`${mx},${my - size} ${mx + size},${my} ${mx},${my + size} ${mx - size},${my}`} fill={colors.bar} />
                        <title>{task.name}</title>
                      </g>
                    )
                  }

                  return (
                    <g key={task.id} className="cursor-pointer" onClick={() => onTaskClick?.(task)}>
                      {/* Background bar */}
                      <rect x={x} y={y} width={w} height={h} rx={4} ry={4} fill={colors.bar} opacity={0.25} />
                      {/* Progress bar */}
                      <rect x={x} y={y} width={progressW} height={h} rx={4} ry={4} fill={colors.bar} />
                      {/* Critical path indicator */}
                      {isCritical && <rect x={x} y={y} width={w} height={h} rx={4} ry={4} fill="none" stroke="#ef4444" strokeWidth={2} />}
                      {/* Priority indicator */}
                      {(task.priority === 'critical' || task.priority === 'high') && (
                        <rect x={x} y={y} width={3} height={h} rx={1} fill={PRIORITY_STROKE[task.priority]} />
                      )}
                      {/* Label */}
                      {w > 50 && (
                        <text x={x + 6} y={y + h / 2 + 4} fontSize={10} fill="white" fontWeight="500" style={{ userSelect: 'none' }}>
                          {task.name.length > Math.floor(w / 7) ? task.name.slice(0, Math.floor(w / 7) - 1) + '…' : task.name}
                        </text>
                      )}
                      <title>{`${task.name} | ${task.start_date} → ${task.end_date} | ${task.completion_percent}%`}</title>
                    </g>
                  )
                })}

                {/* Baseline ghost bars */}
                {baselineTasks && showBaseline && flatTasks.map((task, i) => {
                  const bl = baselineTasks[task.id]
                  if (!bl?.start_date || !bl?.end_date) return null
                  const bx = xOf(parseISO(bl.start_date))
                  const bEndX = xOf(addDays(parseISO(bl.end_date), 1))
                  const bw = Math.max(bEndX - bx, 4)
                  const by = i * ROW_HEIGHT + 8
                  const bh = ROW_HEIGHT - 16
                  return (
                    <g key={`bl-${task.id}`} opacity={0.45}>
                      <rect x={bx} y={by} width={bw} height={bh} rx={4} ry={4} fill="#7c3aed" opacity={0.15} stroke="#7c3aed" strokeWidth={1.5} strokeDasharray="3 2" />
                      <title>Baseline: {bl.start_date} → {bl.end_date}</title>
                    </g>
                  )
                })}

                {/* Dependency arrows */}
                {flatTasks.flatMap(task => {
                  if (!task.dependencies?.length || !task.start_date) return []
                  const taskStartDate = task.start_date
                  return task.dependencies.flatMap(predId => {
                    const predIdx = flatTasks.findIndex(t => t.id === predId)
                    const predTask = flatTasks[predIdx]
                    if (!predTask?.end_date || predIdx === -1) return []
                    const x1 = xOf(addDays(parseISO(predTask.end_date), 1))
                    const y1 = predIdx * ROW_HEIGHT + ROW_HEIGHT / 2
                    const x2 = xOf(parseISO(taskStartDate))
                    const y2 = flatTasks.indexOf(task) * ROW_HEIGHT + ROW_HEIGHT / 2
                    const midX = (x1 + x2) / 2
                    return [(
                      <g key={`${predId}-${task.id}`} opacity={0.6}>
                        <path d={`M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`} fill="none" stroke="#64748b" strokeWidth={1.5} markerEnd="url(#arrow)" />
                      </g>
                    )]
                  })
                })}

                {/* Arrow marker definition */}
                <defs>
                  <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#64748b" />
                  </marker>
                </defs>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex-shrink-0">
        {Object.entries(STATUS_COLORS).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.bar }} />
            <span className="capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-4">
          <div className="w-3 h-3 rounded border-2 border-red-500 bg-transparent" />
          <span>Critical Path</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-4" style={{ background: 'repeating-linear-gradient(180deg, #3b82f6 0px, #3b82f6 4px, transparent 4px, transparent 8px)' }} />
          <span>Today</span>
        </div>
        {baselineTasks && showBaseline && (
          <div className="flex items-center gap-1.5 ml-4">
            <div className="w-8 h-3 rounded border-2 border-dashed border-purple-400 bg-purple-100 opacity-70" />
            <span>Baseline</span>
          </div>
        )}
      </div>
    </div>
  )
}
