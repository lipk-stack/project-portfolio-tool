import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', authenticate, (req: Request, res: Response) => {
  const q = (req.query.q as string || '').trim()
  if (!q || q.length < 2) return res.json({ results: [] })
  const like = `%${q}%`

  const projects = db.prepare(`
    SELECT 'project' as type, id, name, status as subtitle, 'blue' as color
    FROM projects WHERE name LIKE ? OR description LIKE ? LIMIT 5
  `).all(like, like)

  const tasks = db.prepare(`
    SELECT 'task' as type, t.id, t.name, p.name || ' · ' || t.status as subtitle, 'purple' as color
    FROM tasks t JOIN projects p ON t.project_id = p.id
    WHERE t.name LIKE ? OR t.description LIKE ? LIMIT 5
  `).all(like, like)

  const risks = db.prepare(`
    SELECT 'risk' as type, r.id, r.title as name, p.name || ' · ' || r.status as subtitle, 'orange' as color
    FROM risks r JOIN projects p ON r.project_id = p.id
    WHERE r.title LIKE ? OR r.description LIKE ? LIMIT 3
  `).all(like, like)

  const users = db.prepare(`
    SELECT 'user' as type, id, name, email as subtitle, 'green' as color
    FROM users WHERE name LIKE ? OR email LIKE ? LIMIT 3
  `).all(like, like)

  res.json({ results: [...projects, ...tasks, ...risks, ...users], q })
})

export default router
