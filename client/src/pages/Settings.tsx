import { useState, useRef } from 'react'
import { useAuthStore, useUIStore } from '../store'
import Card from '../components/ui/Card'
import { User, Bell, Database, Key, Moon, Sun, Monitor, Keyboard, CheckCircle, AlertCircle } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import { authApi } from '../api'
import { useToast } from '../components/ui/Toast'

export default function Settings() {
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const theme = useUIStore(s => s.theme)
  const setTheme = useUIStore(s => s.setTheme)
  const toast = useToast()

  const nameRef = useRef<HTMLInputElement>(null)
  const deptRef = useRef<HTMLInputElement>(null)
  const capacityRef = useRef<HTMLInputElement>(null)
  const rateRef = useRef<HTMLInputElement>(null)

  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdError, setPwdError] = useState('')

  const handleSaveProfile = async () => {
    const name = nameRef.current?.value?.trim()
    if (!name) { setProfileError('Name is required'); return }
    setSavingProfile(true)
    setProfileError('')
    try {
      const res = await authApi.updateProfile({
        name,
        department: deptRef.current?.value || '',
        capacity: parseInt(capacityRef.current?.value || '40'),
        hourly_rate: parseFloat(rateRef.current?.value || '0'),
      })
      setUser(res.data.user)
      toast.success('Profile updated successfully')
    } catch (e: any) {
      setProfileError(e.response?.data?.error || 'Failed to save')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) { setPwdError('All fields required'); return }
    if (newPwd !== confirmPwd) { setPwdError('New passwords do not match'); return }
    if (newPwd.length < 6) { setPwdError('Password must be at least 6 characters'); return }
    setSavingPwd(true)
    setPwdError('')
    try {
      await authApi.updatePassword({ current_password: currentPwd, new_password: newPwd })
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
      toast.success('Password updated successfully')
    } catch (e: any) {
      setPwdError(e.response?.data?.error || 'Failed to update password')
    } finally {
      setSavingPwd(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account and application preferences</p>
      </div>

      {/* Profile */}
      <Card>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
          <User size={18} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">Profile</h2>
        </div>
        <div className="flex items-start gap-5">
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            {user && <Avatar name={user.name} size="lg" />}
            <div className="text-xs text-gray-400 capitalize">{user?.role}</div>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Full Name *</label>
              <input ref={nameRef} defaultValue={user?.name} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input defaultValue={user?.email} disabled className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
              <input ref={deptRef} defaultValue={user?.department || ''} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
              <input defaultValue={user?.role} disabled className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed capitalize" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Weekly Capacity (hours)</label>
              <input ref={capacityRef} type="number" min={1} max={80} defaultValue={user?.capacity || 40} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Hourly Rate ($)</label>
              <input ref={rateRef} type="number" min={0} defaultValue={user?.hourly_rate || 0} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>
        {profileError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle size={14} /> {profileError}
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <button onClick={handleSaveProfile} disabled={savingProfile} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center gap-2">
            {savingProfile ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle size={14} />}
            Save Profile
          </button>
        </div>
      </Card>

      {/* Password */}
      <Card>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
          <Key size={18} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">Change Password</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 max-w-sm">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Current Password</label>
            <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">New Password</label>
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Confirm New Password</label>
            <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        {pwdError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 max-w-sm">
            <AlertCircle size={14} /> {pwdError}
          </div>
        )}
        <div className="mt-4">
          <button onClick={handleUpdatePassword} disabled={savingPwd} className="px-4 py-2 border border-gray-300 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60 flex items-center gap-2">
            {savingPwd ? <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Key size={14} />}
            Update Password
          </button>
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
          <Bell size={18} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">Notification Preferences</h2>
        </div>
        <div className="space-y-4">
          {[
            { label: 'Milestone approaching', sub: 'Alert 7 days before milestone due date', def: true },
            { label: 'Budget threshold exceeded', sub: 'Alert when project exceeds 90% of budget', def: true },
            { label: 'Task assigned to me', sub: 'Alert when a task is assigned to you', def: true },
            { label: 'Project health changed', sub: 'Alert when project health changes to Yellow or Red', def: false },
            { label: 'New risk identified', sub: 'Alert when a new high-severity risk is added', def: false },
            { label: 'Overdue tasks', sub: 'Daily reminder of tasks past their due date', def: true },
          ].map((n, i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-700">{n.label}</div>
                <div className="text-xs text-gray-400">{n.sub}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked={n.def} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
          ))}
        </div>
      </Card>

      {/* Appearance */}
      <Card>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
          <Monitor size={18} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">Appearance</h2>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-700 mb-3">Theme</div>
          <div className="flex gap-3">
            {[
              { value: 'light', label: 'Light', icon: <Sun size={18} /> },
              { value: 'dark', label: 'Dark', icon: <Moon size={18} /> },
            ].map(t => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value as 'light' | 'dark')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors min-w-[100px] ${theme === t.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}
              >
                {t.icon}
                <span className="text-sm font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
          <Keyboard size={18} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">Keyboard Shortcuts</h2>
        </div>
        <div className="space-y-3">
          {[
            { keys: ['⌘', 'K'], label: 'Open command palette / quick search' },
            { keys: ['Esc'], label: 'Close modal or palette' },
            { keys: ['↑', '↓'], label: 'Navigate search results' },
            { keys: ['⏎'], label: 'Select highlighted result' },
            { keys: ['Ctrl', 'Enter'], label: 'Submit comment in task detail' },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between py-1">
              <span className="text-sm text-gray-600">{s.label}</span>
              <div className="flex items-center gap-1">
                {s.keys.map(k => <kbd key={k} className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">{k}</kbd>)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* About */}
      <Card>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
          <Database size={18} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">About ProjectPulse</h2>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-gray-400">Version</span><span className="font-medium">3.0.0</span></div>
          <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-gray-400">Database</span><span className="font-medium">SQLite (WAL mode)</span></div>
          <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-gray-400">Frontend</span><span className="font-medium">React 18 + TypeScript + Vite</span></div>
          <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-gray-400">Backend</span><span className="font-medium">Express + Node.js</span></div>
          <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-gray-400">Capabilities</span><span className="font-medium text-right">EVM · Gantt · Kanban · Sprints</span></div>
          <div className="flex justify-between py-1"><span className="text-gray-400">Additional</span><span className="font-medium text-right">Baselines · Comments · Forecast</span></div>
        </div>
      </Card>
    </div>
  )
}
