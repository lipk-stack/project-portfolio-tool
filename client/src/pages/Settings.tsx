import { useState } from 'react'
import { useAuthStore, useThemeStore } from '../store'
import Card from '../components/ui/Card'
import { User, Key, Bell, Database, Sun, Moon, Monitor, Keyboard, Info, Zap } from 'lucide-react'
import Avatar from '../components/ui/Avatar'

function Toggle({ defaultChecked }: { defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked ?? false)
  return (
    <button
      onClick={() => setChecked(c => !c)}
      className={`relative inline-flex items-center h-5 w-9 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
    >
      <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
    </button>
  )
}

export default function Settings() {
  const user = useAuthStore(s => s.user)
  const { darkMode, toggleDarkMode } = useThemeStore()
  const [saved, setSaved] = useState(false)
  const [activeSection, setActiveSection] = useState('profile')

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Sun },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'keyboard', label: 'Keyboard Shortcuts', icon: Keyboard },
    { id: 'about', label: 'About', icon: Info },
  ]

  return (
    <div className="max-w-5xl animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account and application preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                  activeSection === s.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <s.icon size={16} />
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5">
          {activeSection === 'profile' && (
            <Card>
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100 dark:border-gray-700">
                <User size={18} className="text-blue-600" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Profile Information</h2>
              </div>
              <div className="flex items-start gap-5">
                <div className="flex flex-col items-center gap-2">
                  {user && <Avatar name={user.name} size="lg" />}
                  <button className="text-xs text-blue-600 hover:text-blue-700">Change photo</button>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Full Name</label>
                    <input defaultValue={user?.name} className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Email</label>
                    <input defaultValue={user?.email} className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Department</label>
                    <input defaultValue={user?.department || ''} className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Role</label>
                    <input defaultValue={user?.role} disabled className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Weekly Capacity (hours)</label>
                    <input type="number" defaultValue={user?.capacity || 40} className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Hourly Rate ($)</label>
                    <input type="number" defaultValue={user?.hourly_rate || 0} className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700 mt-5 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Key size={14} /> Change Password</h3>
                <div className="grid grid-cols-3 gap-3">
                  <input type="password" placeholder="Current password" className="border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="password" placeholder="New password" className="border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="password" placeholder="Confirm password" className="border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                  {saved ? '✓ Saved!' : 'Save Changes'}
                </button>
              </div>
            </Card>
          )}

          {activeSection === 'appearance' && (
            <Card>
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100 dark:border-gray-700">
                <Sun size={18} className="text-blue-600" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Appearance</h2>
              </div>
              <div className="space-y-5">
                <div>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Theme</div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Light', icon: Sun, active: !darkMode, action: () => darkMode && toggleDarkMode() },
                      { label: 'Dark', icon: Moon, active: darkMode, action: () => !darkMode && toggleDarkMode() },
                      { label: 'System', icon: Monitor, active: false, action: () => {} },
                    ].map(t => (
                      <button
                        key={t.label}
                        onClick={t.action}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                          t.active ? 'border-blue-600 bg-blue-50 dark:bg-blue-950' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <t.icon size={20} className={t.active ? 'text-blue-600' : 'text-gray-400'} />
                        <span className={`text-sm font-medium ${t.active ? 'text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Sidebar</div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Compact sidebar</div>
                      <div className="text-xs text-gray-400">Show only icons in the sidebar</div>
                    </div>
                    <Toggle />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Density</div>
                  <div className="flex gap-2">
                    {['Comfortable', 'Compact', 'Dense'].map((d, i) => (
                      <button key={d} className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${i === 0 ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>{d}</button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeSection === 'notifications' && (
            <Card>
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100 dark:border-gray-700">
                <Bell size={18} className="text-blue-600" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Notification Preferences</h2>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Milestone approaching', sub: 'Alert 7 days before milestone due date', default: true },
                  { label: 'Budget threshold exceeded', sub: 'Alert when project exceeds 90% of budget', default: true },
                  { label: 'Task assigned to me', sub: 'Alert when a task is assigned to you', default: true },
                  { label: 'Project health changed', sub: 'Alert when health changes to Yellow or Red', default: false },
                  { label: 'New risk identified', sub: 'Alert when a new high-severity risk is added', default: true },
                  { label: 'Team member overallocated', sub: 'Alert when resource exceeds 100% allocation', default: false },
                  { label: 'Sprint completion', sub: 'Alert when sprint ends with remaining tasks', default: false },
                ].map((n, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{n.label}</div>
                      <div className="text-xs text-gray-400">{n.sub}</div>
                    </div>
                    <Toggle defaultChecked={n.default} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeSection === 'keyboard' && (
            <Card>
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100 dark:border-gray-700">
                <Keyboard size={18} className="text-blue-600" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Keyboard Shortcuts</h2>
              </div>
              <div className="space-y-2">
                {[
                  { action: 'Open Command Palette', keys: ['⌘', 'K'] },
                  { action: 'Go to Dashboard', keys: ['G', 'D'] },
                  { action: 'Go to Executive', keys: ['G', 'E'] },
                  { action: 'Go to Portfolio', keys: ['G', 'P'] },
                  { action: 'Go to Projects', keys: ['G', 'J'] },
                  { action: 'Go to My Tasks', keys: ['G', 'M'] },
                  { action: 'Go to Roadmap', keys: ['G', 'R'] },
                  { action: 'Go to Resources', keys: ['G', 'T'] },
                  { action: 'Go to Reports', keys: ['G', 'N'] },
                  { action: 'Go to Settings', keys: ['G', 'S'] },
                  { action: 'Close Modal', keys: ['Esc'] },
                  { action: 'Save / Submit', keys: ['⌘', 'Enter'] },
                ].map(item => (
                  <div key={item.action} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{item.action}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, i) => (
                        <kbd key={i} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 font-mono">{k}</kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeSection === 'about' && (
            <Card>
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100 dark:border-gray-700">
                <Zap size={18} className="text-blue-600" />
                <h2 className="font-semibold text-gray-900 dark:text-white">About ProjectPulse</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center">
                    <Zap size={28} className="text-white" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">ProjectPulse</div>
                    <div className="text-sm text-gray-500">Enterprise Portfolio Management</div>
                    <div className="text-xs text-blue-600 mt-0.5">Version 2.0.0</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Frontend', value: 'React 18 + TypeScript + Tailwind' },
                    { label: 'Backend', value: 'Node.js + Express + SQLite' },
                    { label: 'Runtime', value: 'Node.js 22' },
                    { label: 'Charts', value: 'Recharts' },
                    { label: 'Drag & Drop', value: '@dnd-kit' },
                    { label: 'Icons', value: 'Lucide React' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-400">{label}</div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4">
                  <div className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">Features</div>
                  <div className="text-xs text-blue-700 dark:text-blue-400 space-y-0.5">
                    {[
                      '✓ Portfolio & Project Management',
                      '✓ Interactive Gantt Chart with Dependencies',
                      '✓ Portfolio Roadmap Timeline',
                      '✓ Earned Value Management (EVM)',
                      '✓ Sprint Board & Backlog',
                      '✓ Burndown Charts',
                      '✓ Risk Heat Matrix',
                      '✓ Resource Allocation Matrix',
                      '✓ Workload Heatmap',
                      '✓ Global Command Palette (Cmd+K)',
                      '✓ Notification Center',
                      '✓ Task Comments & Time Tracking',
                      '✓ Dark Mode',
                      '✓ CSV Export',
                    ].map(f => <div key={f}>{f}</div>)}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
