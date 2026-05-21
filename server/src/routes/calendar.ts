import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', authenticate, (req: Request, res: Response) => {
  const { year, month } = req.query
  const y = parseInt(year as string) || new Date().getFullYear()
  const m = parseInt(month as string) || new Date().getMonth() + 1
  const paddedM = String(m).padStart(2, '0')
  const start = `${y}-${paddedM}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${paddedM}-${String(lastDay).padStart(2, '0')}`

  const tasks = db.prepare(`
    SELECT t.id, t.name, t.status, t.priority, t.end_date, t.start_date,
           t.completion_percent, t.assignee_id,
           u.name as assignee_name,
           p.id as project_id, p.name as project_name, p.color as project_color, p.status as project_status
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE p.status != 'cancelled'
      AND (
        (t.end_date >= ? AND t.end_date <= ?)
        OR (t.start_date >= ? AND t.start_date <= ?)
        OR (t.start_date < ? AND t.end_date > ?)
      )
    ORDER BY t.end_date ASC, t.priority DESC
  `).all(start, end, start, end, start, end)

  const milestones = db.prepare(`
    SELECT m.id, m.name, m.date, m.status,
           p.id as project_id, p.name as project_name, p.color as project_color
    FROM milestones m
    JOIN projects p ON p.id = m.project_id
    WHERE p.status != 'cancelled'
      AND m.date >= ? AND m.date <= ?
    ORDER BY m.date ASC
  `).all(start, end)

  res.json({ tasks, milestones, year: y, month: m })
})

export default router
