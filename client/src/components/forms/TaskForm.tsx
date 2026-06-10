import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Task, CustomField } from '../../types'
import { resourcesApi, customFieldsApi } from '../../api'
import CommentsPanel from '../CommentsPanel'

interface TaskFormProps {
  task?: Partial<Task>
  projectId?: number
  onSubmit: (data: Partial<Task> & { custom_values?: Record<number, string> }) => void
  onCancel: () => void
  loading?: boolean
  defaultStatus?: string
}

export default function TaskForm({ task, projectId, onSubmit, onCancel, loading, defaultStatus }: TaskFormProps) {
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [customValues, setCustomValues] = useState<Record<number, string>>({})
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
  }, [])

  useEffect(() => {
    if (!projectId) return
    customFieldsApi.list(projectId).then(r => setCustomFields(r.data.fields)).catch(() => {})
    if (task?.id) {
      customFieldsApi.taskValues(task.id).then(r => setCustomValues(r.data.values || {})).catch(() => {})
    }
  }, [projectId, task?.id])

  const submit = (data: Partial<Task>) => {
    onSubmit(customFields.length > 0 ? { ...data, custom_values: customValues } : data)
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">WBS Code</label>
        <input {...register('wbs_code')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 1.2.3" />
      </div>

      {customFields.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Custom Fields</div>
          <div className="grid grid-cols-2 gap-4">
            {customFields.map(f => (
              <div key={f.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.name}</label>
                {f.field_type === 'select' ? (
                  <select
                    value={customValues[f.id] || ''}
                    onChange={e => setCustomValues(v => ({ ...v, [f.id]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">—</option>
                    {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                    value={customValues[f.id] || ''}
                    onChange={e => setCustomValues(v => ({ ...v, [f.id]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
          {loading ? 'Saving...' : task?.id ? 'Update Task' : 'Create Task'}
        </button>
      </div>

      {task?.id && (
        <div className="border-t border-gray-100 pt-4">
          <CommentsPanel entityType="task" entityId={task.id} />
        </div>
      )}
    </form>
  )
}
