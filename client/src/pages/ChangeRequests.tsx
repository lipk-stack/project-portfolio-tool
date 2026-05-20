import { useEffect, useState } from 'react'
import { FileText, Plus, CheckCircle, XCircle, Clock, AlertTriangle, DollarSign, Calendar } from 'lucide-react'
import { changeRequestsApi, projectsApi } from '../api'
import { ChangeRequest, Project } from '../types'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import { format, parseISO } from 'date-fns'
import { useToast } from '../components/ui/Toast'

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: <Clock size={12} /> },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: <CheckCircle size={12} /> },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: <XCircle size={12} /> },
  deferred: { label: 'Deferred', color: 'bg-gray-100 text-gray-700', icon: <Clock size={12} /> },
}

const TYPE_COLORS: Record<string, string> = {
  scope: 'bg-blue-50 text-blue-700 border-blue-200',
  schedule: 'bg-purple-50 text-purple-700 border-purple-200',
  budget: 'bg-orange-50 text-orange-700 border-orange-200',
  resource: 'bg-teal-50 text-teal-700 border-teal-200',
  other: 'bg-gray-50 text-gray-700 border-gray-200',
}

const PRIORITY_COLORS = {
  critical: 'text-red-600',
  high: 'text-orange-500',
  medium: 'text-blue-500',
  low: 'text-gray-400',
}

