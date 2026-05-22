import { useState, useMemo } from 'react'
import { Task, TaskStatus } from '../types'
import { tasksApi } from '../api'
import { Plus, Zap, Target, CheckCircle2, Circle, Clock, Trophy, ChevronDown, ChevronRight, TrendingUp } from 'lucide-react'
import { PriorityBadge, StatusBadge } from './ui/Badge'
import Progress from './ui/Progress'
import Avatar from './ui/Avatar'
import { format, parseISO, differenceInDays, isPast } from 'date-fns'

interface SprintBoardProps {
  tasks: Task[]
  projectId: number
  onTaskUpdate: (id: number, status: TaskStatus) => void
  onTaskClick: (task: Task) => void
  onAddTask: (status: TaskStatus) => void
}

const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']

function getSprintStats(tasks: Task[]) {
  const total = tasks.reduce((s, t) => s + (t.story_points || 0), 0)
  const done = tasks.filter(t => t.status === 'done').reduce((s, t) => s + (t.story_points || 0), 0)
  const inProgress = tasks.filter(t => t.status === 'in_progress').reduce((s, t) => s + (t.story_points || 0), 0)
  const blocked = tasks.filter(t => t.status === 'blocked').length
  return { total, done, inProgress, blocked, completion: total > 0 ? Math.round(done / total * 100) : 0 }
}

function SprintTaskRow({ task, onStatusChange, onClick }: { task: Task; onStatusChange: (id: number, status: TaskStatus) => void; onClick: () => void }) {
  const isOverdue = task.end_date && isPast(parseISO(task.end_date)) && task.status !== 'done'
  const StatusIcon = task.status === 'done' ? CheckCircle2 : task.status === 'in_progress' ? Zap : Circle

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition-colors group"
      onClick={onClick}
    >
      <button
        onClick={e => {
          e.stopPropagation()
          const next: Record<TaskStatus, TaskStatus> = { todo: 'in_progress', in_progress: 'review', review: 'done', done: 'todo', blocked: 'in_progress' }
          onStatusChange(task.id, next[task.status])
        }}
        className="flex-shrink-0"
      >
        <StatusIcon
          size={16}
          className={
            task.status === 'done' ? 'text-green-500' :
            task.status === 'in_progress' ? 'text-blue-500' :
            task.status === 'blocked' ? 'text-red-400' :
            'text-gray-300 group-hover:text-gray-400'
          }
        />
      </button>

      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
          {task.is_critical === 1 && <span className="text-red-500 mr-1.5 font-bold text-xs">CRIT</span>}
          {task.name}
        </div>
        {task.wbs_code && <span className="text-xs text-gray-400 mr-2">{task.wbs_code}</span>}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <PriorityBadge priority={task.priority} />

        {task.story_points != null && (
          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">{task.story_points}</span>
        )}

        {task.end_date && (
          <div className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            <Clock size={10} />
            {format(parseISO(task.end_date), 'MMM d')}
          </div>
        )}

        {task.assignee_name && <Avatar name={task.assignee_name} size="xs" />}

        <div className="w-12 hidden md:block">
          <Progress value={task.completion_percent} size="sm" />
        </div>
      </div>
    </div>
  )
}

