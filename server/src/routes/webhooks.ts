import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate, requireAdmin } from '../middleware/auth'
import { WEBHOOK_EVENTS, WebhookRow, buildEventBody, isValidEventList } from '../lib/webhooks'
import { deliver } from '../lib/webhookDispatcher'

const router = Router()

router.get('/', authenticate, requireAdmin, (_req: Request, res: Response) => {
  const webhooks = db.prepare(`
    SELECT w.id, w.url, w.events, w.project_id, w.enabled, w.last_status, w.last_fired_at,
      w.fail_count, w.created_at, w.secret IS NOT NULL AND w.secret != '' as has_secret,
      p.name as project_name, u.name as created_by_name
    FROM webhooks w
    LEFT JOIN projects p ON p.id = w.project_id
    LEFT JOIN users u ON u.id = w.created_by
    ORDER BY w.created_at DESC
  `).all()
  res.json({ webhooks, available_events: WEBHOOK_EVENTS })
})

router.post('/', authenticate, requireAdmin, (req: Request, res: Response) => {
  const { url, secret, events, project_id } = req.body
  if (!url || !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'Valid http(s) URL required' })
  if (!isValidEventList(events)) {
    return res.status(400).json({ error: `events must be a non-empty array of: ${WEBHOOK_EVENTS.join(', ')}` })
  }

  const result = db.prepare(`
    INSERT INTO webhooks (url, secret, events, project_id, created_by) VALUES (?, ?, ?, ?, ?)
  `).run(url, secret || null, JSON.stringify(events), project_id || null, req.user!.userId)

  const webhook = db.prepare('SELECT id, url, events, project_id, enabled, created_at FROM webhooks WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ webhook })
})

router.put('/:id', authenticate, requireAdmin, (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(req.params.id) as WebhookRow | undefined
  if (!existing) return res.status(404).json({ error: 'Webhook not found' })

  const { url, secret, events, project_id, enabled } = req.body
  if (url && !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'Valid http(s) URL required' })
  if (events !== undefined && !isValidEventList(events)) {
    return res.status(400).json({ error: `events must be a non-empty array of: ${WEBHOOK_EVENTS.join(', ')}` })
  }

  db.prepare(`
    UPDATE webhooks SET url = ?, secret = ?, events = ?, project_id = ?, enabled = ? WHERE id = ?
  `).run(
    url || existing.url,
    secret !== undefined ? (secret || null) : existing.secret,
    events !== undefined ? JSON.stringify(events) : existing.events,
    project_id !== undefined ? (project_id || null) : existing.project_id,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    req.params.id
  )
  res.json({ success: true })
})

router.delete('/:id', authenticate, requireAdmin, (req: Request, res: Response) => {
  db.prepare('DELETE FROM webhooks WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// Sends a ping event so the receiver integration can be verified end to end.
router.post('/:id/test', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const hook = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(req.params.id) as WebhookRow | undefined
  if (!hook) return res.status(404).json({ error: 'Webhook not found' })

  const body = JSON.stringify(buildEventBody('ping', 0, { message: 'ProjectPulse webhook test', webhook_id: hook.id }))
  const status = await deliver(hook, 'ping', body)
  res.json({ delivered: status >= 200 && status < 300, status })
})

export default router