function formatCurrency(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n}`
}

export default function ChangeRequests() {
  const [crs, setCrs] = useState<(ChangeRequest & { project_name?: string; project_color?: string })[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [form, setForm] = useState({
    project_id: '', title: '', description: '', type: 'scope', priority: 'medium',
    impact_schedule: '', impact_budget: '', impact_scope: '',
  })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = async () => {
    const projRes = await projectsApi.list()
    const ps = projRes.data.projects as Project[]
    setProjects(ps)
    const results = await Promise.all(ps.map(p =>
      changeRequestsApi.list(p.id).then(r => r.data.change_requests.map((cr: ChangeRequest) => ({
        ...cr, project_name: p.name, project_color: p.color,
      })))
    ))
    setCrs(results.flat())
  }

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!form.project_id || !form.title) return
    setSaving(true)
    try {
      const res = await changeRequestsApi.create(Number(form.project_id), {
        title: form.title, description: form.description, type: form.type, priority: form.priority,
        impact_schedule: Number(form.impact_schedule) || 0,
        impact_budget: Number(form.impact_budget) || 0,
        impact_scope: form.impact_scope,
      })
      const project = projects.find(p => p.id === Number(form.project_id))
      setCrs(prev => [{ ...res.data.change_request, project_name: project?.name, project_color: project?.color }, ...prev])
      setShowForm(false)
      setForm({ project_id: '', title: '', description: '', type: 'scope', priority: 'medium', impact_schedule: '', impact_budget: '', impact_scope: '' })
      toast.success('Change request created')
    } catch {
      toast.error('Failed to create change request')
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (id: number, status: string, cr: ChangeRequest) => {
    try {
      await changeRequestsApi.update(id, { ...cr, status, decision_date: new Date().toISOString().split('T')[0] })
      setCrs(prev => prev.map(c => c.id === id ? { ...c, status: status as any } : c))
      toast.success(`CR ${status}`)
    } catch {
      toast.error('Failed to update CR')
    }
  }

  const filtered = crs.filter(cr => filter === 'all' || cr.status === filter)
  const stats = {
    pending: crs.filter(c => c.status === 'pending').length,
    approved: crs.filter(c => c.status === 'approved').length,
    totalBudgetImpact: crs.filter(c => c.status === 'approved').reduce((s, c) => s + (c.impact_budget || 0), 0),
    totalScheduleImpact: crs.filter(c => c.status === 'approved').reduce((s, c) => s + (c.impact_schedule || 0), 0),
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Change Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and manage project change requests across all projects</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> New Change Request
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending Review', value: stats.pending, icon: Clock, color: 'text-yellow-600 bg-yellow-500' },
          { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-green-600 bg-green-500' },
          { label: 'Budget Impact', value: formatCurrency(stats.totalBudgetImpact), icon: DollarSign, color: 'text-orange-600 bg-orange-500' },
          { label: 'Schedule Impact', value: `${stats.totalScheduleImpact}d`, icon: Calendar, color: 'text-purple-600 bg-purple-500' },
        ].map(s => (
          <Card key={s.label} className="relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-16 h-16 rounded-full opacity-10 -translate-y-1/2 translate-x-1/2 ${s.color.split(' ')[1]}`} />
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.color.split(' ')[1]} bg-opacity-10`}>
              <s.icon size={18} className={s.color.split(' ')[0]} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-sm rounded-lg font-medium capitalize transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {f} {f !== 'all' && `(${crs.filter(c => c.status === f).length})`}
          </button>
        ))}
      </div>

      {/* CR List */}
      <div className="space-y-3">
        {filtered.map(cr => {
          const statusCfg = STATUS_CONFIG[cr.status]
          return (
            <Card key={cr.id} padding="none">
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded border capitalize font-medium ${TYPE_COLORS[cr.type] || TYPE_COLORS.other}`}>
                        {cr.type}
                      </span>
                      <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                        {statusCfg.icon}
                        {statusCfg.label}
                      </div>
                      <span className={`text-xs font-semibold capitalize ${PRIORITY_COLORS[cr.priority] || 'text-gray-400'}`}>
                        {cr.priority} priority
                      </span>
                      {cr.project_color && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cr.project_color }} />
                          <span className="text-xs text-gray-500">{cr.project_name}</span>
                        </div>
                      )}
                    </div>
                    <div className="font-semibold text-gray-900 mb-1">{cr.title}</div>
                    {cr.description && <div className="text-sm text-gray-500">{cr.description}</div>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      {cr.impact_budget > 0 && (
                        <span className="flex items-center gap-1">
                          <DollarSign size={10} /> Budget: +{formatCurrency(cr.impact_budget)}
                        </span>
                      )}
                      {cr.impact_schedule > 0 && (
                        <span className="flex items-center gap-1">
                          <Calendar size={10} /> Schedule: +{cr.impact_schedule}d
                        </span>
                      )}
                      {cr.requested_by_name && <span>By {cr.requested_by_name}</span>}
                      <span>{format(parseISO(cr.requested_date), 'MMM d, yyyy')}</span>
                    </div>
                    {cr.impact_scope && (
                      <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">{cr.impact_scope}</div>
                    )}
                  </div>
                  {cr.status === 'pending' && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => updateStatus(cr.id, 'approved', cr)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle size={12} /> Approve
                      </button>
                      <button
                        onClick={() => updateStatus(cr.id, 'rejected', cr)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <XCircle size={12} /> Reject
                      </button>
                    </div>
                  )}
                </div>
                {cr.status !== 'pending' && cr.approved_by_name && (
                  <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400">
                    Decision by {cr.approved_by_name} {cr.decision_date && `on ${format(parseISO(cr.decision_date), 'MMM d, yyyy')}`}
                  </div>
                )}
              </div>
            </Card>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p>No change requests found.</p>
          </div>
        )}
      </div>

      {/* Create CR Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Change Request" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
            <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Describe the change request..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} placeholder="Provide details about this change..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['scope', 'schedule', 'budget', 'resource', 'other'].map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget Impact ($)</label>
              <input type="number" value={form.impact_budget} onChange={e => setForm(f => ({ ...f, impact_budget: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Impact (days)</label>
              <input type="number" value={form.impact_schedule} onChange={e => setForm(f => ({ ...f, impact_schedule: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope Impact</label>
            <input type="text" value={form.impact_scope} onChange={e => setForm(f => ({ ...f, impact_scope: e.target.value }))}
              placeholder="Describe scope changes..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Submitting...' : 'Submit CR'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
