import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', authenticate, (_req: Request, res: Response) => {
  const portfolios = db.prepare(`
    SELECT po.*, u.name as owner_name,
      (SELECT COUNT(*) FROM projects p WHERE p.portfolio_id = po.id) as project_count,
      (SELECT COUNT(*) FROM projects p WHERE p.portfolio_id = po.id AND p.status = 'active') as active_count,
      (SELECT SUM(p.budget) FROM projects p WHERE p.portfolio_id = po.id) as total_budget,
      (SELECT SUM(p.spent) FROM projects p WHERE p.portfolio_id = po.id) as total_spent
    FROM portfolios po
    LEFT JOIN users u ON u.id = po.owner_id
    ORDER BY po.created_at DESC
  `).all()
  res.json({ portfolios })
})

router.post('/', authenticate, (req: Request, res: Response) => {
  const { name, description } = req.body
  if (!name) return res.status(400).json({ error: 'Name required' })
  const result = db.prepare('INSERT INTO portfolios (name, description, owner_id) VALUES (?, ?, ?)').run(name, description || null, req.user!.userId)
  const portfolio = db.prepare('SELECT * FROM portfolios WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ portfolio })
})

router.get('/:id', authenticate, (req: Request, res: Response) => {
  const portfolio = db.prepare('SELECT * FROM portfolios WHERE id = ?').get(req.params.id)
  if (!portfolio) return res.status(404).json({ error: 'Portfolio not found' })
  const projects = db.prepare(`
    SELECT p.*, u.name as manager_name,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count
    FROM projects p
    LEFT JOIN users u ON u.id = p.manager_id
    WHERE p.portfolio_id = ?
    ORDER BY p.priority DESC
  `).all(req.params.id)
  res.json({ portfolio, projects })
})

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const { name, description } = req.body
  db.prepare('UPDATE portfolios SET name = ?, description = ? WHERE id = ?').run(name, description || null, req.params.id)
  const portfolio = db.prepare('SELECT * FROM portfolios WHERE id = ?').get(req.params.id)
  res.json({ portfolio })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM portfolios WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
