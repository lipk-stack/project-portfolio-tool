import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Task } from '../../types'
import { resourcesApi, tasksApi } from '../../api'
import { X, GitBranch } from 'lucide-react'

interface TaskFormProps {
  task?: Partial<Task>
  projectId?: number
  onSubmit: (data: Partial<Task>) => void
  onCancel: () => void
  loading?: boolean
  defaultStatus?: string
}

export default function TaskForm({ task, projectId, onSubmit, onCancel, loading, defaultStatus }: TaskFormProps) {
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([])
  const [allTasks, setAllTasks] = useState<Array<{ id: number; name: string; status: string }>>([])
  const [deps, setDeps] = useState<number[]>((task as any)?.dependencies || [])
  const { register, handleSubmit, formState: { errors } } = useForm<Partial<Task>>({
    defaultValues: task || {
      status: (defaultStatus as Task['status']) || 'todo',
      priority: 'medium',
      estimated_hours: 0,
      completion_percent: 0,
    }
  })

  useEffect(() => {
    resourcesApi.users().then(r => setUsers(r.data.users)).catch(() => {})
    if (projectId) {
      tasksApi.list(projectId).then(r => {
        setAllTasks((r.data.tasks as any[]).filter((t: any) => t.id !== task?.id))
      }).catch(() => {})
    }
  }, [projectId])

  const addDep = (id: number) => { if (!deps.includes(id)) setDeps(prev => [...prev, id]) }
  const removeDep = (id: number) => setDeps(prev => prev.filter(d => d !== id))

  const handleFormSubmit = (data: Partial<Task>) => {
    onSubmit({ ...data, dependencies: deps } as any)
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Task Name *</label>
        <input {...register('name', { required: 'Name required' })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="What needs to be done?" />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea {...register('description')} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Task details..." />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select {...register('status')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">In Review</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select {...register('priority')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
        <select {...register('assignee_id')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Unassigned</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input type="date" {...register('start_date')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
          <input type="date" {...register('end_date')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Est. Hours</label>
          <input type="number" step="0.5" {...register('estimated_hours')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Story Points</label>
          <input type="number" {...register('story_points')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">% Complete</label>
          <input type="number" min="0" max="100" {...register('completion_percent')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">WBS Code</label>
          <input {...register('wbs_code')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 1.2.3" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sprint</label>
          <input {...register('sprint' as any)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Sprint 1" />
        </div>
      </div>

      {allTasks.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
            <GitBranch size={13} /> Depends On (predecessor tasks)
          </label>
          <select onChange={e => { if (e.target.value) addDep(parseInt(e.target.value)) }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2" value="">
            <option value="">Add dependency…</option>
            {allTasks.filter(t => !deps.includes(t.id)).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {deps.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {deps.map(id => {
                const t = allTasks.find(t => t.id === id)
                return t ? (
                  <span key={id} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg">
                    {t.name}
                    <button type="button" onClick={() => removeDep(id)} className="text-blue-400 hover:text-blue-700"><X size={11} /></button>
                  </span>
                ) : null
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
          {loading ? 'Saving...' : task?.id ? 'Update Task' : 'Create Task'}
        </button>
      </div>
    </form>
  )
}
