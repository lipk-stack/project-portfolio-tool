import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useUIStore, useThemeStore } from '../../store'

export default function Layout() {
  const collapsed = useUIStore(s => s.sidebarCollapsed)
  const { darkMode } = useThemeStore()

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
        <Sidebar />
        <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-64'}`}>
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
