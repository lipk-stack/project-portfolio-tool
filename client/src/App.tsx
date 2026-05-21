import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Resources from './pages/Resources'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Timeline from './pages/Timeline'
import Timesheets from './pages/Timesheets'
import CalendarView from './pages/CalendarView'
import Admin from './pages/Admin'
import PrintReport from './pages/PrintReport'
import MyTasks from './pages/MyTasks'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/print/project/:id" element={<ProtectedRoute><PrintReport /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="projects/:id/:tab" element={<ProjectDetail />} />
          <Route path="timeline" element={<Timeline />} />
          <Route path="resources" element={<Resources />} />
          <Route path="timesheets" element={<Timesheets />} />
          <Route path="calendar" element={<CalendarView />} />
          <Route path="my-tasks" element={<MyTasks />} />
          <Route path="reports" element={<Reports />} />
          <Route path="admin" element={<Admin />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
