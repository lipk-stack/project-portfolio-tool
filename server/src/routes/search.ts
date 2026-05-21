import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', authenticate, (req: Request, res: Response) => {
  const { q } = req.query
  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    return res.json({ projects: [], tasks: [], risks: [] })
  }

  const term = `%${q.trim()}%`

  const projects = db.prepare(`
    SELECT p.id, p.name, p.status, p.health, p.priority, p.color, p.completion_percent, p.end_date
    FROM projects p
    WHERE (p.name LIKE ? OR p.description LIKE ?) AND p.status != 'cancelled'
    ORDER BY p.priority ASC LIMIT 8
  `).all(term, term)

  const tasks = db.prepare(`
    SELECT t.id, t.name, t.status, t.priority, t.project_id, t.end_date,
           p.name as project_name, p.color as project_color
    FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE (t.name LIKE ? OR t.description LIKE ?) AND t.status != 'done'
    ORDER BY t.priority ASC LIMIT 8
  `).all(term, term)

  const risks = db.prepare(`
    SELECT r.id, r.title, r.status, r.score, r.project_id, p.name as project_name
    FROM risks r JOIN projects p ON p.id = r.project_id
    WHERE (r.title LIKE ? OR r.description LIKE ?) AND r.status != 'closed'
    LIMIT 5
  `).all(term, term)

  res.json({ projects, tasks, risks })
})

export default router
