import { useEffect, useState } from 'react'
import { Plus, Target, Edit, Trash2, TrendingUp, ChevronUp, X, Save } from 'lucide-react'
import api from '../api'
import { format, parseISO } from 'date-fns'
import Avatar from '../components/ui/Avatar'
import Modal from '../components/ui/Modal'

interface Goal {
  id: number
  title: string
  description: string | null
  owner_name: string | null
  project_name: string | null
  project_id: number | null
  owner_id: number
  target_value: number
  current_value: number
  unit: string
  due_date: string | null
  status: string
  category: string
  progress_pct: number
  created_at: string
  updated_at: string
}

interface GoalFormData {
  title: string; description: string; target_value: number; current_value: number
  unit: string; due_date: string; category: string; status: string
}

const CATEGORIES = ['strategic', 'operational', 'financial', 'customer', 'team', 'product']
const CATEGORY_COLORS: Record<string, string> = {
  strategic: 'bg-purple-100 text-purple-700',
  operational: 'bg-blue-100 text-blue-700',
  financial: 'bg-green-100 text-green-700',
  customer: 'bg-orange-100 text-orange-700',
  team: 'bg-pink-100 text-pink-700',
  product: 'bg-cyan-100 text-cyan-700',
}

function GoalForm({ initial, onSubmit, onCancel, loading }: {
  initial?: Partial<GoalFormData>
  onSubmit: (data: GoalFormData) => void
  onCancel: () => void
  loading: boolean
}) {
  const [form, setForm] = useState<GoalFormData>({
    title: initial?.title || '', description: initial?.description || '',
    target_value: initial?.target_value ?? 100, current_value: initial?.current_value ?? 0,
    unit: initial?.unit || '%', due_date: initial?.due_date || '', category: initial?.category || 'strategic',
    status: initial?.status || 'active',
  })
  const set = (k: keyof GoalFormData, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Goal Title *</label>
        <input value={form.title} onChange={e => set('title', e.target.value)} className="input-field" placeholder="e.g. Increase customer satisfaction to 90%" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="input-field resize-none" placeholder="Why does this goal matter?" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Current Value</label>
          <input type="number" value={form.current_value} onChange={e => set('current_value', parseFloat(e.target.value) || 0)} className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Target Value</label>
          <input type="number" value={form.target_value} onChange={e => set('target_value', parseFloat(e.target.value) || 100)} className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
          <input value={form.unit} onChange={e => set('unit', e.target.value)} className="input-field" placeholder="%, $K, NPS..." />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)} className="input-field">
            {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className="input-field">
            <option value="active">Active</option>
            <option value="achieved">Achieved</option>
            <option value="missed">Missed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
          <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="input-field" />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={() => onSubmit(form)} disabled={!form.title || loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={14} />}
          Save Goal
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  )
}

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editGoal, setEditGoal] = useState<Goal | null>(null)
  const [saving, setSaving] = useState(false)
  const [updateGoal, setUpdateGoal] = useState<Goal | null>(null)
  const [updateValue, setUpdateValue] = useState('')
  const [updateNote, setUpdateNote] = useState('')
  const [updatingProgress, setUpdatingProgress] = useState(false)
  const [filterCategory, setFilterCategory] = useState('')

  const load = () => {
    api.get('/goals').then(r => setGoals(r.data.goals)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleSave = async (data: GoalFormData) => {
    setSaving(true)
    try {
      if (editGoal?.id) await api.put(`/goals/${editGoal.id}`, data)
      else await api.post('/goals', data)
      setShowForm(false); setEditGoal(null)
      load()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this goal?')) return
    await api.delete(`/goals/${id}`)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  const handleUpdateProgress = async () => {
    if (!updateGoal || !updateValue) return
    setUpdatingProgress(true)
    try {
      await api.post(`/goals/${updateGoal.id}/updates`, { value: parseFloat(updateValue), note: updateNote })
      setUpdateGoal(null); setUpdateValue(''); setUpdateNote('')
      load()
    } finally { setUpdatingProgress(false) }
  }

  const filtered = filterCategory ? goals.filter(g => g.category === filterCategory) : goals
  const achieved = goals.filter(g => g.status === 'achieved').length
  const active = goals.filter(g => g.status === 'active').length
  const avgProgress = active > 0 ? Math.round(goals.filter(g => g.status === 'active').reduce((s, g) => s + (g.progress_pct || 0), 0) / active) : 0

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target size={24} className="text-blue-600" /> Goals & OKRs
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track organizational objectives and key results</p>
        </div>
        <button onClick={() => { setEditGoal(null); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus size={14} /> New Goal
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Goals', value: goals.length, color: 'text-gray-900' },
          { label: 'Active', value: active, color: 'text-blue-600' },
          { label: 'Achieved', value: achieved, color: 'text-green-600' },
          { label: 'Avg Progress', value: `${avgProgress}%`, color: avgProgress >= 70 ? 'text-green-600' : avgProgress >= 40 ? 'text-yellow-600' : 'text-red-600' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <button onClick={() => setFilterCategory('')} className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${!filterCategory ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          All
        </button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setFilterCategory(c === filterCategory ? '' : c)}
            className={`px-3 py-1.5 text-sm rounded-lg border capitalize transition-colors ${filterCategory === c ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Goals list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Target size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No goals yet</p>
          <p className="text-sm mt-1">Create your first goal to start tracking progress</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map(goal => {
            const pct = Math.min(100, goal.progress_pct || 0)
            const isAchieved = goal.status === 'achieved'
            const isOverdue = goal.due_date && parseISO(goal.due_date) < new Date() && goal.status === 'active'
            return (
              <div key={goal.id} className={`bg-white rounded-xl border p-5 group transition-shadow hover:shadow-md ${isAchieved ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${CATEGORY_COLORS[goal.category] || 'bg-gray-100 text-gray-600'}`}>{goal.category}</span>
                      {isAchieved && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Achieved ✓</span>}
                      {isOverdue && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Overdue</span>}
                      {goal.project_name && <span className="text-xs text-gray-400">← {goal.project_name}</span>}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-base">{goal.title}</h3>
                    {goal.description && <p className="text-sm text-gray-500 mt-1">{goal.description}</p>}
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{goal.current_value}{goal.unit} of {goal.target_value}{goal.unit}</span>
                          <span className="font-semibold">{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all ${isAchieved ? 'bg-green-500' : pct >= 70 ? 'bg-blue-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      {goal.owner_name && (
                        <div className="flex items-center gap-1.5">
                          <Avatar name={goal.owner_name} size="xs" />
                          <span>{goal.owner_name}</span>
                        </div>
                      )}
                      {goal.due_date && <span>Due {format(parseISO(goal.due_date), 'MMM d, yyyy')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => { setUpdateGoal(goal); setUpdateValue(String(goal.current_value)); setUpdateNote('') }}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                      title="Update progress"
                    >
                      <ChevronUp size={12} /> Update
                    </button>
                    <button onClick={() => { setEditGoal(goal); setShowForm(true) }} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"><Edit size={14} /></button>
                    <button onClick={() => handleDelete(goal.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditGoal(null) }} title={editGoal ? 'Edit Goal' : 'New Goal'} size="md">
        <GoalForm
          initial={editGoal ? { title: editGoal.title, description: editGoal.description || '', target_value: editGoal.target_value, current_value: editGoal.current_value, unit: editGoal.unit, due_date: editGoal.due_date || '', category: editGoal.category, status: editGoal.status } : undefined}
          onSubmit={handleSave}
          onCancel={() => { setShowForm(false); setEditGoal(null) }}
          loading={saving}
        />
      </Modal>

      <Modal isOpen={!!updateGoal} onClose={() => setUpdateGoal(null)} title="Update Progress" size="sm">
        {updateGoal && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-blue-800 font-medium">{updateGoal.title}</div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                New Value ({updateGoal.unit}) — target: {updateGoal.target_value}{updateGoal.unit}
              </label>
              <input type="number" value={updateValue} onChange={e => setUpdateValue(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Update Note</label>
              <input value={updateNote} onChange={e => setUpdateNote(e.target.value)} className="input-field" placeholder="What changed?" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleUpdateProgress} disabled={updatingProgress || !updateValue} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {updatingProgress ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <TrendingUp size={14} />}
                Update Progress
              </button>
              <button onClick={() => setUpdateGoal(null)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
