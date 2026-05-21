import { Search, LogOut, User, Command } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store'
import CommandPalette from '../ui/CommandPalette'
import NotificationCenter from '../ui/NotificationCenter'

export default function Header() {
  const user = useAuthStore(s => s.user)
  const clearAuth = useAuthStore(s => s.clearAuth)
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const initials = user?.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'

  // Global Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 z-20">
        {/* Search trigger */}
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <button
            onClick={() => setCmdOpen(true)}
            className="relative flex-1 flex items-center gap-3 pl-3 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-100 transition-colors cursor-pointer text-left"
          >
            <Search size={15} className="text-gray-400 flex-shrink-0" />
            <span className="text-gray-400 flex-1">Search projects, tasks, risks...</span>
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-400 shadow-sm flex-shrink-0">
              <Command size={10} />K
            </kbd>
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
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="text-sm font-semibold text-gray-800">{user?.name}</div>
                  <div className="text-xs text-gray-500">{user?.email}</div>
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full capitalize">{user?.role}</span>
                  </div>
                </div>
                <button
                  onClick={() => { navigate('/settings'); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <User size={15} /> Profile & Settings
                </button>
                <div className="border-t border-gray-100" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}
      </header>

      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  )
}
