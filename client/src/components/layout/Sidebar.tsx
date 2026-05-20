import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Briefcase, FolderOpen, Users,
  BarChart3, Settings, ChevronLeft, ChevronRight,
  GitBranch, Zap, Moon, Sun, FileText, Clock, Layout
} from 'lucide-react'
import { useUIStore } from '../../store'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { to: '/projects', label: 'Projects', icon: FolderOpen },
  { to: '/templates', label: 'Templates', icon: Layout },
  { to: '/sprints', label: 'Sprints', icon: GitBranch },
  { to: '/timesheets', label: 'Timesheets', icon: Clock },
  { to: '/resources', label: 'Resources', icon: Users },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/change-requests', label: 'Changes', icon: FileText },
]

export default function Sidebar() {
  const collapsed = useUIStore(s => s.sidebarCollapsed)
  const toggle = useUIStore(s => s.toggleSidebar)
  const theme = useUIStore(s => s.theme)
  const setTheme = useUIStore(s => s.setTheme)
  const location = useLocation()

  return (
    <aside className={`fixed top-0 left-0 h-full z-30 bg-gray-900 text-white transition-all duration-300 flex flex-col ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo */}
      <div className={`flex items-center h-16 px-4 border-b border-gray-700/50 flex-shrink-0 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex-shrink-0 shadow-lg">
          <Zap size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <div className="font-bold text-sm leading-tight tracking-tight">ProjectPulse</div>
            <div className="text-xs text-gray-400">Enterprise PM</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 pb-1 pt-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Menu</span>
          </div>
        )}
        {navItems.map(item => {
          const isActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <item.icon size={17} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {collapsed && (
                <span className="absolute left-full ml-2 px-2.5 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none shadow-lg z-50">
                  {item.label}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-gray-700/50 p-2 space-y-0.5 flex-shrink-0">
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          title={collapsed ? (theme === 'light' ? 'Dark Mode' : 'Light Mode') : undefined}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all duration-150"
        >
          {theme === 'light' ? <Moon size={17} className="flex-shrink-0" /> : <Sun size={17} className="flex-shrink-0" />}
          {!collapsed && <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
        </button>
        <NavLink
          to="/settings"
          title={collapsed ? 'Settings' : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
            location.pathname === '/settings' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <Settings size={17} className="flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all duration-150"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={17} /> : (
            <>
              <ChevronLeft size={17} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
