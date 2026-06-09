import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', authenticate, (req: Request, res: Response) => {
  const q = (req.query.q as string || '').trim()
  if (!q) return res.json({ projects: [], tasks: [], risks: [], people: [], portfolios: [] })

  const like = `%${q}%`
  const limit = 8

  const projects = db.prepare(`
    SELECT id, name, status, health, priority, color
    FROM projects WHERE name LIKE ? OR description LIKE ?
    ORDER BY updated_at DESC LIMIT ?
  `).all(like, like, limit)

  const tasks = db.prepare(`
    SELECT t.id, t.name, t.status, t.project_id, p.name as project_name, p.color
    FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.name LIKE ? OR t.description LIKE ? OR t.wbs_code LIKE ?
    ORDER BY t.updated_at DESC LIMIT ?
  `).all(like, like, like, limit)

  const risks = db.prepare(`
    SELECT r.id, r.title, r.score, r.status, r.project_id, p.name as project_name
    FROM risks r JOIN projects p ON p.id = r.project_id
    WHERE r.title LIKE ? OR r.description LIKE ?
    ORDER BY r.score DESC LIMIT ?
  `).all(like, like, limit)

  const people = db.prepare(`
    SELECT id, name, email, role, department
    FROM users WHERE name LIKE ? OR email LIKE ? OR department LIKE ?
    LIMIT ?
  `).all(like, like, like, limit)

  const portfolios = db.prepare(`
    SELECT id, name, description FROM portfolios WHERE name LIKE ? OR description LIKE ? LIMIT ?
  `).all(like, like, limit)

  res.json({ q, projects, tasks, risks, people, portfolios })
})

export default router
