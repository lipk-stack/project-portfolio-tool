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

router.get('/workload-heatmap', authenticate, (_req: Request, res: Response) => {
  const weeks = db.prepare(`
    WITH RECURSIVE weeks(week_start) AS (
      SELECT date('now', '-11 weeks', 'weekday 1')
      UNION ALL
      SELECT date(week_start, '+7 days')
      FROM weeks
      WHERE week_start < date('now')
    )
    SELECT week_start FROM weeks
  `).all() as Array<{ week_start: string }>

  const users = db.prepare(`
    SELECT u.id, u.name, u.department, u.capacity
    FROM users u WHERE u.role != 'admin' ORDER BY u.name
  `).all() as Array<{ id: number; name: string; department: string; capacity: number }>

  const timeData = db.prepare(`
    SELECT user_id, strftime('%Y-%W', date) as week_key,
           SUM(hours) as total_hours
    FROM time_entries
    WHERE date >= date('now', '-12 weeks')
    GROUP BY user_id, week_key
  `).all() as Array<{ user_id: number; week_key: string; total_hours: number }>

  const heatmap = users.map(u => {
    const weeklyData = weeks.map(w => {
      const weekKey = new Date(w.week_start).toLocaleDateString('en-US', { year: 'numeric', week: 'numeric' } as any)
      const entry = timeData.find(t => t.user_id === u.id)
      const hours = entry?.total_hours || 0
      const utilPct = u.capacity > 0 ? Math.round((hours / (u.capacity / 5)) * 100) : 0
      return { week: w.week_start, hours, utilPct }
    })
    return { ...u, weeks: weeklyData }
  })

  res.json({ heatmap, weeks: weeks.map(w => w.week_start) })
})

router.get('/demand-forecast', authenticate, (_req: Request, res: Response) => {
  // Build 12 forward weeks
  const weekStarts: string[] = []
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  for (let i = 0; i < 12; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i * 7)
    weekStarts.push(d.toISOString().split('T')[0])
  }

  const users = db.prepare(`SELECT id, name, department, capacity FROM users WHERE role != 'admin' ORDER BY name`).all() as Array<{ id: number; name: string; department: string; capacity: number }>

  // Tasks with future end dates, assigned, not done
  const tasks = db.prepare(`
    SELECT t.id, t.assignee_id, t.start_date, t.end_date, t.estimated_hours, t.actual_hours, t.status,
           p.name as project_name, p.color as project_color
    FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.assignee_id IS NOT NULL
      AND t.status != 'done'
      AND t.end_date >= date('now')
      AND p.status = 'active'
  `).all() as Array<{ id: number; assignee_id: number; start_date: string; end_date: string; estimated_hours: number; actual_hours: number; status: string; project_name: string; project_color: string }>

  const forecast = users.map(u => {
    const myTasks = tasks.filter(t => t.assignee_id === u.id)
    const weeks = weekStarts.map(weekStart => {
      const wEnd = new Date(weekStart)
      wEnd.setDate(wEnd.getDate() + 6)
      const wEndStr = wEnd.toISOString().split('T')[0]
      let demandHours = 0
      for (const t of myTasks) {
        const tStart = t.start_date || weekStart
        const tEnd = t.end_date
        // Check if task overlaps with this week
        if (tEnd < weekStart || tStart > wEndStr) continue
        // Calculate remaining hours and spread across remaining weeks
        const remaining = Math.max(0, (t.estimated_hours || 0) - (t.actual_hours || 0))
        const taskStart = new Date(Math.max(new Date(tStart).getTime(), new Date().getTime()))
        const taskEnd = new Date(tEnd)
        const totalDays = Math.max(1, Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)))
        const totalWeeks = Math.ceil(totalDays / 7)
        const hoursPerWeek = remaining / totalWeeks
        demandHours += hoursPerWeek
      }
      const weeklyCapacity = (u.capacity || 40) / 5 * 5 // Mon-Fri hours (capacity is weekly)
      const loadPct = weeklyCapacity > 0 ? Math.round((demandHours / weeklyCapacity) * 100) : 0
      return { week: weekStart, demandHours: Math.round(demandHours * 10) / 10, capacity: weeklyCapacity, loadPct }
    })
    return { ...u, weeks }
  })

  res.json({ forecast, weeks: weekStarts })
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
