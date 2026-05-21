import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

db.exec(`
  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    owner_id INTEGER REFERENCES users(id),
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    target_value REAL DEFAULT 100,
    current_value REAL DEFAULT 0,
    unit TEXT DEFAULT '%',
    due_date DATE,
    status TEXT DEFAULT 'active',
    category TEXT DEFAULT 'strategic',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS goal_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    value REAL NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

router.get('/', authenticate, (_req: Request, res: Response) => {
  const goals = db.prepare(`
    SELECT g.*, u.name as owner_name, p.name as project_name,
      ROUND(CASE WHEN g.target_value > 0 THEN (g.current_value / g.target_value) * 100 ELSE 0 END, 1) as progress_pct
    FROM goals g
    LEFT JOIN users u ON u.id = g.owner_id
    LEFT JOIN projects p ON p.id = g.project_id
    ORDER BY g.created_at DESC
  `).all()
  res.json({ goals })
})

router.post('/', authenticate, (req: Request, res: Response) => {
  const { title, description, owner_id, project_id, target_value, current_value, unit, due_date, category } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' })
  const result = db.prepare(`
    INSERT INTO goals (title, description, owner_id, project_id, target_value, current_value, unit, due_date, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title.trim(), description || null, owner_id || req.user!.userId, project_id || null,
    target_value ?? 100, current_value ?? 0, unit || '%', due_date || null, category || 'strategic')
  const goal = db.prepare('SELECT g.*, u.name as owner_name, p.name as project_name FROM goals g LEFT JOIN users u ON u.id = g.owner_id LEFT JOIN projects p ON p.id = g.project_id WHERE g.id = ?').get(result.lastInsertRowid)
  res.status(201).json({ goal })
})

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const { title, description, owner_id, project_id, target_value, current_value, unit, due_date, status, category } = req.body
  db.prepare(`
    UPDATE goals SET title=?, description=?, owner_id=?, project_id=?, target_value=?, current_value=?, unit=?, due_date=?, status=?, category=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(title, description || null, owner_id, project_id || null, target_value, current_value, unit, due_date || null, status, category, req.params.id)
  const goal = db.prepare('SELECT g.*, u.name as owner_name, p.name as project_name FROM goals g LEFT JOIN users u ON u.id = g.owner_id LEFT JOIN projects p ON p.id = g.project_id WHERE g.id = ?').get(req.params.id)
  res.json({ goal })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM goals WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.post('/:id/updates', authenticate, (req: Request, res: Response) => {
  const { value, note } = req.body
  if (value === undefined) return res.status(400).json({ error: 'Value required' })
  db.prepare('INSERT INTO goal_updates (goal_id, user_id, value, note) VALUES (?, ?, ?, ?)').run(req.params.id, req.user!.userId, value, note || null)
  db.prepare('UPDATE goals SET current_value=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(value, req.params.id)
  res.status(201).json({ success: true })
})

router.get('/:id/updates', authenticate, (req: Request, res: Response) => {
  const updates = db.prepare(`
    SELECT gu.*, u.name as user_name FROM goal_updates gu LEFT JOIN users u ON u.id = gu.user_id
    WHERE gu.goal_id = ? ORDER BY gu.created_at DESC LIMIT 20
  `).all(req.params.id)
  res.json({ updates })
})

export default router
