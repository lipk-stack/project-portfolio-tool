import { useState, useEffect } from 'react'
import { Clock, Plus, Trash2, Timer } from 'lucide-react'
import { timeApi } from '../../api'
import { TimeEntry, Task } from '../../types'
import { format, parseISO } from 'date-fns'

interface Props {
  projectId: number
  tasks: Task[]
}

export default function TimeTracker({ projectId, tasks }: Props) {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [summary, setSummary] = useState<Array<{ id: number; name: string; department?: string; total_hours: number; total_cost: number }>>([])
  const [weekly, setWeekly] = useState<Array<{ week: string; hours: number }>>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ task_id: '', hours: '', date: new Date().toISOString().split('T')[0], description: '' })

  const load = async () => {
    try {
      const res = await timeApi.getProject(projectId)
      setEntries(res.data.entries || [])
      setSummary(res.data.summary || [])
      setWeekly(res.data.weekly || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [projectId])

  const totalHours = entries.reduce((s, e) => s + e.hours, 0)
  const totalCost = summary.reduce((s, u) => s + u.total_cost, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.hours || parseFloat(form.hours) <= 0) return
    setSubmitting(true)
    try {
      await timeApi.logForProject(projectId, {
        task_id: form.task_id ? parseInt(form.task_id) : undefined,
        hours: parseFloat(form.hours),
        date: form.date,
        description: form.description || undefined,
      })
      setForm({ task_id: '', hours: '', date: new Date().toISOString().split('T')[0], description: '' })
      setShowForm(false)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    await timeApi.delete(id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="text-xs text-blue-600 font-medium mb-1">Total Hours</div>
          <div className="text-2xl font-bold text-blue-700">{totalHours.toFixed(1)}h</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <div className="text-xs text-purple-600 font-medium mb-1">Labor Cost</div>
          <div className="text-2xl font-bold text-purple-700">${Math.round(totalCost).toLocaleString()}</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <div className="text-xs text-green-600 font-medium mb-1">Contributors</div>
          <div className="text-2xl font-bold text-green-700">{summary.length}</div>
        </div>
      </div>

      {/* By person */}
      {summary.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-800">Hours by Team Member</h4>
          </div>
          <div className="divide-y divide-gray-50">
            {summary.map(u => (
              <div key={u.id} className="flex items-center gap-4 px-4 py-2.5">
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-700">{u.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{u.department}</span>
                </div>
                <span className="text-sm text-gray-600">{u.total_hours.toFixed(1)}h</span>
                <span className="text-sm text-gray-500">${Math.round(u.total_cost).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log time form */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Clock size={14} className="text-gray-400" />
          Time Log ({entries.length} entries)
        </h4>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={12} /> Log Time
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-blue-50 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Task (optional)</label>
              <select
                value={form.task_id}
                onChange={e => setForm(f => ({ ...f, task_id: e.target.value }))}
                className="w-full text-sm px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">General / No task</option>
                {tasks.filter(t => !t.parent_id).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Hours</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                value={form.hours}
                onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                placeholder="e.g. 2.5"
                required
                className="w-full text-sm px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                required
                className="w-full text-sm px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What did you work on?"
                className="w-full text-sm px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={submitting} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Timer size={14} /> {submitting ? 'Saving...' : 'Log Time'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Entries list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-auto max-h-72">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2">Date</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2">Person</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2">Task</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-2">Hours</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.slice(0, 30).map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{format(parseISO(e.date), 'MMM d, yyyy')}</td>
                  <td className="px-4 py-2 text-xs font-medium text-gray-700">{e.user_name}</td>
                  <td className="px-4 py-2 text-xs text-gray-500 truncate max-w-[160px]">{e.task_name || 'General'}</td>
                  <td className="px-4 py-2 text-xs font-semibold text-gray-700 text-right">{e.hours}h</td>
                  <td className="px-4 py-2">
                    <button onClick={() => handleDelete(e.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No time entries logged</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
