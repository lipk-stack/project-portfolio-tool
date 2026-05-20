import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

// GET /timesheets?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/', authenticate, (req: Request, res: Response) => {
  const userId = req.user!.userId
  const { start, end } = req.query
  const startDate = (start as string) || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const endDate = (end as string) || new Date().toISOString().split('T')[0]

  const entries = db.prepare(`
    SELECT te.*, t.name as task_name, p.name as project_name, p.color as project_color, p.id as project_id
    FROM time_entries te
    LEFT JOIN tasks t ON t.id = te.task_id
    JOIN projects p ON p.id = te.project_id
    WHERE te.user_id = ? AND te.date >= ? AND te.date <= ?
    ORDER BY te.date ASC, te.created_at ASC
  `).all(userId, startDate, endDate)

  const projects = db.prepare(`
    SELECT DISTINCT p.id, p.name, p.color
    FROM project_members pm
    JOIN projects p ON p.id = pm.project_id
    WHERE pm.user_id = ? AND p.status IN ('active', 'planning')
    ORDER BY p.name
  `).all(userId)

  const tasks = db.prepare(`
    SELECT DISTINCT t.id, t.name, t.project_id, p.name as project_name
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.assignee_id = ? AND t.status NOT IN ('done') AND p.status = 'active'
    ORDER BY p.name, t.name
  `).all(userId)

  res.json({ entries, projects, tasks })
})

// GET /timesheets/team-summary
router.get('/team-summary', authenticate, (req: Request, res: Response) => {
  const { start, end } = req.query
  const startDate = (start as string) || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const endDate = (end as string) || new Date().toISOString().split('T')[0]

  const summary = db.prepare(`
    SELECT u.id, u.name, u.department, u.capacity,
      COALESCE(SUM(te.hours), 0) as logged_hours,
      COUNT(DISTINCT te.project_id) as project_count
    FROM users u
    LEFT JOIN time_entries te ON te.user_id = u.id AND te.date >= ? AND te.date <= ?
    GROUP BY u.id
    ORDER BY logged_hours DESC
  `).all(startDate, endDate)

  const byProject = db.prepare(`
    SELECT te.user_id, p.id as project_id, p.name as project_name, p.color,
      SUM(te.hours) as hours
    FROM time_entries te
    JOIN projects p ON p.id = te.project_id
    WHERE te.date >= ? AND te.date <= ?
    GROUP BY te.user_id, te.project_id
  `).all(startDate, endDate) as Array<{ user_id: number; project_id: number; project_name: string; color: string; hours: number }>

  const projectMap: Record<number, typeof byProject> = {}
  for (const row of byProject) {
    if (!projectMap[row.user_id]) projectMap[row.user_id] = []
    projectMap[row.user_id].push(row)
  }

  const enriched = (summary as Array<Record<string, unknown>>).map(u => ({
    ...u,
    projects: projectMap[u.id as number] || [],
  }))

  res.json({ summary: enriched, startDate, endDate })
})

// POST /timesheets
router.post('/', authenticate, (req: Request, res: Response) => {
  const userId = req.user!.userId
  const { task_id, project_id, hours, date, description } = req.body
  if (!project_id || !hours || !date) return res.status(400).json({ error: 'project_id, hours, and date required' })
  if (hours <= 0 || hours > 24) return res.status(400).json({ error: 'Hours must be between 0 and 24' })

  if (task_id) {
    const existing = db.prepare('SELECT id FROM time_entries WHERE user_id = ? AND task_id = ? AND date = ?').get(
      userId, task_id, date
    ) as { id: number } | undefined
    if (existing) {
      db.prepare('UPDATE time_entries SET hours = ?, description = ? WHERE id = ?').run(hours, description || null, existing.id)
      db.prepare('UPDATE tasks SET actual_hours = (SELECT COALESCE(SUM(hours),0) FROM time_entries WHERE task_id = ?) WHERE id = ?').run(task_id, task_id)
      return res.json({ id: existing.id, updated: true })
    }
  }

  const result = db.prepare(`
    INSERT INTO time_entries (task_id, user_id, project_id, hours, date, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(task_id || null, userId, project_id, hours, date, description || null)

  if (task_id) {
    db.prepare('UPDATE tasks SET actual_hours = (SELECT COALESCE(SUM(hours),0) FROM time_entries WHERE task_id = ?) WHERE id = ?').run(task_id, task_id)
  }
  const userRate = (db.prepare('SELECT hourly_rate FROM users WHERE id = ?').get(userId) as { hourly_rate: number })?.hourly_rate || 0
  if (userRate > 0) {
    db.prepare('UPDATE projects SET spent = spent + ? WHERE id = ?').run(hours * userRate, project_id)
  }

  res.json({ id: result.lastInsertRowid })
})

// PUT /timesheets/:id
router.put('/:id', authenticate, (req: Request, res: Response) => {
  const userId = req.user!.userId
  const { hours, description } = req.body
  if (hours !== undefined && (hours < 0 || hours > 24)) return res.status(400).json({ error: 'Hours must be between 0 and 24' })

  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ? AND user_id = ?').get(req.params.id, userId) as Record<string, unknown> | undefined
  if (!entry) return res.status(404).json({ error: 'Entry not found' })

  const newHours = hours ?? entry.hours
  db.prepare('UPDATE time_entries SET hours = ?, description = ? WHERE id = ?').run(newHours, description ?? entry.description, req.params.id)

  if (entry.task_id) {
    db.prepare('UPDATE tasks SET actual_hours = (SELECT COALESCE(SUM(hours),0) FROM time_entries WHERE task_id = ?) WHERE id = ?').run(entry.task_id, entry.task_id)
  }

  res.json({ success: true })
})

// DELETE /timesheets/:id
router.delete('/:id', authenticate, (req: Request, res: Response) => {
  const userId = req.user!.userId
  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ? AND user_id = ?').get(req.params.id, userId) as Record<string, unknown> | undefined
  if (!entry) return res.status(404).json({ error: 'Entry not found' })

  db.prepare('DELETE FROM time_entries WHERE id = ?').run(req.params.id)
  if (entry.task_id) {
    db.prepare('UPDATE tasks SET actual_hours = (SELECT COALESCE(SUM(hours),0) FROM time_entries WHERE task_id = ?) WHERE id = ?').run(entry.task_id, entry.task_id)
  }

  res.json({ success: true })
})


export default router
