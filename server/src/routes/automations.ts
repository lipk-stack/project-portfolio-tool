import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

const TRIGGER_TYPES = ['task_created', 'task_status_changed', 'task_assigned', 'risk_created', 'risk_updated']
const ACTION_TYPES = ['notify_manager', 'notify_user', 'set_task_priority', 'add_comment']

router.get('/', authenticate, (_req: Request, res: Response) => {
  const rules = db.prepare(`
    SELECT ar.*, p.name as project_name, u.name as created_by_name
    FROM automation_rules ar
    LEFT JOIN projects p ON p.id = ar.project_id
    LEFT JOIN users u ON u.id = ar.created_by
    ORDER BY ar.created_at DESC
  `).all()
  res.json({ rules })
})

router.post('/', authenticate, (req: Request, res: Response) => {
  const { project_id, name, trigger_type, conditions, action_type, action_config } = req.body
  if (!name || !trigger_type || !action_type) {
    return res.status(400).json({ error: 'name, trigger_type and action_type are required' })
  }
  if (!TRIGGER_TYPES.includes(trigger_type)) return res.status(400).json({ error: `trigger_type must be one of: ${TRIGGER_TYPES.join(', ')}` })
  if (!ACTION_TYPES.includes(action_type)) return res.status(400).json({ error: `action_type must be one of: ${ACTION_TYPES.join(', ')}` })

  const result = db.prepare(`
    INSERT INTO automation_rules (project_id, name, trigger_type, conditions, action_type, action_config, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    project_id || null, name, trigger_type,
    conditions ? JSON.stringify(conditions) : null,
    action_type,
    action_config ? JSON.stringify(action_config) : null,
    req.user!.userId
  )
  const rule = db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ rule })
})

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!existing) return res.status(404).json({ error: 'Rule not found' })

  const { project_id, name, trigger_type, conditions, action_type, action_config, enabled } = req.body
  if (trigger_type && !TRIGGER_TYPES.includes(trigger_type)) return res.status(400).json({ error: 'Invalid trigger_type' })
  if (action_type && !ACTION_TYPES.includes(action_type)) return res.status(400).json({ error: 'Invalid action_type' })

  db.prepare(`
    UPDATE automation_rules SET project_id=?, name=?, trigger_type=?, conditions=?, action_type=?, action_config=?, enabled=?
    WHERE id=?
  `).run(
    project_id !== undefined ? (project_id || null) : existing.project_id,
    name ?? existing.name,
    trigger_type ?? existing.trigger_type,
    conditions !== undefined ? (conditions ? JSON.stringify(conditions) : null) : existing.conditions,
    action_type ?? existing.action_type,
    action_config !== undefined ? (action_config ? JSON.stringify(action_config) : null) : existing.action_config,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    req.params.id
  )
  const rule = db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(req.params.id)
  res.json({ rule })
})

router.post('/:id/toggle', authenticate, (req: Request, res: Response) => {
  const existing = db.prepare('SELECT enabled FROM automation_rules WHERE id = ?').get(req.params.id) as { enabled: number } | undefined
  if (!existing) return res.status(404).json({ error: 'Rule not found' })
  db.prepare('UPDATE automation_rules SET enabled = ? WHERE id = ?').run(existing.enabled ? 0 : 1, req.params.id)
  const rule = db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(req.params.id)
  res.json({ rule })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM automation_rules WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
