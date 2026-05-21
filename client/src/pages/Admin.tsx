import { useEffect, useState } from 'react'
import api from '../api'
import { useAuthStore } from '../store'
import { Navigate } from 'react-router-dom'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import { UserPlus, Edit2, ToggleLeft, ToggleRight, Shield, Users, FolderOpen, AlertTriangle, TrendingUp, X, Check } from 'lucide-react'

interface AdminUser {
  id: number; name: string; email: string; role: string; department: string | null
  capacity: number; hourly_rate: number; created_at: string; active: number
  project_count: number; total_allocation: number
}

interface FormData {
  name: string; email: string; password: string; role: string
  department: string; capacity: number; hourly_rate: number
}

const EMPTY_FORM: FormData = { name: '', email: '', password: '', role: 'member', department: '', capacity: 40, hourly_rate: 0 }

interface StatsData {
  active_users: number; inactive_users: number; active_projects: number
  overdue_tasks: number; avg_completion: number
}

export default function Admin() {
  const user = useAuthStore(s => s.user)
  if (user?.role !== 'admin') return <Navigate to="/" replace />

  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    Promise.all([api.get('/admin/users'), api.get('/admin/stats')]).then(([ur, sr]) => {
      setUsers(ur.data.users)
      setStats(sr.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setShowForm(true); setError('') }
  const openEdit = (u: AdminUser) => {
    setForm({ name: u.name, email: u.email, password: '', role: u.role, department: u.department || '', capacity: u.capacity, hourly_rate: u.hourly_rate })
    setEditId(u.id)
    setShowForm(true)
    setError('')
  }
  const closeForm = () => { setShowForm(false); setEditId(null); setError('') }

  const handleSubmit = async () => {
    if (!form.name || !form.email) { setError('Name and email are required'); return }
    if (!editId && !form.password) { setError('Password is required for new users'); return }
    setSaving(true)
    try {
      if (editId) {
        const payload: Record<string, unknown> = { name: form.name, email: form.email, role: form.role, department: form.department, capacity: form.capacity, hourly_rate: form.hourly_rate }
        if (form.password) payload.password = form.password
        await api.put(`/admin/users/${editId}`, payload)
      } else {
        await api.post('/admin/users', form)
      }
      closeForm()
      load()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save user')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (u: AdminUser) => {
    await api.patch(`/admin/users/${u.id}/toggle-active`)
    load()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={22} className="text-blue-600" /> Admin Panel
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage users and system settings</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 transition-colors">
          <UserPlus size={15} /> Add User
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: Users, label: 'Active Users', value: stats.active_users, color: 'text-blue-600 bg-blue-50' },
            { icon: Users, label: 'Inactive', value: stats.inactive_users, color: 'text-gray-500 bg-gray-50' },
            { icon: FolderOpen, label: 'Active Projects', value: stats.active_projects, color: 'text-green-600 bg-green-50' },
            { icon: AlertTriangle, label: 'Overdue Tasks', value: stats.overdue_tasks, color: `${stats.overdue_tasks > 0 ? 'text-red-600 bg-red-50' : 'text-gray-500 bg-gray-50'}` },
            { icon: TrendingUp, label: 'Avg Completion', value: `${stats.avg_completion || 0}%`, color: 'text-purple-600 bg-purple-50' },
          ].map((s, i) => (
            <Card key={i}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${s.color}`}>
                <s.icon size={17} />
              </div>
              <div className="text-xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* User table */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Team Members</h2>
          <span className="text-sm text-gray-400">{users.length} users total</span>
        </div>
        <div className="overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Member', 'Role', 'Department', 'Allocation', 'Projects', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} size="sm" />
                      <div>
                        <div className="text-sm font-medium text-gray-800">{u.name}</div>
                        <div className="text-xs text-gray-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u.department || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${u.total_allocation > 100 ? 'bg-red-500' : u.total_allocation > 80 ? 'bg-green-500' : 'bg-blue-400'}`} style={{ width: `${Math.min(u.total_allocation, 100)}%` }} />
                      </div>
                      <span className={`text-xs font-medium ${u.total_allocation > 100 ? 'text-red-600' : 'text-gray-600'}`}>{u.total_allocation}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u.project_count}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors" title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => toggleActive(u)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-orange-600 transition-colors" title={u.active ? 'Deactivate' : 'Activate'}>
                        {u.active ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">{editId ? 'Edit User' : 'Add New User'}</h3>
              <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Full Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="Jane Smith" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input-field" placeholder="jane@example.com" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">{editId ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="input-field" placeholder={editId ? '••••••••' : 'Min 6 characters'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="input-field">
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
                <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className="input-field" placeholder="Engineering" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Weekly Capacity (hours)</label>
                <input type="number" min={1} max={80} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))} className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Hourly Rate ($)</label>
                <input type="number" min={0} value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: Number(e.target.value) }))} className="input-field" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeForm} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={14} />}
                {editId ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
