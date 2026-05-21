import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

db.exec(`
  CREATE TABLE IF NOT EXISTS project_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    requester_name TEXT NOT NULL,
    requester_email TEXT NOT NULL,
    business_case TEXT,
    estimated_budget REAL,
    estimated_duration TEXT,
    priority TEXT DEFAULT 'medium',
    department TEXT,
    status TEXT DEFAULT 'pending',
    reviewer_id INTEGER REFERENCES users(id),
    reviewer_notes TEXT,
    project_id INTEGER REFERENCES projects(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME
  );
`)

// Public - submit a new project request (no auth required)
router.post('/', (req: Request, res: Response) => {
  const { title, description, requester_name, requester_email, business_case, estimated_budget, estimated_duration, priority, department } = req.body
  if (!title?.trim() || !requester_name?.trim() || !requester_email?.trim()) {
    return res.status(400).json({ error: 'Title, name, and email are required' })
  }
  const result = db.prepare(`
    INSERT INTO project_requests (title, description, requester_name, requester_email, business_case, estimated_budget, estimated_duration, priority, department)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title.trim(), description || null, requester_name.trim(), requester_email.trim(),
    business_case || null, estimated_budget || null, estimated_duration || null,
    priority || 'medium', department || null)
  const request = db.prepare('SELECT * FROM project_requests WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ request })
})

// Protected - list all requests (PM/admin view)
router.get('/', authenticate, (_req: Request, res: Response) => {
  const requests = db.prepare(`
    SELECT pr.*, u.name as reviewer_name, p.name as project_name
    FROM project_requests pr
    LEFT JOIN users u ON u.id = pr.reviewer_id
    LEFT JOIN projects p ON p.id = pr.project_id
    ORDER BY pr.created_at DESC
  `).all()
  res.json({ requests })
})

// Protected - update request status (approve/reject/defer)
router.put('/:id', authenticate, (req: Request, res: Response) => {
  const { status, reviewer_notes, project_id } = req.body
  db.prepare(`
    UPDATE project_requests SET status=?, reviewer_id=?, reviewer_notes=?, project_id=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(status, (req as any).user!.userId, reviewer_notes || null, project_id || null, req.params.id)
  const request = db.prepare(`
    SELECT pr.*, u.name as reviewer_name, p.name as project_name
    FROM project_requests pr LEFT JOIN users u ON u.id = pr.reviewer_id LEFT JOIN projects p ON p.id = pr.project_id WHERE pr.id = ?
  `).get(req.params.id)
  res.json({ request })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM project_requests WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
