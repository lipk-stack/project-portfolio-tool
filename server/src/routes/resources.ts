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

router.get('/users', authenticate, (_req: Request, res: Response) => {
  const users = db.prepare('SELECT id, name, email, role, department, capacity, hourly_rate FROM users ORDER BY name').all()
  res.json({ users })
})

router.get('/forecast', authenticate, (req: Request, res: Response) => {
  const weeks = parseInt(req.query.weeks as string) || 8

  // Get all future tasks with assignees and dates
  const futureTasks = db.prepare(`
    SELECT t.id, t.assignee_id, t.name, t.start_date, t.end_date,
      t.estimated_hours, t.actual_hours, t.completion_percent, t.status,
      p.name as project_name, p.color as project_color
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.assignee_id IS NOT NULL
      AND t.status NOT IN ('done')
      AND t.end_date >= date('now')
      AND t.end_date <= date('now', '+${weeks} weeks')
    ORDER BY t.assignee_id, t.start_date
  `.replace('${weeks}', String(weeks))).all() as Array<{
    id: number; assignee_id: number; name: string; start_date?: string; end_date?: string
    estimated_hours: number; actual_hours: number; completion_percent: number; status: string
    project_name: string; project_color: string
  }>

  const users = db.prepare('SELECT id, name, department, capacity FROM users WHERE role != \'admin\' ORDER BY name').all() as Array<{ id: number; name: string; department: string; capacity: number }>

  // Build week buckets
  const now = new Date()
  const weekBuckets: string[] = []
  for (let i = 0; i < weeks; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i * 7 - d.getDay() + 1) // Monday
    weekBuckets.push(d.toISOString().split('T')[0])
  }

  // Calculate projected hours per user per week
  function getWeekMonday(dateStr: string): string {
    const d = new Date(dateStr)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    return d.toISOString().split('T')[0]
  }

  const forecast: Record<number, Record<string, number>> = {}
  for (const user of users) forecast[user.id] = {}

  for (const task of futureTasks) {
    if (!task.start_date || !task.end_date) continue
    const start = new Date(Math.max(new Date(task.start_date).getTime(), now.getTime()))
    const end = new Date(task.end_date)
    if (start >= end) continue

    const remainingHours = task.estimated_hours * (1 - task.completion_percent / 100)
    if (remainingHours <= 0) continue

    // Distribute hours across weeks
    const totalMs = end.getTime() - start.getTime()
    let cur = new Date(start)
    while (cur <= end) {
      const weekStart = getWeekMonday(cur.toISOString().split('T')[0])
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const overlapStart = Math.max(cur.getTime(), start.getTime())
      const overlapEnd = Math.min(weekEnd.getTime(), end.getTime())
      const weekMs = Math.max(0, overlapEnd - overlapStart)
      const weekHours = (weekMs / totalMs) * remainingHours

      if (weekHours > 0 && weekBuckets.includes(weekStart)) {
        if (!forecast[task.assignee_id]) forecast[task.assignee_id] = {}
        forecast[task.assignee_id][weekStart] = (forecast[task.assignee_id][weekStart] || 0) + weekHours
      }

      cur.setDate(cur.getDate() + 7)
    }
  }

  const result = users.map(u => ({
    ...u,
    weeks: weekBuckets.map(w => ({
      week: w,
      projected_hours: Math.round((forecast[u.id]?.[w] || 0) * 10) / 10,
    })),
    tasks: futureTasks.filter(t => t.assignee_id === u.id),
  }))

  res.json({ forecast: result, weekBuckets })
})

router.get('/calendar', authenticate, (req: Request, res: Response) => {
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7)
  const [year, mon] = month.split('-').map(Number)
  const start = `${month}-01`
  const lastDay = new Date(year, mon, 0).getDate()
  const end = `${month}-${String(lastDay).padStart(2, '0')}`

  const users = db.prepare("SELECT id, name, department, capacity FROM users ORDER BY name").all()

  const assignments = db.prepare(`
    SELECT te.user_id, te.date, te.project_id, p.name as project_name, p.color as project_color,
           SUM(te.hours) as hours
    FROM time_entries te
    JOIN projects p ON p.id = te.project_id
    WHERE te.date >= ? AND te.date <= ?
    GROUP BY te.user_id, te.date, te.project_id
    ORDER BY te.date, te.user_id
  `).all(start, end)

  res.json({ users, assignments })
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
