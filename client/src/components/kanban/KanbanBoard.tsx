import { useState, useCallback } from 'react'
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Clock, AlertCircle, CheckCircle2, Circle, Pause, ArrowUpCircle, LucideIcon, Settings2 } from 'lucide-react'
import { Task, TaskStatus } from '../../types'
import { PriorityBadge } from '../ui/Badge'
import Avatar from '../ui/Avatar'
import Progress from '../ui/Progress'
import { format, parseISO, isPast } from 'date-fns'

interface KanbanProps {
  tasks: Task[]
  projectId?: number
  onTaskUpdate: (id: number, status: TaskStatus) => void
  onTaskClick: (task: Task) => void
  onAddTask?: (status: TaskStatus) => void
}

type WipLimits = Record<string, number>

const COLUMNS: { id: TaskStatus; label: string; icon: LucideIcon; color: string }[] = [
  { id: 'todo', label: 'To Do', icon: Circle, color: 'text-gray-400' },
  { id: 'in_progress', label: 'In Progress', icon: ArrowUpCircle, color: 'text-blue-500' },
  { id: 'review', label: 'In Review', icon: Pause, color: 'text-yellow-500' },
  { id: 'blocked', label: 'Blocked', icon: AlertCircle, color: 'text-red-500' },
  { id: 'done', label: 'Done', icon: CheckCircle2, color: 'text-green-500' },
]

function TaskCard({ task, onClick, overlay }: { task: Task; onClick: () => void; overlay?: boolean }) {
  const isOverdue = task.end_date && isPast(parseISO(task.end_date)) && task.status !== 'done'
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`kanban-card select-none ${overlay ? 'shadow-xl rotate-1 scale-105' : ''}`}
      onClick={onClick}
    >
      {/* Priority stripe */}
      {task.priority === 'critical' && <div className="w-full h-0.5 bg-red-500 rounded-t mb-2 -mt-1" />}
      {task.priority === 'high' && <div className="w-full h-0.5 bg-orange-400 rounded-t mb-2 -mt-1" />}

      <div className="text-sm font-medium text-gray-800 mb-2 leading-snug">{task.name}</div>

      {task.description && (
        <div className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</div>
      )}

      {/* Tags */}
      {task.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">{tag}</span>
          ))}
        </div>
      )}

      {/* Progress */}
      {task.completion_percent > 0 && task.status !== 'done' && (
        <Progress value={task.completion_percent} size="sm" className="mb-2" />
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={task.priority} />
          {task.story_points && (
            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">{task.story_points} pts</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {task.end_date && (
            <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
              <Clock size={10} />
              {format(parseISO(task.end_date), 'MMM d')}
            </div>
          )}
          {task.assignee_name && <Avatar name={task.assignee_name} size="xs" />}
        </div>
      </div>

      {/* Estimated hours */}
      {task.estimated_hours > 0 && (
        <div className="mt-1 text-xs text-gray-400">
          {task.actual_hours > 0 ? `${task.actual_hours}h / ${task.estimated_hours}h` : `${task.estimated_hours}h est.`}
        </div>
      )}
    </div>
  )
}

function KanbanColumn({
  column, tasks, onTaskClick, onAddTask, wipLimit, onSetWipLimit
}: {
  column: typeof COLUMNS[0]
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onAddTask?: () => void
  wipLimit?: number
  onSetWipLimit: (limit: number | undefined) => void
}) {
  const [editingWip, setEditingWip] = useState(false)
  const [wipInput, setWipInput] = useState(String(wipLimit || ''))
  const isOverLimit = wipLimit !== undefined && tasks.length > wipLimit
  const isAtLimit = wipLimit !== undefined && tasks.length === wipLimit

  return (
    <div className={`flex flex-col rounded-xl p-3 min-w-[240px] max-w-[280px] ${isOverLimit ? 'bg-red-50 ring-2 ring-red-200' : isAtLimit ? 'bg-yellow-50 ring-1 ring-yellow-200' : 'bg-gray-50'}`}>
      {/* Column header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <column.icon size={16} className={column.color} />
          <span className="text-sm font-semibold text-gray-700">{column.label}</span>
          <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${isOverLimit ? 'bg-red-200 text-red-700' : isAtLimit ? 'bg-yellow-200 text-yellow-700' : 'bg-gray-200 text-gray-600'}`}>
            {tasks.length}{wipLimit ? `/${wipLimit}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {editingWip ? (
            <div className="flex items-center gap-1">
              <input
                type="number" min="1" max="50" value={wipInput}
                onChange={e => setWipInput(e.target.value)}
                className="w-12 text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="∞"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    onSetWipLimit(wipInput ? parseInt(wipInput) : undefined)
                    setEditingWip(false)
                  } else if (e.key === 'Escape') setEditingWip(false)
                }}
                autoFocus
              />
              <button onClick={() => { onSetWipLimit(wipInput ? parseInt(wipInput) : undefined); setEditingWip(false) }} className="text-xs text-blue-600 font-medium">✓</button>
            </div>
          ) : (
            <button onClick={() => { setWipInput(String(wipLimit || '')); setEditingWip(true) }} className="p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-200 transition-colors" title="Set WIP limit">
              <Settings2 size={12} />
            </button>
          )}
          {onAddTask && (
            <button onClick={onAddTask} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors">
              <Plus size={14} />
            </button>
          )}
        </div>
      </div>

      {wipLimit && <div className={`text-xs mb-2 px-1 font-medium ${isOverLimit ? 'text-red-600' : isAtLimit ? 'text-yellow-600' : 'text-gray-400'}`}>WIP limit: {wipLimit}</div>}

      {/* Cards */}
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1 min-h-[100px]">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
          {tasks.length === 0 && (
            <div className="flex-1 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center min-h-[80px]">
              <span className="text-xs text-gray-400">Drop tasks here</span>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export default function KanbanBoard({ tasks, projectId, onTaskUpdate, onTaskClick, onAddTask }: KanbanProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [wipLimits, setWipLimits] = useState<WipLimits>(() => {
    try { return JSON.parse(localStorage.getItem(`kanban-wip-${projectId}`) || '{}') } catch { return {} }
  })

  const setWipLimit = (status: string, limit: number | undefined) => {
    const next = { ...wipLimits }
    if (limit === undefined) delete next[status]
    else next[status] = limit
    setWipLimits(next)
    localStorage.setItem(`kanban-wip-${projectId}`, JSON.stringify(next))
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const tasksByStatus = useCallback((status: TaskStatus) =>
    tasks.filter(t => t.status === status && !t.parent_id).sort((a, b) => a.position - b.position),
    [tasks]
  )

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return

    const draggedTask = tasks.find(t => t.id === active.id)
    if (!draggedTask) return

    // Check if dropped over a column label or a task in a different column
    const targetTask = tasks.find(t => t.id === over.id)
    if (targetTask && targetTask.status !== draggedTask.status) {
      onTaskUpdate(draggedTask.id, targetTask.status)
    } else {
      // Dropped on empty column area — check column id
      const colId = over.id as TaskStatus
      if (COLUMNS.find(c => c.id === colId) && colId !== draggedTask.status) {
        onTaskUpdate(draggedTask.id, colId)
      }
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 h-full">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={tasksByStatus(col.id)}
            onTaskClick={onTaskClick}
            onAddTask={onAddTask ? () => onAddTask(col.id) : undefined}
            wipLimit={wipLimits[col.id]}
            onSetWipLimit={(limit) => setWipLimit(col.id, limit)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <TaskCard task={activeTask} onClick={() => {}} overlay />
        )}
      </DragOverlay>
    </DndContext>
  )
}
