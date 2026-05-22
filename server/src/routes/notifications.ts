import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

router.get('/', (req: Request, res: Response) => {
  const userId = req.user!.userId
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).all(userId)
  const unreadCount = (db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0`).get(userId) as any).count
  res.json({ notifications, unreadCount })
})

router.put('/:id/read', (req: Request, res: Response) => {
  const userId = req.user!.userId
  db.prepare(`UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?`).run(req.params.id, userId)
  res.json({ success: true })
})

router.put('/read-all', (req: Request, res: Response) => {
  const userId = req.user!.userId
  db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ?`).run(userId)
  res.json({ success: true })
})

export default router
