import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', authenticate, (req: Request, res: Response) => {
  const userId = req.user!.userId
  const notifications = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 50
  `).all(userId)
  const unreadCount = (db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0').get(userId) as any).count
  res.json({ notifications, unreadCount })
})

router.put('/read-all', authenticate, (req: Request, res: Response) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user!.userId)
  res.json({ ok: true })
})

router.put('/:id/read', authenticate, (req: Request, res: Response) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.userId)
  res.json({ ok: true })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.userId)
  res.json({ ok: true })
})

router.post('/generate', authenticate, (req: Request, res: Response) => {
  const userId = req.user!.userId

  // Overdue task notifications
  const overdueTasks = db.prepare(`
    SELECT t.id, t.name, p.name as project_name
    FROM tasks t JOIN projects p ON t.project_id = p.id
    WHERE t.status NOT IN ('done') AND t.end_date < date('now') AND t.assignee_id = ?
    LIMIT 5
  `).all(userId) as any[]

  for (const task of overdueTasks) {
    const exists = db.prepare('SELECT id FROM notifications WHERE user_id = ? AND entity_id = ? AND type = ?').get(userId, task.id, 'task_overdue')
    if (!exists) {
      db.prepare(`INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(userId, 'task_overdue', `Task overdue: ${task.name}`, `Task in "${task.project_name}" is past its due date`, 'task', task.id)
    }
  }

  // Upcoming milestone notifications for managers
  const milestones = db.prepare(`
    SELECT m.id, m.name, m.date, p.name as project_name
    FROM milestones m JOIN projects p ON m.project_id = p.id
    WHERE m.status = 'upcoming' AND m.date BETWEEN date('now') AND date('now', '+7 days')
    AND p.manager_id = ?
  `).all(userId) as any[]

  for (const m of milestones) {
    const exists = db.prepare('SELECT id FROM notifications WHERE user_id = ? AND entity_id = ? AND type = ?').get(userId, m.id, 'milestone_due')
    if (!exists) {
      db.prepare(`INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(userId, 'milestone_due', `Milestone approaching: ${m.name}`, `Due ${m.date} in "${m.project_name}"`, 'milestone', m.id)
    }
  }

  const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(userId)
  const unreadCount = (db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0').get(userId) as any).count
  res.json({ notifications, unreadCount })
})

export default router
