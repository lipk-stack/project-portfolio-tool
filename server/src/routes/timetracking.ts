import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const entries = db.prepare(`
    SELECT te.*, u.name as user_name, u.email as user_email, t.name as task_name
    FROM time_entries te
    JOIN users u ON u.id = te.user_id
    LEFT JOIN tasks t ON t.id = te.task_id
    WHERE te.project_id = ?
    ORDER BY te.date DESC, te.created_at DESC
    LIMIT 100
  `).all(req.params.projectId)

  const summary = db.prepare(`
    SELECT u.id, u.name, u.department,
      SUM(te.hours) as total_hours,
      SUM(te.hours * u.hourly_rate) as total_cost
    FROM time_entries te JOIN users u ON u.id = te.user_id
    WHERE te.project_id = ?
    GROUP BY u.id
  `).all(req.params.projectId)

  const weekly = db.prepare(`
    SELECT strftime('%Y-%W', te.date) as week, SUM(te.hours) as hours
    FROM time_entries te WHERE te.project_id = ?
    GROUP BY week ORDER BY week
  `).all(req.params.projectId)

  res.json({ entries, summary, weekly })
})

router.get('/user/me', authenticate, (req: Request, res: Response) => {
  const entries = db.prepare(`
    SELECT te.*, p.name as project_name, p.color as project_color, t.name as task_name
    FROM time_entries te
    JOIN projects p ON p.id = te.project_id
    LEFT JOIN tasks t ON t.id = te.task_id
    WHERE te.user_id = ?
    ORDER BY te.date DESC LIMIT 50
  `).all(req.user!.userId)

  const thisWeek = db.prepare(`
    SELECT SUM(hours) as hours FROM time_entries
    WHERE user_id = ? AND date >= date('now', 'weekday 0', '-7 days')
  `).get(req.user!.userId) as { hours: number }

  const thisMonth = db.prepare(`
    SELECT SUM(hours) as hours FROM time_entries
    WHERE user_id = ? AND date >= date('now', 'start of month')
  `).get(req.user!.userId) as { hours: number }

  res.json({ entries, thisWeek: thisWeek?.hours || 0, thisMonth: thisMonth?.hours || 0 })
})

router.post('/task/:taskId', authenticate, (req: Request, res: Response) => {
  const { hours, date, description } = req.body
  if (!hours || hours <= 0) return res.status(400).json({ error: 'Valid hours required' })

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId) as { project_id: number; actual_hours: number } | undefined
  if (!task) return res.status(404).json({ error: 'Task not found' })

  const result = db.prepare(`
    INSERT INTO time_entries (task_id, user_id, project_id, hours, date, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.taskId, req.user!.userId, task.project_id, hours, date || new Date().toISOString().split('T')[0], description || null)

  db.prepare('UPDATE tasks SET actual_hours = actual_hours + ? WHERE id = ?').run(hours, req.params.taskId)

  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ entry })
})

router.post('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const { task_id, hours, date, description } = req.body
  if (!hours || hours <= 0) return res.status(400).json({ error: 'Valid hours required' })

  const result = db.prepare(`
    INSERT INTO time_entries (task_id, user_id, project_id, hours, date, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(task_id || null, req.user!.userId, req.params.projectId, hours, date || new Date().toISOString().split('T')[0], description || null)

  if (task_id) {
    db.prepare('UPDATE tasks SET actual_hours = actual_hours + ? WHERE id = ?').run(hours, task_id)
  }

  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ entry })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(req.params.id) as { user_id: number; hours: number; task_id?: number } | undefined
  if (!entry) return res.status(404).json({ error: 'Entry not found' })
  if (entry.user_id !== req.user!.userId && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' })
  }
  if (entry.task_id) {
    db.prepare('UPDATE tasks SET actual_hours = MAX(0, actual_hours - ?) WHERE id = ?').run(entry.hours, entry.task_id)
  }
  db.prepare('DELETE FROM time_entries WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
