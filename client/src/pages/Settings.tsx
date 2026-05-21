import { useState } from 'react'
import { useAuthStore } from '../store'
import Card from '../components/ui/Card'
import { User, Shield, Bell, Database, Key, Download, Zap, Keyboard, CheckCircle, Command } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import api from '../api'

export default function Settings() {
  const user = useAuthStore(s => s.user)
  const [saved, setSaved] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleExport = async (type: string) => {
    setExporting(true)
    try {
      const res = await api.get(`/reports/${type}`)
      const data = res.data

      let csv = ''
      if (type === 'overview') {
        // Export budget performance
        const headers = 'Project,Budget,Spent,Completion%,Spend Rate%,Health\n'
        const rows = data.budgetPerformance.map((p: any) =>
          `"${p.name}",${p.budget},${p.spent},${p.completion_percent},${p.spend_rate},${p.health}`
        ).join('\n')
        csv = headers + rows
      }

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `portfolio-report-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const shortcuts = [
    { keys: ['⌘', 'K'], desc: 'Open global search / command palette' },
    { keys: ['Esc'], desc: 'Close modal or command palette' },
    { keys: ['↑', '↓'], desc: 'Navigate search results' },
    { keys: ['↵'], desc: 'Select highlighted result' },
    { keys: ['⌘', 'S'], desc: 'Save current form (where supported)' },
  ]

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account and application preferences</p>
      </div>

      {/* Profile */}
      <Card>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <User size={16} className="text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Profile</h2>
            <p className="text-xs text-gray-400">Your personal information</p>
          </div>
        </div>
        <div className="flex items-start gap-5">
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            {user && <Avatar name={user.name} size="lg" />}
            <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full capitalize">{user?.role}</span>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
              <input defaultValue={user?.name} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input defaultValue={user?.email} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
              <input defaultValue={user?.department || ''} placeholder="e.g. Engineering" className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
              <input defaultValue={user?.role} disabled className="input-field bg-gray-50 text-gray-400 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Weekly Capacity (hours)</label>
              <input type="number" defaultValue={user?.capacity || 40} min={1} max={80} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Hourly Rate ($)</label>
              <input type="number" defaultValue={user?.hourly_rate || 0} min={0} className="input-field" />
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={handleSave} className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {saved ? <><CheckCircle size={14} /> Saved!</> : 'Save Changes'}
          </button>
        </div>
      </Card>

      {/* Password */}
      <Card>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <Key size={16} className="text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Password</h2>
            <p className="text-xs text-gray-400">Change your account password</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 max-w-sm">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Current Password</label>
            <input type="password" className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">New Password</label>
            <input type="password" className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Confirm New Password</label>
            <input type="password" className="input-field" />
          </div>
        </div>
        <div className="mt-4">
          <button className="px-4 py-2 border border-gray-300 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">Update Password</button>
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <Bell size={16} className="text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Notifications</h2>
            <p className="text-xs text-gray-400">Control what alerts you receive</p>
          </div>
        </div>
        <div className="space-y-4">
          {[
            { label: 'Milestone approaching', sub: 'Alert 7 days before milestone due date', defaultOn: true },
            { label: 'Budget threshold exceeded', sub: 'Alert when project exceeds 90% of budget', defaultOn: true },
            { label: 'Task assigned to me', sub: 'Alert when a task is assigned to you', defaultOn: true },
            { label: 'Project health changed', sub: 'Alert when project health changes to Yellow or Red', defaultOn: false },
            { label: 'New risk identified', sub: 'Alert when a new high-severity risk is added', defaultOn: false },
            { label: 'Weekly summary email', sub: 'Receive a weekly portfolio digest', defaultOn: false },
          ].map((n, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div>
                <div className="text-sm font-medium text-gray-700">{n.label}</div>
                <div className="text-xs text-gray-400">{n.sub}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked={n.defaultOn} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
          ))}
        </div>
      </Card>

      {/* Keyboard shortcuts */}
      <Card>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
          <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
            <Keyboard size={16} className="text-purple-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Keyboard Shortcuts</h2>
            <p className="text-xs text-gray-400">Boost your productivity</p>
          </div>
        </div>
        <div className="space-y-3">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{s.desc}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, ki) => (
                  <kbd key={ki} className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-xs font-mono text-gray-700 shadow-sm">{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-blue-50 rounded-xl text-xs text-blue-700 flex items-start gap-2">
          <Command size={14} className="mt-0.5 flex-shrink-0" />
          <span>Press <strong>⌘K</strong> (Mac) or <strong>Ctrl+K</strong> (Windows/Linux) from anywhere in the app to open the command palette and quickly navigate to any project, task, or risk.</span>
        </div>
      </Card>

      {/* Data & Export */}
      <Card>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
          <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
            <Download size={16} className="text-green-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Data & Export</h2>
            <p className="text-xs text-gray-400">Export your portfolio data</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { label: 'Portfolio Report', sub: 'Budget performance, health status, completion rates', type: 'overview' },
            { label: 'Resource Utilization', sub: 'Team allocation and hours logged', type: 'resource-utilization' },
          ].map(exp => (
            <div key={exp.type} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <div className="text-sm font-medium text-gray-800">{exp.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{exp.sub}</div>
              </div>
              <button
                onClick={() => handleExport(exp.type)}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <Download size={13} />
                CSV
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* About */}
      <Card>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
          <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-gray-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">About ProjectPulse</h2>
            <p className="text-xs text-gray-400">Version info and tech stack</p>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5 border-b border-gray-50"><span className="text-gray-400">Version</span><span className="font-medium text-gray-700">2.0.0</span></div>
          <div className="flex justify-between py-1.5 border-b border-gray-50"><span className="text-gray-400">Database</span><span className="font-medium text-gray-700">SQLite with WAL</span></div>
          <div className="flex justify-between py-1.5 border-b border-gray-50"><span className="text-gray-400">Frontend</span><span className="font-medium text-gray-700">React 18 + TypeScript + Tailwind</span></div>
          <div className="flex justify-between py-1.5 border-b border-gray-50"><span className="text-gray-400">Backend</span><span className="font-medium text-gray-700">Node.js + Express + TypeScript</span></div>
          <div className="flex justify-between py-1.5"><span className="text-gray-400">Features</span><span className="font-medium text-gray-700">Gantt, Kanban, EVM, Timeline, AI Insights</span></div>
        </div>
        <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
          <p className="text-xs text-blue-700 font-medium">🏆 Enterprise-grade project portfolio management</p>
          <p className="text-xs text-blue-600 mt-1">Featuring Earned Value Management, Portfolio Timeline, AI Insights, Command Palette, Resource Management, Risk Matrix, and more — all in a single deployable package.</p>
        </div>
      </Card>
    </div>
  )
}
