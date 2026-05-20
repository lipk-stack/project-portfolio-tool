import { useMemo, useRef, useState, useCallback } from 'react'
import { Task } from '../../types'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  done:        { bg: '#f0fdf4', border: '#22c55e', text: '#15803d' },
  in_progress: { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8' },
  review:      { bg: '#fffbeb', border: '#f59e0b', text: '#b45309' },
  blocked:     { bg: '#fef2f2', border: '#ef4444', text: '#b91c1c' },
  todo:        { bg: '#f8fafc', border: '#94a3b8', text: '#475569' },
}

const NODE_W = 180
const NODE_H = 70
const H_GAP = 60
const V_GAP = 30

interface NodePos { x: number; y: number; col: number; row: number }

function layoutNodes(tasks: Task[]): Map<number, NodePos> {
  const idSet = new Set(tasks.map(t => t.id))
  const depMap = new Map<number, number[]>()
  for (const t of tasks) {
    depMap.set(t.id, (t.dependencies || []).filter(d => idSet.has(d)))
  }

  // Topological sort to determine columns
  const visited = new Set<number>()
  const colOf = new Map<number, number>()

  function getCol(id: number): number {
    if (colOf.has(id)) return colOf.get(id)!
    const preds = depMap.get(id) || []
    const col = preds.length === 0 ? 0 : Math.max(...preds.map(p => getCol(p))) + 1
    colOf.set(id, col)
    return col
  }

  for (const t of tasks) getCol(t.id)

  // Group by column, then assign rows
  const byCol = new Map<number, number[]>()
  for (const [id, col] of colOf) {
    if (!byCol.has(col)) byCol.set(col, [])
    byCol.get(col)!.push(id)
  }

  const positions = new Map<number, NodePos>()
  for (const [col, ids] of byCol) {
    ids.forEach((id, row) => {
      positions.set(id, {
        x: col * (NODE_W + H_GAP),
        y: row * (NODE_H + V_GAP),
        col, row,
      })
    })
  }
  return positions
}

interface NetworkDiagramProps {
  tasks: Task[]
  onTaskClick?: (task: Task) => void
}

