import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/:entityType/:entityId', authenticate, (req: Request, res: Response) => {
  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.email as user_email, u.avatar_url
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.entity_type = ? AND c.entity_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.entityType, req.params.entityId)
  res.json({ comments })
})

router.post('/:entityType/:entityId', authenticate, (req: Request, res: Response) => {
  const { content } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'Comment content required' })

  const result = db.prepare(`
    INSERT INTO comments (entity_type, entity_id, user_id, content) VALUES (?, ?, ?, ?)
  `).run(req.params.entityType, req.params.entityId, req.user!.userId, content.trim())

  const comment = db.prepare(`
    SELECT c.*, u.name as user_name, u.email as user_email
    FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?
  `).get(result.lastInsertRowid)

  db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.entityType, req.params.entityId, req.user!.userId, 'comment_added', JSON.stringify({ preview: content.slice(0, 80) }))

  res.status(201).json({ comment })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id) as { user_id: number } | undefined
  if (!comment) return res.status(404).json({ error: 'Comment not found' })
  if (comment.user_id !== req.user!.userId && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' })
  }
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
