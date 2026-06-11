import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

// Filterable, paginated audit trail over activity_log.
router.get('/', authenticate, (req: Request, res: Response) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200)
  const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0)

  const where: string[] = []
  const params: unknown[] = []
  if (req.query.project_id) {
    where.push("a.entity_type = 'project' AND a.entity_id = ?")
    params.push(req.query.project_id)
  }
  if (req.query.user_id) {
    where.push('a.user_id = ?')
    params.push(req.query.user_id)
  }
  if (req.query.action) {
    where.push('a.action = ?')
    params.push(req.query.action)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const entries = db.prepare(`
    SELECT a.*, u.name as user_name,
      CASE WHEN a.entity_type = 'project' THEN p.name END as project_name
    FROM activity_log a
    LEFT JOIN users u ON u.id = a.user_id
    LEFT JOIN projects p ON a.entity_type = 'project' AND p.id = a.entity_id
    ${whereSql}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset)

  const total = (db.prepare(`SELECT COUNT(*) as c FROM activity_log a ${whereSql}`).get(...params) as { c: number }).c
  const actions = db.prepare('SELECT DISTINCT action FROM activity_log ORDER BY action').all() as Array<{ action: string }>

  res.json({ entries, total, actions: actions.map(a => a.action) })
})

export default router
