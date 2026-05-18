import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

const LEVEL_MAP: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }

function calcScore(probability: string, impact: string): number {
  return (LEVEL_MAP[probability] || 2) * (LEVEL_MAP[impact] || 2)
}

router.get('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const risks = db.prepare(`
    SELECT r.*, u.name as owner_name
    FROM risks r LEFT JOIN users u ON u.id = r.owner_id
    WHERE r.project_id = ?
    ORDER BY r.score DESC, r.created_at DESC
  `).all(req.params.projectId)
  res.json({ risks })
})

router.post('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const { title, description, category, probability, impact, status, response, mitigation_plan, owner_id, identified_date, target_date } = req.body
  if (!title) return res.status(400).json({ error: 'Title required' })

  const score = calcScore(probability || 'medium', impact || 'medium')
  const result = db.prepare(`
    INSERT INTO risks (project_id, title, description, category, probability, impact, score, status, response, mitigation_plan, owner_id, identified_date, target_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.projectId, title, description || null, category || 'general', probability || 'medium', impact || 'medium', score, status || 'open', response || null, mitigation_plan || null, owner_id || req.user!.userId, identified_date || new Date().toISOString().split('T')[0], target_date || null)

  db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run('project', req.params.projectId, req.user!.userId, 'risk_raised', JSON.stringify({ title }))

  const risk = db.prepare('SELECT * FROM risks WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ risk })
})

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const { title, description, category, probability, impact, status, response, mitigation_plan, owner_id, identified_date, target_date } = req.body
  const score = calcScore(probability || 'medium', impact || 'medium')
  db.prepare(`
    UPDATE risks SET title=?, description=?, category=?, probability=?, impact=?, score=?,
      status=?, response=?, mitigation_plan=?, owner_id=?, identified_date=?, target_date=?
    WHERE id=?
  `).run(title, description || null, category, probability, impact, score, status, response || null, mitigation_plan || null, owner_id || null, identified_date, target_date || null, req.params.id)

  const risk = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id)
  res.json({ risk })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM risks WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.get('/portfolio/summary', authenticate, (_req: Request, res: Response) => {
  const risksByProject = db.prepare(`
    SELECT p.id as project_id, p.name as project_name, p.color,
      COUNT(*) as total_risks,
      SUM(CASE WHEN r.status != 'closed' AND r.score >= 6 THEN 1 ELSE 0 END) as high_risks,
      SUM(CASE WHEN r.status = 'open' THEN 1 ELSE 0 END) as open_risks
    FROM risks r JOIN projects p ON p.id = r.project_id
    GROUP BY p.id ORDER BY high_risks DESC
  `).all()

  const riskMatrix = db.prepare(`
    SELECT probability, impact, COUNT(*) as count
    FROM risks WHERE status != 'closed'
    GROUP BY probability, impact
  `).all()

  res.json({ risksByProject, riskMatrix })
})

export default router
