import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/task/:taskId', authenticate, (req: Request, res: Response) => {
  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.email as user_email
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.entity_type = 'task' AND c.entity_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.taskId)
  res.json({ comments })
})

router.post('/task/:taskId', authenticate, (req: Request, res: Response) => {
  const { content } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' })

  const result = db.prepare(
    'INSERT INTO comments (entity_type, entity_id, user_id, content) VALUES (?, ?, ?, ?)'
  ).run('task', req.params.taskId, req.user!.userId, content.trim())

  const comment = db.prepare(`
    SELECT c.*, u.name as user_name, u.email as user_email
    FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?
  `).get(result.lastInsertRowid)
  res.status(201).json({ comment })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id) as { user_id: number } | undefined
  if (!comment) return res.status(404).json({ error: 'Not found' })
  if (comment.user_id !== req.user!.userId) return res.status(403).json({ error: 'Forbidden' })
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

router.get('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, t.name as task_name
    FROM comments c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN tasks t ON t.id = c.entity_id AND c.entity_type = 'task'
    WHERE c.entity_type = 'task' AND c.entity_id IN (
      SELECT id FROM tasks WHERE project_id = ?
    )
    ORDER BY c.created_at DESC LIMIT 20
  `).all(req.params.projectId)
  res.json({ comments })
})

export default router
