import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'
import { createNotification } from '../lib/notify'
import { dispatchWebhooks } from '../lib/webhookDispatcher'

const router = Router()

router.get('/:entityType/:entityId', authenticate, (req: Request, res: Response) => {
  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.email as user_email
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.entity_type = ? AND c.entity_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.entityType, req.params.entityId)
  res.json({ comments })
})

router.post('/:entityType/:entityId', authenticate, (req: Request, res: Response) => {
  const { content } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' })

  const result = db.prepare(`
    INSERT INTO comments (entity_type, entity_id, user_id, content) VALUES (?, ?, ?, ?)
  `).run(req.params.entityType, req.params.entityId, req.user!.userId, content.trim())

  // If commenting on a task, notify the assignee
  if (req.params.entityType === 'task') {
    const task = db.prepare('SELECT assignee_id, name, project_id FROM tasks WHERE id = ?').get(req.params.entityId) as { assignee_id: number | null; name: string; project_id: number } | undefined
    if (task?.assignee_id && task.assignee_id !== req.user!.userId) {
      createNotification(task.assignee_id, 'comment', `New comment on "${task.name}"`, content.trim().slice(0, 200), `/projects/${task.project_id}/tasks`)
    }
    if (task) {
      dispatchWebhooks('comment.created', task.project_id, {
        comment: { id: Number(result.lastInsertRowid), task_id: Number(req.params.entityId), task_name: task.name, content: content.trim() },
      })
    }
  }

  const comment = db.prepare(`
    SELECT c.*, u.name as user_name, u.email as user_email
    FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?
  `).get(result.lastInsertRowid)
  res.status(201).json({ comment })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  const c = db.prepare('SELECT user_id FROM comments WHERE id = ?').get(req.params.id) as { user_id: number } | undefined
  if (!c) return res.status(404).json({ error: 'Not found' })
  if (c.user_id !== req.user!.userId && req.user!.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
