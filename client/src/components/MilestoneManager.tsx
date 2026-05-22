import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Plus, Edit2, Trash2, Flag, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { projectsApi } from '../api'
import { Milestone } from '../types'

interface MilestoneManagerProps {
  projectId: number
  milestones: Milestone[]
  onUpdate: () => void
}

const STATUS_CONFIG = {
  upcoming: { label: 'Upcoming', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200' },
  achieved: { label: 'Achieved', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 border-green-200' },
  missed: { label: 'Missed', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
}

interface MilestoneForm {
  name: string
  date: string
  status: 'upcoming' | 'achieved' | 'missed'
  description: string
}

const EMPTY_FORM: MilestoneForm = { name: '', date: '', status: 'upcoming', description: '' }

export default function MilestoneManager({ projectId, milestones, onUpdate }: MilestoneManagerProps) {
  const [showForm, setShowForm] = useState(false)
  const [editMilestone, setEditMilestone] = useState<Milestone | null>(null)
  const [form, setForm] = useState<MilestoneForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleEdit = (m: Milestone) => {
    setEditMilestone(m)
    setForm({ name: m.name, date: m.date.split('T')[0], status: m.status, description: m.description || '' })
    setShowForm(true)
  }

  const handleNew = () => {
    setEditMilestone(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.date) return
    setSaving(true)
    try {
      if (editMilestone) {
        await projectsApi.updateMilestone(projectId, editMilestone.id, form)
      } else {
        await projectsApi.createMilestone(projectId, form)
      }
      setShowForm(false)
      setForm(EMPTY_FORM)
      setEditMilestone(null)
      onUpdate()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (m: Milestone) => {
    if (!confirm(`Delete milestone "${m.name}"?`)) return
    setDeletingId(m.id)
    try {
      await projectsApi.deleteMilestone(projectId, m.id)
      onUpdate()
    } finally {
      setDeletingId(null)
    }
  }

  const sorted = [...milestones].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700">Milestones</h4>
        <button
          onClick={handleNew}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          <Plus size={14} /> Add Milestone
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., MVP Launch"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Target Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as MilestoneForm['status'] }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="achieved">Achieved</option>
                  <option value="missed">Missed</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional notes..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => { setShowForm(false); setEditMilestone(null) }}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.date}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {saving ? 'Saving…' : editMilestone ? 'Update' : 'Add Milestone'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Milestones list */}
      {sorted.length === 0 && !showForm ? (
        <div className="text-center py-6 text-gray-400 text-sm">
          <Flag size={24} className="mx-auto mb-2 opacity-50" />
          No milestones yet
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(m => {
            const cfg = STATUS_CONFIG[m.status]
            const StatusIcon = cfg.icon
            return (
              <div key={m.id} className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.bg} group`}>
                <StatusIcon size={16} className={`${cfg.color} flex-shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">{m.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {format(parseISO(m.date), 'MMMM d, yyyy')}
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium capitalize ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  {m.description && <div className="text-xs text-gray-400 mt-1">{m.description}</div>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(m)} className="p-1 rounded hover:bg-white/50 text-gray-500 hover:text-blue-600 transition-colors">
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(m)}
                    disabled={deletingId === m.id}
                    className="p-1 rounded hover:bg-white/50 text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
