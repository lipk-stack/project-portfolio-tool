import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', authenticate, (_req: Request, res: Response) => {
  const resources = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department, u.capacity, u.hourly_rate,
      COALESCE(SUM(CASE WHEN p.status = 'active' THEN pm.allocation_percent ELSE 0 END), 0) as total_allocation,
      COUNT(DISTINCT CASE WHEN p.status = 'active' THEN pm.project_id END) as active_projects
    FROM users u
    LEFT JOIN project_members pm ON pm.user_id = u.id
    LEFT JOIN projects p ON p.id = pm.project_id
    GROUP BY u.id
    ORDER BY total_allocation DESC, u.name ASC
  `).all()

  const projectAssignments = db.prepare(`
    SELECT pm.user_id, p.id as project_id, p.name as project_name, p.color, p.status,
           pm.role, pm.allocation_percent
    FROM project_members pm
    JOIN projects p ON p.id = pm.project_id
    WHERE p.status != 'cancelled'
  `).all() as Array<{ user_id: number; project_id: number; project_name: string; color: string; status: string; role: string; allocation_percent: number }>

  const assignmentMap: Record<number, typeof projectAssignments> = {}
  for (const a of projectAssignments) {
    if (!assignmentMap[a.user_id]) assignmentMap[a.user_id] = []
    assignmentMap[a.user_id].push(a)
  }

  const enriched = (resources as Array<Record<string, unknown>>).map(r => ({
    ...r,
    projects: assignmentMap[r.id as number] || [],
    utilization_percent: Math.min(Math.round(((r.total_allocation as number) / 100) * 100), 200),
  }))

  res.json({ resources: enriched })
})

router.get('/allocation-matrix', authenticate, (_req: Request, res: Response) => {
  const matrix = db.prepare(`
    SELECT u.id as user_id, u.name as user_name, u.department,
           p.id as project_id, p.name as project_name, p.color,
           pm.allocation_percent, pm.role
    FROM users u
    CROSS JOIN projects p
    LEFT JOIN project_members pm ON pm.user_id = u.id AND pm.project_id = p.id
    WHERE p.status = 'active'
    ORDER BY u.name, p.name
  `).all()

  const users = db.prepare("SELECT id, name, department, capacity FROM users WHERE role != 'admin' ORDER BY name").all()
  const projects = db.prepare("SELECT id, name, color FROM projects WHERE status = 'active' ORDER BY name").all()

  res.json({ matrix, users, projects })
})

router.get('/utilization', authenticate, (_req: Request, res: Response) => {
  const utilization = db.prepare(`
    SELECT u.id, u.name, u.department, u.capacity,
      strftime('%Y-%W', te.date) as week,
      SUM(te.hours) as logged_hours
    FROM users u
    LEFT JOIN time_entries te ON te.user_id = u.id AND te.date >= date('now', '-90 days')
    GROUP BY u.id, week
    ORDER BY u.name, week
  `).all()
  res.json({ utilization })
})

router.get('/capacity-forecast', authenticate, (req: Request, res: Response) => {
  const numWeeks = Math.min(Math.max(parseInt(String(req.query.weeks || '12'), 10) || 12, 4), 26)

  // Build week buckets starting from this week's Monday
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const monday = new Date(today)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const weeks: string[] = []
  for (let i = 0; i < numWeeks; i++) {
    const w = new Date(monday)
    w.setDate(w.getDate() + i * 7)
    weeks.push(w.toISOString().slice(0, 10))
  }
  const horizonEnd = new Date(monday)
  horizonEnd.setDate(horizonEnd.getDate() + numWeeks * 7)

  const users = db.prepare(`
    SELECT id, name, department, capacity FROM users WHERE role != 'admin' ORDER BY name
  `).all() as Array<{ id: number; name: string; department: string; capacity: number }>

  const tasks = db.prepare(`
    SELECT t.assignee_id, t.start_date, t.end_date, t.estimated_hours, t.completion_percent
    FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.status != 'done' AND t.assignee_id IS NOT NULL
      AND t.end_date IS NOT NULL AND p.status = 'active'
  `).all() as Array<{ assignee_id: number; start_date: string | null; end_date: string; estimated_hours: number; completion_percent: number }>

  // hours[userId][weekStart] = forecast hours
  const hours: Record<number, Record<string, number>> = {}
  const weekKey = (d: Date) => {
    const m = new Date(d)
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
    return m.toISOString().slice(0, 10)
  }

  for (const t of tasks) {
    const remaining = Math.max(0, (t.estimated_hours || 0) * (1 - (t.completion_percent || 0) / 100))
    if (remaining === 0) continue

    let rangeStart = t.start_date ? new Date(t.start_date) : new Date(today)
    if (rangeStart < today) rangeStart = new Date(today)
    let rangeEnd = new Date(t.end_date)
    if (rangeEnd < rangeStart) {
      // Overdue: assume work is re-planned across the next 4 weeks
      rangeEnd = new Date(rangeStart)
      rangeEnd.setDate(rangeEnd.getDate() + 27)
    }

    // Count weekdays in range, spread remaining hours evenly across them
    const weekdays: Date[] = []
    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6) weekdays.push(new Date(d))
    }
    if (weekdays.length === 0) weekdays.push(new Date(rangeStart))
    const perDay = remaining / weekdays.length

    if (!hours[t.assignee_id]) hours[t.assignee_id] = {}
    for (const d of weekdays) {
      if (d >= horizonEnd) break
      const wk = weekKey(d)
      hours[t.assignee_id][wk] = (hours[t.assignee_id][wk] || 0) + perDay
    }
  }

  const forecast = users.map(u => ({
    ...u,
    weekly: weeks.map(w => {
      const h = Math.round((hours[u.id]?.[w] || 0) * 10) / 10
      return { week: w, hours: h, pct: u.capacity > 0 ? Math.round((h / u.capacity) * 100) : 0 }
    }),
  }))

  res.json({ weeks, forecast })
})

router.get('/users', authenticate, (_req: Request, res: Response) => {
  const users = db.prepare('SELECT id, name, email, role, department, capacity, hourly_rate FROM users ORDER BY name').all()
  res.json({ users })
})

router.get('/users/:id', authenticate, (req: Request, res: Response) => {
  const user = db.prepare('SELECT id, name, email, role, department, capacity, hourly_rate FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'User not found' })

  const projects = db.prepare(`
    SELECT p.id, p.name, p.status, p.health, p.color, pm.role, pm.allocation_percent
    FROM project_members pm JOIN projects p ON p.id = pm.project_id
    WHERE pm.user_id = ? ORDER BY p.status
  `).all(req.params.id)

  const recentTime = db.prepare(`
    SELECT te.*, t.name as task_name, p.name as project_name
    FROM time_entries te
    LEFT JOIN tasks t ON t.id = te.task_id
    JOIN projects p ON p.id = te.project_id
    WHERE te.user_id = ? ORDER BY te.date DESC LIMIT 20
  `).all(req.params.id)

  res.json({ user, projects, recentTime })
})

export default router