export default function NetworkDiagram({ tasks, onTaskClick }: NetworkDiagramProps) {
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 40, y: 40 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Only show leaf tasks (no subtasks shown as a group here)
  const filteredTasks = tasks.filter(t => !t.parent_id)
  const positions = useMemo(() => layoutNodes(filteredTasks), [filteredTasks])

  const maxX = Math.max(...[...positions.values()].map(p => p.x)) + NODE_W
  const maxY = Math.max(...[...positions.values()].map(p => p.y)) + NODE_H
  const svgW = maxX + 80
  const svgH = maxY + 80

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).closest('.task-node')) return
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
  }

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging || !dragStart.current) return
    setPan({
      x: dragStart.current.px + (e.clientX - dragStart.current.mx),
      y: dragStart.current.py + (e.clientY - dragStart.current.my),
    })
  }, [dragging])

  const handleMouseUp = () => { setDragging(false); dragStart.current = null }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setScale(s => Math.max(0.3, Math.min(2, s - e.deltaY * 0.001)))
  }

  const idSet = new Set(filteredTasks.map(t => t.id))

  return (
    <div className="relative w-full h-full bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-white rounded-lg border border-gray-200 shadow-sm px-2 py-1.5">
        <button onClick={() => setScale(s => Math.min(2, s + 0.1))} className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded">
          <ZoomIn size={14} />
        </button>
        <span className="text-xs text-gray-500 w-10 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.max(0.3, s - 0.1))} className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded">
          <ZoomOut size={14} />
        </button>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <button onClick={() => { setScale(1); setPan({ x: 40, y: 40 }) }} className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded">
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-white rounded-lg border border-gray-200 shadow-sm px-3 py-2 flex items-center gap-3">
        {Object.entries(STATUS_COLORS).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border-2 flex-shrink-0" style={{ borderColor: colors.border, backgroundColor: colors.bg }} />
            <span className="text-xs text-gray-500 capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2 border-l border-gray-200 pl-3">
          <div className="w-3 h-3 rounded border-2 flex-shrink-0 border-red-500 bg-red-50" />
          <span className="text-xs text-gray-500">Critical</span>
        </div>
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full select-none"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <defs>
          <marker id="net-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
          </marker>
          <marker id="net-arrow-critical" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#ef4444" />
          </marker>
          <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="1" fill="#e2e8f0" />
          </pattern>
        </defs>

        {/* Dot grid background */}
        <rect width="100%" height="100%" fill="url(#dots)" />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {/* Dependency edges */}
          {filteredTasks.flatMap(task => {
            const toPos = positions.get(task.id)
            if (!toPos || !task.dependencies?.length) return []
            return task.dependencies.filter(d => idSet.has(d)).map(predId => {
              const fromPos = positions.get(predId)
              if (!fromPos) return null
              const fromTask = filteredTasks.find(t => t.id === predId)
              const isCritical = fromTask?.is_critical === 1 && task.is_critical === 1
              const x1 = fromPos.x + NODE_W
              const y1 = fromPos.y + NODE_H / 2
              const x2 = toPos.x
              const y2 = toPos.y + NODE_H / 2
              const midX = (x1 + x2) / 2
              return (
                <path
                  key={`${predId}-${task.id}`}
                  d={`M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`}
                  fill="none"
                  stroke={isCritical ? '#ef4444' : '#94a3b8'}
                  strokeWidth={isCritical ? 2 : 1.5}
                  markerEnd={isCritical ? 'url(#net-arrow-critical)' : 'url(#net-arrow)'}
                  strokeDasharray={isCritical ? undefined : '4 2'}
                />
              )
            })
          })}

          {/* Task nodes */}
          {filteredTasks.map(task => {
            const pos = positions.get(task.id)
            if (!pos) return null
            const colors = STATUS_COLORS[task.status] || STATUS_COLORS.todo
            const isCritical = task.is_critical === 1
            const pct = task.completion_percent

            return (
              <g
                key={task.id}
                className="task-node"
                style={{ cursor: 'pointer' }}
                onClick={() => onTaskClick?.(task)}
              >
                {/* Shadow */}
                <rect x={pos.x + 3} y={pos.y + 3} width={NODE_W} height={NODE_H} rx={8} fill="rgba(0,0,0,0.06)" />
                {/* Card */}
                <rect
                  x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx={8}
                  fill={colors.bg}
                  stroke={isCritical ? '#ef4444' : colors.border}
                  strokeWidth={isCritical ? 2.5 : 1.5}
                />
                {/* Progress bar at bottom */}
                {pct > 0 && (
                  <>
                    <rect x={pos.x + 8} y={pos.y + NODE_H - 10} width={NODE_W - 16} height={4} rx={2} fill="#e2e8f0" />
                    <rect x={pos.x + 8} y={pos.y + NODE_H - 10} width={(NODE_W - 16) * pct / 100} height={4} rx={2} fill={colors.border} />
                  </>
                )}
                {/* Task name */}
                <text
                  x={pos.x + 10} y={pos.y + 22}
                  fontSize={11} fontWeight="600"
                  fill={colors.text}
                  style={{ userSelect: 'none' }}
                >
                  {task.wbs_code && <tspan fontSize={9} fill="#94a3b8">{task.wbs_code} </tspan>}
                  {task.name.length > 20 ? task.name.slice(0, 19) + '…' : task.name}
                </text>
                {/* Assignee */}
                <text x={pos.x + 10} y={pos.y + 38} fontSize={9.5} fill="#64748b" style={{ userSelect: 'none' }}>
                  {task.assignee_name ? `👤 ${task.assignee_name}` : ''}
                </text>
                {/* Status + percent */}
                <text x={pos.x + 10} y={pos.y + 52} fontSize={9} fill="#94a3b8" style={{ userSelect: 'none' }}>
                  {task.status.replace('_', ' ')} · {pct}%
                </text>
                {/* Critical badge */}
                {isCritical && (
                  <rect x={pos.x + NODE_W - 28} y={pos.y + 8} width={20} height={12} rx={3} fill="#ef4444" />
                )}
                {isCritical && (
                  <text x={pos.x + NODE_W - 24} y={pos.y + 18} fontSize={7.5} fill="white" fontWeight="bold" style={{ userSelect: 'none' }}>CP</text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
