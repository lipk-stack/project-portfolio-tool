import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Briefcase, FolderOpen, Users,
  BarChart3, Settings, ChevronLeft, ChevronRight,
  Zap, CalendarRange, Clock, CalendarDays, Shield, CheckSquare, Target
} from 'lucide-react'
import { useUIStore, useAuthStore } from '../../store'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/my-tasks', label: 'My Tasks', icon: CheckSquare },
  { to: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { to: '/projects', label: 'Projects', icon: FolderOpen },
  { to: '/timeline', label: 'Timeline', icon: CalendarRange },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/goals', label: 'Goals & OKRs', icon: Target },
  { to: '/resources', label: 'Resources', icon: Users },
  { to: '/timesheets', label: 'Timesheets', icon: Clock },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
]

export default function Sidebar() {
  const collapsed = useUIStore(s => s.sidebarCollapsed)
  const toggle = useUIStore(s => s.toggleSidebar)
  const location = useLocation()
  const user = useAuthStore(s => s.user)

  return (
    <aside className={`fixed top-0 left-0 h-full z-30 bg-gray-900 text-white transition-all duration-300 flex flex-col ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo */}
      <div className={`flex items-center h-16 px-4 border-b border-gray-700/50 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="flex items-center justify-center w-8 h-8 bg-blue-500 rounded-lg flex-shrink-0 shadow-sm">
          <Zap size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <div className="font-bold text-sm leading-tight">ProjectPulse</div>
            <div className="text-xs text-gray-400">Portfolio Manager</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
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
              <item.icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {collapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50 shadow-lg">
                  {item.label}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-gray-700/50 p-2 space-y-0.5">
        {user?.role === 'admin' && (
          <NavLink
            to="/admin"
            title={collapsed ? 'Admin' : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              location.pathname === '/admin' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Shield size={18} className="flex-shrink-0" />
            {!collapsed && <span>Admin</span>}
            {collapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50 shadow-lg">Admin</span>
            )}
          </NavLink>
        )}
        <NavLink
          to="/settings"
          title={collapsed ? 'Settings' : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
            location.pathname === '/settings' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <Settings size={18} className="flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all duration-150"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : (
            <>
              <ChevronLeft size={18} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
