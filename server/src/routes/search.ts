import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', authenticate, (req: Request, res: Response) => {
  const q = (req.query.q as string || '').trim()
  if (!q || q.length < 2) return res.json({ results: [] })

  const like = `%${q}%`

  const projects = db.prepare(`
    SELECT id, name, description, status, health, priority, color, 'project' as type
    FROM projects WHERE name LIKE ? OR description LIKE ? LIMIT 5
  `).all(like, like) as Array<Record<string, unknown>>

  const tasks = db.prepare(`
    SELECT t.id, t.name, t.status, t.priority, p.id as project_id, p.name as project_name, p.color, 'task' as type
    FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.name LIKE ? OR t.description LIKE ? LIMIT 5
  `).all(like, like) as Array<Record<string, unknown>>

  const users = db.prepare(`
    SELECT id, name, email, role, department, 'user' as type
    FROM users WHERE name LIKE ? OR email LIKE ? LIMIT 5
  `).all(like, like) as Array<Record<string, unknown>>

  const risks = db.prepare(`
    SELECT r.id, r.title as name, r.score, r.status, p.id as project_id, p.name as project_name, 'risk' as type
    FROM risks r JOIN projects p ON p.id = r.project_id
    WHERE r.title LIKE ? LIMIT 3
  `).all(like) as Array<Record<string, unknown>>

  const results = [
    ...projects.map(p => ({ ...p, category: 'Projects' })),
    ...tasks.map(t => ({ ...t, category: 'Tasks' })),
    ...users.map(u => ({ ...u, category: 'People' })),
    ...risks.map(r => ({ ...r, category: 'Risks' })),
  ]

  res.json({ results, query: q })
})

export default router
