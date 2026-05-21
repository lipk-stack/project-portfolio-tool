import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/my', authenticate, (req: Request, res: Response) => {
  const { week } = req.query
  let weekStart: string
  let weekEnd: string

  if (week && typeof week === 'string') {
    weekStart = week
    const d = new Date(week)
    d.setDate(d.getDate() + 6)
    weekEnd = d.toISOString().split('T')[0]
  } else {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const mon = new Date(today)
    mon.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    weekStart = mon.toISOString().split('T')[0]
    weekEnd = sun.toISOString().split('T')[0]
  }

  const entries = db.prepare(`
    SELECT te.*, t.name as task_name, t.project_id,
           p.name as project_name, p.color as project_color
    FROM time_entries te
    LEFT JOIN tasks t ON t.id = te.task_id
    JOIN projects p ON p.id = te.project_id
    WHERE te.user_id = ? AND te.date >= ? AND te.date <= ?
    ORDER BY te.date ASC, te.created_at ASC
  `).all(req.user!.userId, weekStart, weekEnd)

  const weekTotal = entries.reduce((s: number, e: any) => s + (e.hours || 0), 0)

  const myProjects = db.prepare(`
    SELECT DISTINCT p.id, p.name, p.color
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
    WHERE p.status = 'active'
  `).all(req.user!.userId)

  const myTasks = db.prepare(`
    SELECT t.id, t.name, t.project_id, p.name as project_name
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.assignee_id = ? AND t.status != 'done'
    ORDER BY t.priority ASC
  `).all(req.user!.userId)

  res.json({ entries, weekStart, weekEnd, weekTotal, myProjects, myTasks })
})

router.get('/team', authenticate, (req: Request, res: Response) => {
  const { week } = req.query
  let weekStart: string
  let weekEnd: string

  if (week && typeof week === 'string') {
    weekStart = week
    const d = new Date(week)
    d.setDate(d.getDate() + 6)
    weekEnd = d.toISOString().split('T')[0]
  } else {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const mon = new Date(today)
    mon.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    weekStart = mon.toISOString().split('T')[0]
    weekEnd = sun.toISOString().split('T')[0]
  }

  const summary = db.prepare(`
    SELECT u.id, u.name, u.department, u.capacity,
           COALESCE(SUM(te.hours), 0) as hours_logged,
           ROUND(COALESCE(SUM(te.hours), 0) / (u.capacity / 5.0) * 100, 1) as utilization_pct
    FROM users u
    LEFT JOIN time_entries te ON te.user_id = u.id AND te.date >= ? AND te.date <= ?
    WHERE u.role != 'admin'
    GROUP BY u.id
    ORDER BY hours_logged DESC
  `).all(weekStart, weekEnd)

  res.json({ summary, weekStart, weekEnd })
})

router.post('/', authenticate, (req: Request, res: Response) => {
  const { task_id, project_id, hours, date, description } = req.body
  if (!project_id || !hours || !date) {
    return res.status(400).json({ error: 'project_id, hours, and date required' })
  }

  const result = db.prepare(`
    INSERT INTO time_entries (task_id, user_id, project_id, hours, date, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(task_id || null, req.user!.userId, project_id, hours, date, description || null)

  const entry = db.prepare(`
    SELECT te.*, t.name as task_name, p.name as project_name, p.color as project_color
    FROM time_entries te
    LEFT JOIN tasks t ON t.id = te.task_id
    JOIN projects p ON p.id = te.project_id
    WHERE te.id = ?
  `).get(result.lastInsertRowid)

  res.status(201).json({ entry })
})

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const { hours, description } = req.body
  db.prepare('UPDATE time_entries SET hours=?, description=? WHERE id=? AND user_id=?')
    .run(hours, description || null, req.params.id, req.user!.userId)
  res.json({ success: true })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM time_entries WHERE id=? AND user_id=?').run(req.params.id, req.user!.userId)
  res.json({ success: true })
})

export default router
