import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const project = db.prepare('SELECT id, name, budget, spent FROM projects WHERE id = ?').get(req.params.projectId)
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const lines = db.prepare('SELECT * FROM budget_lines WHERE project_id = ? ORDER BY category, created_at').all(req.params.projectId)

  const byCategory = db.prepare(`
    SELECT category,
      SUM(planned_amount) as planned,
      SUM(actual_amount) as actual
    FROM budget_lines WHERE project_id = ? GROUP BY category
  `).all(req.params.projectId)

  const timeSpend = db.prepare(`
    SELECT strftime('%Y-%m', te.date) as month, SUM(te.hours * u.hourly_rate) as labor_cost, SUM(te.hours) as hours
    FROM time_entries te JOIN users u ON u.id = te.user_id
    WHERE te.project_id = ? AND te.date >= date('now', '-6 months')
    GROUP BY month ORDER BY month
  `).all(req.params.projectId)

  res.json({ project, lines, byCategory, timeSpend })
})

router.post('/project/:projectId/lines', authenticate, (req: Request, res: Response) => {
  const { category, description, planned_amount, actual_amount, period } = req.body
  if (!category) return res.status(400).json({ error: 'Category required' })

  const result = db.prepare('INSERT INTO budget_lines (project_id, category, description, planned_amount, actual_amount, period) VALUES (?, ?, ?, ?, ?, ?)').run(req.params.projectId, category, description || null, planned_amount || 0, actual_amount || 0, period || null)
  const line = db.prepare('SELECT * FROM budget_lines WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ line })
})

router.put('/lines/:id', authenticate, (req: Request, res: Response) => {
  const { category, description, planned_amount, actual_amount, period } = req.body
  db.prepare('UPDATE budget_lines SET category=?, description=?, planned_amount=?, actual_amount=?, period=? WHERE id=?').run(category, description || null, planned_amount || 0, actual_amount || 0, period || null, req.params.id)
  const line = db.prepare('SELECT * FROM budget_lines WHERE id = ?').get(req.params.id)
  res.json({ line })
})

router.delete('/lines/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM budget_lines WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.get('/portfolio/overview', authenticate, (_req: Request, res: Response) => {
  const overview = db.prepare(`
    SELECT p.id, p.name, p.status, p.health, p.color, p.budget, p.spent,
      CASE WHEN p.budget > 0 THEN ROUND((p.spent / p.budget) * 100, 1) ELSE 0 END as budget_utilization,
      p.completion_percent
    FROM projects p
    WHERE p.status != 'cancelled'
    ORDER BY p.budget DESC
  `).all()

  const totals = db.prepare(`
    SELECT SUM(budget) as total_budget, SUM(spent) as total_spent
    FROM projects WHERE status != 'cancelled'
  `).get() as { total_budget: number; total_spent: number }

  const byCategory = db.prepare(`
    SELECT bl.category,
      SUM(bl.planned_amount) as planned,
      SUM(bl.actual_amount) as actual
    FROM budget_lines bl
    JOIN projects p ON p.id = bl.project_id
    WHERE p.status != 'cancelled'
    GROUP BY bl.category
  `).all()

  res.json({ overview, totals, byCategory })
})

export default router
