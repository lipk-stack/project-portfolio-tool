import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', authenticate, (req: Request, res: Response) => {
  const { status, portfolio_id, health, priority } = req.query
  let query = `
    SELECT p.*, u.name as manager_name, u.email as manager_email,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as done_task_count,
      (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count,
      (SELECT COUNT(*) FROM risks r WHERE r.project_id = p.id AND r.status != 'closed') as open_risk_count,
      po.name as portfolio_name
    FROM projects p
    LEFT JOIN users u ON u.id = p.manager_id
    LEFT JOIN portfolios po ON po.id = p.portfolio_id
    WHERE 1=1
  `
  const params: (string | number)[] = []
  if (status) { query += ' AND p.status = ?'; params.push(status as string) }
  if (portfolio_id) { query += ' AND p.portfolio_id = ?'; params.push(portfolio_id as string) }
  if (health) { query += ' AND p.health = ?'; params.push(health as string) }
  if (priority) { query += ' AND p.priority = ?'; params.push(priority as string) }
  query += " ORDER BY CASE p.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, p.created_at DESC"

  const projects = db.prepare(query).all(...params)
  res.json({ projects })
})

router.post('/', authenticate, (req: Request, res: Response) => {
  const { name, description, portfolio_id, status, priority, health, phase, start_date, end_date, budget, manager_id, color, tags } = req.body
  if (!name) return res.status(400).json({ error: 'Project name required' })

  const result = db.prepare(`
    INSERT INTO projects (name, description, portfolio_id, status, priority, health, phase, start_date, end_date, budget, manager_id, color, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, description || null, portfolio_id || null,
    status || 'planning', priority || 'medium', health || 'green',
    phase || 'initiation', start_date || null, end_date || null,
    budget || 0, manager_id || req.user!.userId, color || '#3B82F6',
    tags ? JSON.stringify(tags) : null
  )

  db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(result.lastInsertRowid, req.user!.userId, 'manager')
  db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run('project', result.lastInsertRowid, req.user!.userId, 'created', JSON.stringify({ name }))

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ project })
})

router.get('/:id', authenticate, (req: Request, res: Response) => {
  const project = db.prepare(`
    SELECT p.*, u.name as manager_name, u.email as manager_email, po.name as portfolio_name
    FROM projects p
    LEFT JOIN users u ON u.id = p.manager_id
    LEFT JOIN portfolios po ON po.id = p.portfolio_id
    WHERE p.id = ?
  `).get(req.params.id)
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.role as system_role, u.department, pm.role, pm.allocation_percent
    FROM project_members pm JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?
  `).all(req.params.id)

  const milestones = db.prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY date ASC').all(req.params.id)

  const taskStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
      SUM(estimated_hours) as total_estimated,
      SUM(actual_hours) as total_actual
    FROM tasks WHERE project_id = ? AND parent_id IS NULL
  `).get(req.params.id)

  res.json({ project, members, milestones, taskStats })
})

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const { name, description, portfolio_id, status, priority, health, phase, start_date, end_date, budget, spent, manager_id, color, tags, completion_percent } = req.body
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as { health: string } | undefined
  if (!existing) return res.status(404).json({ error: 'Project not found' })

  db.prepare(`
    UPDATE projects SET name=?, description=?, portfolio_id=?, status=?, priority=?, health=?,
      phase=?, start_date=?, end_date=?, budget=?, spent=?, manager_id=?, color=?, tags=?,
      completion_percent=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(name, description || null, portfolio_id || null, status, priority, health, phase, start_date || null, end_date || null, budget, spent, manager_id, color, tags ? JSON.stringify(tags) : null, completion_percent || 0, req.params.id)

  if (existing.health !== health) {
    db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run('project', req.params.id, req.user!.userId, 'health_changed', JSON.stringify({ from: existing.health, to: health }))
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  res.json({ project })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.get('/:id/members', authenticate, (req: Request, res: Response) => {
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.department, u.capacity, pm.role, pm.allocation_percent
    FROM project_members pm JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?
  `).all(req.params.id)
  res.json({ members })
})

router.post('/:id/members', authenticate, (req: Request, res: Response) => {
  const { user_id, role, allocation_percent } = req.body
  db.prepare('INSERT OR REPLACE INTO project_members (project_id, user_id, role, allocation_percent) VALUES (?, ?, ?, ?)').run(req.params.id, user_id, role || 'member', allocation_percent || 100)
  res.json({ success: true })
})

router.delete('/:id/members/:userId', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.params.id, req.params.userId)
  res.json({ success: true })
})

router.get('/:id/milestones', authenticate, (req: Request, res: Response) => {
  const milestones = db.prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY date ASC').all(req.params.id)
  res.json({ milestones })
})

router.post('/:id/milestones', authenticate, (req: Request, res: Response) => {
  const { name, date, status, description } = req.body
  const result = db.prepare('INSERT INTO milestones (project_id, name, date, status, description) VALUES (?, ?, ?, ?, ?)').run(req.params.id, name, date, status || 'upcoming', description || null)
  const milestone = db.prepare('SELECT * FROM milestones WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ milestone })
})

router.put('/:id/milestones/:mid', authenticate, (req: Request, res: Response) => {
  const { name, date, status, description } = req.body
  db.prepare('UPDATE milestones SET name=?, date=?, status=?, description=? WHERE id=? AND project_id=?').run(name, date, status, description || null, req.params.mid, req.params.id)
  const milestone = db.prepare('SELECT * FROM milestones WHERE id = ?').get(req.params.mid)
  res.json({ milestone })
})

router.delete('/:id/milestones/:mid', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM milestones WHERE id = ? AND project_id = ?').run(req.params.mid, req.params.id)
  res.json({ success: true })
})

router.get('/:id/activity', authenticate, (req: Request, res: Response) => {
  const activity = db.prepare(`
    SELECT a.*, u.name as user_name, u.email as user_email
    FROM activity_log a JOIN users u ON u.id = a.user_id
    WHERE a.entity_type = 'project' AND a.entity_id = ?
    ORDER BY a.created_at DESC LIMIT 50
  `).all(req.params.id)
  res.json({ activity })
})

router.get('/:id/documents', authenticate, (req: Request, res: Response) => {
  const docs = db.prepare(`
    SELECT d.*, u.name as uploaded_by_name
    FROM project_documents d LEFT JOIN users u ON d.uploaded_by = u.id
    WHERE d.project_id = ? ORDER BY d.created_at DESC
  `).all(req.params.id)
  res.json({ documents: docs })
})

router.post('/:id/documents', authenticate, (req: Request, res: Response) => {
  const { name, url, description, doc_type } = req.body
  const result = db.prepare(`
    INSERT INTO project_documents (project_id, name, url, description, doc_type, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, name, url, description, doc_type || 'link', req.user!.userId)
  const doc = db.prepare(`
    SELECT d.*, u.name as uploaded_by_name FROM project_documents d LEFT JOIN users u ON d.uploaded_by = u.id WHERE d.id = ?
  `).get(result.lastInsertRowid)
  res.status(201).json({ document: doc })
})

router.delete('/:id/documents/:docId', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM project_documents WHERE id = ? AND project_id = ?').run(req.params.docId, req.params.id)
  res.json({ ok: true })
})

router.get('/:id/time-entries', authenticate, (req: Request, res: Response) => {
  const entries = db.prepare(`
    SELECT te.*, u.name as user_name, t.name as task_name
    FROM time_entries te
    LEFT JOIN users u ON te.user_id = u.id
    LEFT JOIN tasks t ON te.task_id = t.id
    WHERE te.project_id = ?
    ORDER BY te.date DESC LIMIT 100
  `).all(req.params.id)
  res.json({ entries })
})

export default router
