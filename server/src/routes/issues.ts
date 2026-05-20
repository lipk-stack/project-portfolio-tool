import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const issues = db.prepare(`
    SELECT i.*,
      a.name as assignee_name, a.email as assignee_email,
      r.name as reporter_name
    FROM issues i
    LEFT JOIN users a ON i.assignee_id = a.id
    LEFT JOIN users r ON i.reported_by = r.id
    WHERE i.project_id = ?
    ORDER BY CASE i.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, i.created_at DESC
  `).all(req.params.projectId)
  res.json({ issues })
})

router.post('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const { title, description, type, severity, assignee_id, due_date } = req.body
  const reported_by = req.user!.userId
  const result = db.prepare(`
    INSERT INTO issues (project_id, title, description, type, severity, status, assignee_id, reported_by, due_date)
    VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)
  `).run(req.params.projectId, title, description, type || 'general', severity || 'medium', assignee_id || null, reported_by, due_date || null)

  const issue = db.prepare(`
    SELECT i.*, a.name as assignee_name, r.name as reporter_name
    FROM issues i LEFT JOIN users a ON i.assignee_id = a.id LEFT JOIN users r ON i.reported_by = r.id
    WHERE i.id = ?
  `).get(result.lastInsertRowid)
  res.status(201).json({ issue })
})

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const { title, description, type, severity, status, assignee_id, due_date } = req.body
  const resolved_date = status === 'resolved' || status === 'closed' ? new Date().toISOString().split('T')[0] : null
  db.prepare(`
    UPDATE issues SET title=?, description=?, type=?, severity=?, status=?, assignee_id=?, due_date=?,
      resolved_date=COALESCE(?, resolved_date)
    WHERE id=?
  `).run(title, description, type, severity, status, assignee_id || null, due_date || null, resolved_date, req.params.id)

  const issue = db.prepare(`
    SELECT i.*, a.name as assignee_name, r.name as reporter_name
    FROM issues i LEFT JOIN users a ON i.assignee_id = a.id LEFT JOIN users r ON i.reported_by = r.id
    WHERE i.id = ?
  `).get(req.params.id)
  res.json({ issue })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM issues WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
