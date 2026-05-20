import { Search, LogOut, User, Command } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, useUIStore } from '../../store'
import NotificationCenter from '../ui/NotificationCenter'

export default function Header() {
  const user = useAuthStore(s => s.user)
  const clearAuth = useAuthStore(s => s.clearAuth)
  const toggleCommandPalette = useUIStore(s => s.toggleCommandPalette)
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const initials = user?.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 z-20">
      {/* Search trigger */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          onClick={toggleCommandPalette}
          className="flex items-center gap-3 w-full pl-3 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-white transition-colors text-gray-400 group"
        >
          <Search size={15} />
          <span className="flex-1 text-left">Search projects, tasks...</span>
          <div className="flex items-center gap-0.5 text-xs bg-white border border-gray-200 rounded px-1.5 py-0.5 hidden sm:flex">
            <Command size={10} />
            <span>K</span>
          </div>
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <NotificationCenter />

        <div className="w-px h-6 bg-gray-200 mx-1" />

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {initials}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-sm font-medium text-gray-700 leading-tight">{user?.name}</div>
              <div className="text-xs text-gray-400 capitalize">{user?.role}</div>
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-sm font-medium text-gray-700">{user?.name}</div>
                <div className="text-xs text-gray-500">{user?.email}</div>
                <div className="text-xs text-gray-400 capitalize mt-0.5">{user?.department} · {user?.role}</div>
              </div>
              <button
                onClick={() => { navigate('/settings'); setMenuOpen(false) }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <User size={14} /> Profile & Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors rounded-b-xl"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}
    </header>
  )
}
