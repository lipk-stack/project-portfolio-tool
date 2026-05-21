import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', authenticate, (_req: Request, res: Response) => {
  const projects = db.prepare(`
    SELECT p.*, u.name as manager_name, po.name as portfolio_name, po.id as portfolio_id_val
    FROM projects p
    LEFT JOIN users u ON u.id = p.manager_id
    LEFT JOIN portfolios po ON po.id = p.portfolio_id
    WHERE p.status != 'cancelled' AND p.start_date IS NOT NULL
    ORDER BY p.start_date ASC
  `).all()

  const milestones = db.prepare(`
    SELECT m.*, p.name as project_name, p.color as project_color, p.id as project_id
    FROM milestones m JOIN projects p ON p.id = m.project_id
    WHERE p.status != 'cancelled'
    ORDER BY m.date ASC
  `).all()

  const portfolios = db.prepare(`
    SELECT po.*, COUNT(DISTINCT p.id) as project_count
    FROM portfolios po
    LEFT JOIN projects p ON p.portfolio_id = po.id AND p.status != 'cancelled'
    GROUP BY po.id
  `).all()

  res.json({ projects, milestones, portfolios })
})

export default router
