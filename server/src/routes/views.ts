import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', authenticate, (req: Request, res: Response) => {
  const { page } = req.query
  const views = page
    ? db.prepare('SELECT * FROM saved_views WHERE user_id = ? AND page = ? ORDER BY created_at ASC').all(req.user!.userId, page)
    : db.prepare('SELECT * FROM saved_views WHERE user_id = ? ORDER BY created_at ASC').all(req.user!.userId)
  res.json({ views })
})

router.post('/', authenticate, (req: Request, res: Response) => {
  const { page, name, filters, is_default } = req.body
  if (!page || !name || !filters) return res.status(400).json({ error: 'page, name and filters are required' })

  if (is_default) {
    db.prepare('UPDATE saved_views SET is_default = 0 WHERE user_id = ? AND page = ?').run(req.user!.userId, page)
  }
  const result = db.prepare('INSERT INTO saved_views (user_id, page, name, filters, is_default) VALUES (?, ?, ?, ?, ?)')
    .run(req.user!.userId, page, name, JSON.stringify(filters), is_default ? 1 : 0)
  const view = db.prepare('SELECT * FROM saved_views WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ view })
})

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM saved_views WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.userId) as Record<string, unknown> | undefined
  if (!existing) return res.status(404).json({ error: 'View not found' })

  const { name, filters, is_default } = req.body
  if (is_default) {
    db.prepare('UPDATE saved_views SET is_default = 0 WHERE user_id = ? AND page = ?').run(req.user!.userId, existing.page)
  }
  db.prepare('UPDATE saved_views SET name=?, filters=?, is_default=? WHERE id=?').run(
    name ?? existing.name,
    filters !== undefined ? JSON.stringify(filters) : existing.filters,
    is_default !== undefined ? (is_default ? 1 : 0) : existing.is_default,
    req.params.id
  )
  const view = db.prepare('SELECT * FROM saved_views WHERE id = ?').get(req.params.id)
  res.json({ view })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM saved_views WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.userId)
  res.json({ success: true })
})

export default router
