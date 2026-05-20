import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, useUIStore } from './store'
import { useEffect } from 'react'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Resources from './pages/Resources'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Sprints from './pages/Sprints'
import ChangeRequests from './pages/ChangeRequests'
import Timesheets from './pages/Timesheets'
import Templates from './pages/Templates'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function ThemeInitializer() {
  const theme = useUIStore(s => s.theme)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeInitializer />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="projects/:id/:tab" element={<ProjectDetail />} />
          <Route path="sprints" element={<Sprints />} />
          <Route path="timesheets" element={<Timesheets />} />
          <Route path="templates" element={<Templates />} />
          <Route path="resources" element={<Resources />} />
          <Route path="reports" element={<Reports />} />
          <Route path="change-requests" element={<ChangeRequests />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
