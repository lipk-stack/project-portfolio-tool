import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'
import bcrypt from 'bcryptjs'

const router = Router()

function requireAdmin(req: Request, res: Response, next: Function) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  next()
}

router.use(authenticate, requireAdmin)

router.get('/users', (_req: Request, res: Response) => {
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.department, u.capacity, u.hourly_rate,
           u.created_at, u.active,
           COUNT(DISTINCT pm.project_id) as project_count,
           COALESCE(SUM(CASE WHEN p.status = 'active' THEN pm.allocation_percent ELSE 0 END), 0) as total_allocation
    FROM users u
    LEFT JOIN project_members pm ON pm.user_id = u.id
    LEFT JOIN projects p ON p.id = pm.project_id
    GROUP BY u.id
    ORDER BY u.name ASC
  `).all()
  res.json({ users })
})

router.post('/users', (req: Request, res: Response) => {
  const { name, email, password, role, department, capacity, hourly_rate } = req.body
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' })

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) return res.status(409).json({ error: 'Email already in use' })

  const hash = bcrypt.hashSync(password, 10)
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, department, capacity, hourly_rate, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(name, email, hash, role || 'member', department || null, capacity || 40, hourly_rate || 0)

  const user = db.prepare('SELECT id, name, email, role, department, capacity, hourly_rate, created_at, active FROM users WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ user })
})

router.put('/users/:id', (req: Request, res: Response) => {
  const { name, email, role, department, capacity, hourly_rate, password } = req.body
  const userId = req.params.id

  if (password) {
    const hash = bcrypt.hashSync(password, 10)
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId)
  }

  db.prepare(`
    UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email),
      role = COALESCE(?, role), department = COALESCE(?, department),
      capacity = COALESCE(?, capacity), hourly_rate = COALESCE(?, hourly_rate)
    WHERE id = ?
  `).run(name || null, email || null, role || null, department || null, capacity || null, hourly_rate || null, userId)

  const user = db.prepare('SELECT id, name, email, role, department, capacity, hourly_rate, created_at, active FROM users WHERE id = ?').get(userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ user })
})

router.patch('/users/:id/toggle-active', (req: Request, res: Response) => {
  const user = db.prepare('SELECT id, active FROM users WHERE id = ?').get(req.params.id) as { id: number; active: number } | undefined
  if (!user) return res.status(404).json({ error: 'User not found' })
  const newActive = user.active ? 0 : 1
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(newActive, req.params.id)
  res.json({ active: newActive })
})

router.get('/stats', (_req: Request, res: Response) => {
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE active = 1) as active_users,
      (SELECT COUNT(*) FROM users WHERE active = 0) as inactive_users,
      (SELECT COUNT(*) FROM projects WHERE status = 'active') as active_projects,
      (SELECT COUNT(*) FROM tasks WHERE status != 'done' AND end_date < date('now')) as overdue_tasks,
      (SELECT ROUND(AVG(completion_percent)) FROM projects WHERE status = 'active') as avg_completion
  `).get()
  res.json(stats)
})

export default router
