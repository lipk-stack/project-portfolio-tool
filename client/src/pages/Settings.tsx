import { useState } from 'react'
import { useAuthStore } from '../store'
import Card from '../components/ui/Card'
import { User, Shield, Bell, Palette, Database, Key } from 'lucide-react'
import Avatar from '../components/ui/Avatar'

export default function Settings() {
  const user = useAuthStore(s => s.user)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
          <div className="flex flex-col items-center gap-2">
            {user && <Avatar name={user.name} size="lg" />}
            <button className="text-xs text-blue-600 hover:text-blue-700">Change</button>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
              <input defaultValue={user?.name} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input defaultValue={user?.email} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
              <input defaultValue={user?.department || ''} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
              <input defaultValue={user?.role} disabled className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Weekly Capacity (hours)</label>
              <input type="number" defaultValue={user?.capacity || 40} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Hourly Rate ($)</label>
              <input type="number" defaultValue={user?.hourly_rate || 0} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
            {saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>
      </Card>

      {/* Security */}
      <Card>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
          <Key size={18} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">Password</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 max-w-sm">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Current Password</label>
            <input type="password" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">New Password</label>
            <input type="password" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Confirm New Password</label>
            <input type="password" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="mt-4">
          <button className="px-4 py-2 border border-gray-300 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">Update Password</button>
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
          <Bell size={18} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">Notifications</h2>
        </div>
        <div className="space-y-4">
          {[
            { label: 'Milestone approaching', sub: 'Alert 7 days before milestone due date' },
            { label: 'Budget threshold exceeded', sub: 'Alert when project exceeds 90% of budget' },
            { label: 'Task assigned to me', sub: 'Alert when a task is assigned to you' },
            { label: 'Project health changed', sub: 'Alert when project health changes to Yellow or Red' },
            { label: 'New risk identified', sub: 'Alert when a new high-severity risk is added' },
          ].map((n, i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-700">{n.label}</div>
                <div className="text-xs text-gray-400">{n.sub}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked={i < 3} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
          ))}
        </div>
      </Card>

      {/* About */}
      <Card>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
          <Database size={18} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">About</h2>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between"><span className="text-gray-400">Version</span><span className="font-medium">1.0.0</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Database</span><span className="font-medium">SQLite (local)</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Build</span><span className="font-medium">React 18 + Node.js 22</span></div>
        </div>
      </Card>
    </div>
  )
}
