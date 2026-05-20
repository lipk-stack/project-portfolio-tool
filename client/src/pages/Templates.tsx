import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { templatesApi, portfoliosApi } from '../api'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { Plus, Play, Trash2, Clock, CheckSquare, Flag, Search } from 'lucide-react'
import { format, addDays } from 'date-fns'

interface Template {
  id: number
  name: string
  description?: string
  category: string
  icon: string
  tasks: Array<{ name: string; priority: string; estimated_hours: number; wbs_code?: string }>
  milestones: Array<{ name: string; offset_days: number }>
  duration_days: number
  is_builtin: number
  created_at: string
}

interface Portfolio { id: number; name: string }

const CATEGORY_COLORS: Record<string, string> = {
  technology: 'bg-blue-100 text-blue-700',
  marketing: 'bg-pink-100 text-pink-700',
  product: 'bg-purple-100 text-purple-700',
  data: 'bg-green-100 text-green-700',
  operations: 'bg-orange-100 text-orange-700',
  general: 'bg-gray-100 text-gray-700',
  custom: 'bg-indigo-100 text-indigo-700',
}

const PROJECT_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#F97316']

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selected, setSelected] = useState<Template | null>(null)
  const [showApply, setShowApply] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyForm, setApplyForm] = useState({
    name: '', description: '', portfolio_id: '', start_date: format(new Date(), 'yyyy-MM-dd'),
    budget: '', priority: 'medium', color: '#3B82F6',
  })
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    Promise.all([templatesApi.list(), portfoliosApi.list()]).then(([tRes, pRes]) => {
      setTemplates(tRes.data.templates)
      setPortfolios(pRes.data.portfolios)
    }).finally(() => setLoading(false))
  }, [])

  const categories = Array.from(new Set(templates.map(t => t.category))).sort()

  const filtered = templates.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase())
    const matchCat = !categoryFilter || t.category === categoryFilter
    return matchSearch && matchCat
  })

  const handleApply = async () => {
    if (!applyForm.name || !selected) return
    setApplying(true)
    try {
      const res = await templatesApi.apply(selected.id, {
        name: applyForm.name,
        description: applyForm.description || undefined,
        portfolio_id: applyForm.portfolio_id ? Number(applyForm.portfolio_id) : undefined,
        start_date: applyForm.start_date,
        budget: applyForm.budget ? Number(applyForm.budget) : 0,
        priority: applyForm.priority,
        color: applyForm.color,
      })
      toast.success(`Project "${applyForm.name}" created with ${selected.tasks.length} tasks!`)
      setShowApply(false)
      navigate(`/projects/${res.data.projectId}`)
    } catch { toast.error('Failed to create project') }
    finally { setApplying(false) }
  }

  const handleDelete = async (t: Template) => {
    if (!confirm(`Delete template "${t.name}"?`)) return
    await templatesApi.delete(t.id)
    setTemplates(prev => prev.filter(x => x.id !== t.id))
    toast.success('Template deleted')
  }

  const estimatedHours = (t: Template) => t.tasks.reduce((s, tk) => s + (tk.estimated_hours || 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Start a new project using a pre-built template · {templates.length} available</p>
        </div>
        <button onClick={() => navigate('/projects')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Blank Project
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setCategoryFilter('')} className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${!categoryFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat === categoryFilter ? '' : cat)} className={`px-3 py-1.5 text-xs rounded-full font-medium capitalize transition-colors ${categoryFilter === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{cat}</button>
          ))}
        </div>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(t => (
          <Card key={t.id} className="relative group cursor-pointer hover:shadow-md hover:border-blue-200 transition-all" onClick={() => { setSelected(t); }}>
            {/* Built-in badge */}
            {t.is_builtin ? (
              <span className="absolute top-3 right-3 text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">Built-in</span>
            ) : (
              <button onClick={e => { e.stopPropagation(); handleDelete(t) }} className="absolute top-3 right-3 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={14} />
              </button>
            )}

            <div className="text-3xl mb-3">{t.icon}</div>
            <h3 className="font-semibold text-gray-900 mb-1">{t.name}</h3>
            {t.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{t.description}</p>}

            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize mb-3 ${CATEGORY_COLORS[t.category] || 'bg-gray-100 text-gray-600'}`}>{t.category}</span>

            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              {[
                { icon: CheckSquare, value: t.tasks.length, label: 'Tasks' },
                { icon: Flag, value: t.milestones.length, label: 'Milestones' },
                { icon: Clock, value: `${t.duration_days}d`, label: 'Duration' },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="bg-gray-50 rounded-lg py-2">
                  <div className="font-bold text-gray-900 text-sm">{value}</div>
                  <div className="text-xs text-gray-400">{label}</div>
                </div>
              ))}
            </div>

            <div className="text-xs text-gray-400 mb-3">{estimatedHours(t)}h estimated work</div>

            <button
              onClick={e => { e.stopPropagation(); setSelected(t); setApplyForm(f => ({ ...f, name: `${t.name} Project` })); setShowApply(true) }}
              className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Play size={14} /> Use Template
            </button>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-gray-400">
            <p>No templates found matching your search.</p>
          </div>
        )}
      </div>

      {/* Template preview panel (when selected but not applying) */}
      {selected && !showApply && (
        <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={`${selected.icon} ${selected.name}`} size="lg">
          <div className="space-y-5">
            {selected.description && <p className="text-sm text-gray-600">{selected.description}</p>}

            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { value: selected.tasks.length, label: 'Tasks', icon: CheckSquare },
                { value: selected.milestones.length, label: 'Milestones', icon: Flag },
                { value: `${selected.duration_days} days`, label: 'Duration', icon: Clock },
              ].map(({ value, label, icon: Icon }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xl font-bold text-gray-900">{value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Task Breakdown</h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {selected.tasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-400 w-8">{task.wbs_code || `${i + 1}`}</span>
                    <span className="flex-1 text-gray-700">{task.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${task.priority === 'critical' ? 'bg-red-100 text-red-700' : task.priority === 'high' ? 'bg-orange-100 text-orange-700' : task.priority === 'medium' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{task.priority}</span>
                    <span className="text-xs text-gray-400 w-12 text-right">{task.estimated_hours}h</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Milestones</h4>
              <div className="space-y-1">
                {selected.milestones.map((ms, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Flag size={12} className="text-blue-500" />
                      <span className="text-gray-700">{ms.name}</span>
                    </div>
                    <span className="text-xs text-gray-400">Day {ms.offset_days}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setSelected(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Close</button>
              <button
                onClick={() => { setApplyForm(f => ({ ...f, name: `${selected.name} Project` })); setShowApply(true) }}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Play size={14} /> Use This Template
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Apply template modal */}
      <Modal isOpen={showApply} onClose={() => { setShowApply(false); setSelected(null) }} title={`Create project from "${selected?.name}"`} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Project Name *</label>
            <input value={applyForm.name} onChange={e => setApplyForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="My Project" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <textarea rows={2} value={applyForm.description} onChange={e => setApplyForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
              <input type="date" value={applyForm.start_date} onChange={e => setApplyForm(f => ({ ...f, start_date: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Portfolio</label>
              <select value={applyForm.portfolio_id} onChange={e => setApplyForm(f => ({ ...f, portfolio_id: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">No portfolio</option>
                {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Budget ($)</label>
              <input type="number" value={applyForm.budget} onChange={e => setApplyForm(f => ({ ...f, budget: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
              <select value={applyForm.priority} onChange={e => setApplyForm(f => ({ ...f, priority: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['critical', 'high', 'medium', 'low'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Project Color</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map(c => (
                <button key={c} onClick={() => setApplyForm(f => ({ ...f, color: c }))} className={`w-7 h-7 rounded-full border-2 transition-all ${applyForm.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {selected && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
              <div>Will create <strong>{selected.tasks.length} tasks</strong> and <strong>{selected.milestones.length} milestones</strong></div>
              <div>Estimated duration: <strong>{selected.duration_days} days</strong> (ends ~{format(addDays(new Date(applyForm.start_date || new Date()), selected.duration_days), 'MMM d, yyyy')})</div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={() => { setShowApply(false); setSelected(null) }} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleApply} disabled={applying || !applyForm.name} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {applying ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Play size={14} />}
              Create Project
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