export default function SprintBoard({ tasks, projectId, onTaskUpdate, onTaskClick, onAddTask }: SprintBoardProps) {
  const [activeView, setActiveView] = useState<'sprint' | 'backlog'>('sprint')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [sprintFilter, setSprintFilter] = useState<string>('all')

  const allSprints = useMemo(() => {
    const sprints = new Set(tasks.map(t => t.sprint).filter(Boolean) as string[])
    return Array.from(sprints).sort()
  }, [tasks])

  const sprintTasks = tasks.filter(t => t.sprint && t.sprint !== '' && !t.parent_id)
  const backlogTasks = tasks.filter(t => (!t.sprint || t.sprint === '') && !t.parent_id)

  const displayTasks = activeView === 'sprint' ? sprintTasks : backlogTasks
  const filteredTasks = sprintFilter === 'all' ? displayTasks : displayTasks.filter(t => t.sprint === sprintFilter)

  const tasksByStatus = STATUS_ORDER.map(status => ({
    status,
    tasks: filteredTasks.filter(t => t.status === status),
  }))
  const blockedTasks = filteredTasks.filter(t => t.status === 'blocked')

  const stats = getSprintStats(filteredTasks)

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      next.has(section) ? next.delete(section) : next.add(section)
      return next
    })
  }

  const STATUS_LABELS: Record<TaskStatus, string> = {
    todo: 'To Do',
    in_progress: 'In Progress',
    review: 'In Review',
    done: 'Done',
    blocked: 'Blocked',
  }

  return (
    <div className="space-y-4">
      {/* View toggle + sprint filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setActiveView('sprint')} className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${activeView === 'sprint' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <Zap size={14} /> Sprint
            </button>
            <button onClick={() => setActiveView('backlog')} className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${activeView === 'backlog' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <Target size={14} /> Backlog
            </button>
          </div>

          {activeView === 'sprint' && allSprints.length > 0 && (
            <select
              value={sprintFilter}
              onChange={e => setSprintFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sprints</option>
              {allSprints.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>

        <button
          onClick={() => onAddTask('todo')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} /> Add Task
        </button>
      </div>

      {/* Sprint stats */}
      {activeView === 'sprint' && stats.total > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-blue-600" />
              <span className="text-sm font-semibold text-gray-800">Sprint Progress</span>
            </div>
            <span className="text-2xl font-bold text-blue-700">{stats.completion}%</span>
          </div>
          <Progress value={stats.completion} size="md" color="blue" className="mb-3" />
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { label: 'Total', value: stats.total, sub: 'points', color: 'text-gray-700' },
              { label: 'Done', value: stats.done, sub: 'points', color: 'text-green-600' },
              { label: 'Active', value: stats.inProgress, sub: 'points', color: 'text-blue-600' },
              { label: 'Blocked', value: stats.blocked, sub: 'tasks', color: stats.blocked > 0 ? 'text-red-600' : 'text-gray-400' },
            ].map(kpi => (
              <div key={kpi.label}>
                <div className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</div>
                <div className="text-xs text-gray-500">{kpi.label}</div>
                <div className="text-xs text-gray-400">{kpi.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task list grouped by status */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Blocked tasks warning */}
        {blockedTasks.length > 0 && (
          <div className="bg-red-50 border-b border-red-100 px-4 py-2">
            <span className="text-xs font-semibold text-red-700">⚠ {blockedTasks.length} blocked task{blockedTasks.length > 1 ? 's' : ''} need attention</span>
          </div>
        )}

        {tasksByStatus.map(({ status, tasks: statusTasks }) => {
          const isCollapsed = collapsedSections.has(status)
          const labelColor = status === 'done' ? 'text-green-600' : status === 'in_progress' ? 'text-blue-600' : status === 'blocked' ? 'text-red-600' : 'text-gray-600'
          return (
            <div key={status}>
              <button
                onClick={() => toggleSection(status)}
                className="w-full flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors text-left"
              >
                {isCollapsed ? <ChevronRight size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                <span className={`text-xs font-semibold uppercase tracking-wider ${labelColor}`}>{STATUS_LABELS[status]}</span>
                <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5 font-medium">{statusTasks.length}</span>
                {status === 'done' && statusTasks.length > 0 && (
                  <TrendingUp size={12} className="text-green-500 ml-auto" />
                )}
              </button>
              {!isCollapsed && (
                <div>
                  {statusTasks.length === 0 ? (
                    <div className="px-4 py-4 text-xs text-gray-400 text-center border-b border-gray-50">
                      No {STATUS_LABELS[status].toLowerCase()} tasks
                    </div>
                  ) : (
                    statusTasks.map(task => (
                      <SprintTaskRow
                        key={task.id}
                        task={task}
                        onStatusChange={onTaskUpdate}
                        onClick={() => onTaskClick(task)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Backlog view with no sprint */}
        {activeView === 'backlog' && filteredTasks.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            No backlog items. Add tasks without a sprint to see them here.
          </div>
        )}
      </div>
    </div>
  )
}
