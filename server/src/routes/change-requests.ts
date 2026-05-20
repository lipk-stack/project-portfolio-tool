import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const crs = db.prepare(`
    SELECT cr.*,
      r.name as requested_by_name,
      a.name as approved_by_name
    FROM change_requests cr
    LEFT JOIN users r ON cr.requested_by = r.id
    LEFT JOIN users a ON cr.approved_by = a.id
    WHERE cr.project_id = ?
    ORDER BY cr.created_at DESC
  `).all(req.params.projectId)
  res.json({ change_requests: crs })
})

router.post('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const { title, description, type, priority, impact_schedule, impact_budget, impact_scope } = req.body
  const requested_by = req.user!.userId
  const result = db.prepare(`
    INSERT INTO change_requests (project_id, title, description, type, status, priority, impact_schedule, impact_budget, impact_scope, requested_by, requested_date)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, CURRENT_DATE)
  `).run(req.params.projectId, title, description, type || 'scope', priority || 'medium', impact_schedule || 0, impact_budget || 0, impact_scope, requested_by)

  const cr = db.prepare(`
    SELECT cr.*, r.name as requested_by_name, a.name as approved_by_name
    FROM change_requests cr
    LEFT JOIN users r ON cr.requested_by = r.id
    LEFT JOIN users a ON cr.approved_by = a.id
    WHERE cr.id = ?
  `).get(result.lastInsertRowid)
  res.status(201).json({ change_request: cr })
})

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const { title, description, type, status, priority, impact_schedule, impact_budget, impact_scope, decision_date } = req.body
  const approved_by = status === 'approved' || status === 'rejected' ? req.user!.userId : null

  db.prepare(`
    UPDATE change_requests
    SET title=?, description=?, type=?, status=?, priority=?, impact_schedule=?, impact_budget=?, impact_scope=?,
        approved_by=COALESCE(?, approved_by), decision_date=?
    WHERE id=?
  `).run(title, description, type, status, priority, impact_schedule || 0, impact_budget || 0, impact_scope, approved_by, decision_date, req.params.id)

  const cr = db.prepare(`
    SELECT cr.*, r.name as requested_by_name, a.name as approved_by_name
    FROM change_requests cr
    LEFT JOIN users r ON cr.requested_by = r.id
    LEFT JOIN users a ON cr.approved_by = a.id
    WHERE cr.id = ?
  `).get(req.params.id)
  res.json({ change_request: cr })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM change_requests WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
