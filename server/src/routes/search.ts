import { Router } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

router.get('/', (req, res) => {
  const q = (req.query.q as string || '').trim()
  if (!q || q.length < 2) return res.json({ projects: [], tasks: [], risks: [] })

  const like = `%${q}%`

  const projects = db.prepare(`
    SELECT p.id, p.name, p.status, p.health, p.color, p.completion_percent,
           po.name as portfolio_name
    FROM projects p
    LEFT JOIN portfolios po ON po.id = p.portfolio_id
    WHERE p.name LIKE ? OR p.description LIKE ? OR p.tags LIKE ?
    LIMIT 8
  `).all(like, like, like)

  const tasks = db.prepare(`
    SELECT t.id, t.name, t.status, t.priority, t.project_id,
           p.name as project_name, p.color as project_color
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.name LIKE ? OR t.description LIKE ?
    LIMIT 8
  `).all(like, like)

  const risks = db.prepare(`
    SELECT r.id, r.title, r.status, r.score, r.project_id,
           p.name as project_name
    FROM risks r
    JOIN projects p ON p.id = r.project_id
    WHERE r.title LIKE ? OR r.description LIKE ?
    LIMIT 6
  `).all(like, like)

  res.json({ projects, tasks, risks })
})

export default router
