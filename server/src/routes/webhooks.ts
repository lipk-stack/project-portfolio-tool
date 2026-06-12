import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate, requireAdmin } from '../middleware/auth'
import { WEBHOOK_EVENTS, WEBHOOK_FORMATS, WebhookRow, buildEventBody, buildSlackBody, isValidEventList } from '../lib/webhooks'
import { deliver } from '../lib/webhookDispatcher'

const router = Router()

router.get('/', authenticate, requireAdmin, (_req: Request, res: Response) => {
  const webhooks = db.prepare(`
    SELECT w.id, w.url, w.events, w.project_id, w.enabled, w.format, w.last_status, w.last_fired_at,
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
  const { url, secret, events, project_id, format } = req.body
  if (!url || !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'Valid http(s) URL required' })
  if (!isValidEventList(events)) {
    return res.status(400).json({ error: `events must be a non-empty array of: ${WEBHOOK_EVENTS.join(', ')}` })
  }
  if (format !== undefined && !(WEBHOOK_FORMATS as readonly string[]).includes(format)) {
    return res.status(400).json({ error: `format must be one of: ${WEBHOOK_FORMATS.join(', ')}` })
  }

  const result = db.prepare(`
    INSERT INTO webhooks (url, secret, events, project_id, format, created_by) VALUES (?, ?, ?, ?, ?, ?)
  `).run(url, secret || null, JSON.stringify(events), project_id || null, format || 'json', req.user!.userId)

  const webhook = db.prepare('SELECT id, url, events, project_id, enabled, format, created_at FROM webhooks WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ webhook })
})

router.put('/:id', authenticate, requireAdmin, (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(req.params.id) as WebhookRow | undefined
  if (!existing) return res.status(404).json({ error: 'Webhook not found' })

  const { url, secret, events, project_id, enabled, format } = req.body
  if (url && !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'Valid http(s) URL required' })
  if (events !== undefined && !isValidEventList(events)) {
    return res.status(400).json({ error: `events must be a non-empty array of: ${WEBHOOK_EVENTS.join(', ')}` })
  }
  if (format !== undefined && !(WEBHOOK_FORMATS as readonly string[]).includes(format)) {
    return res.status(400).json({ error: `format must be one of: ${WEBHOOK_FORMATS.join(', ')}` })
  }

  db.prepare(`
    UPDATE webhooks SET url = ?, secret = ?, events = ?, project_id = ?, enabled = ?, format = ? WHERE id = ?
  `).run(
    url || existing.url,
    secret !== undefined ? (secret || null) : existing.secret,
    events !== undefined ? JSON.stringify(events) : existing.events,
    project_id !== undefined ? (project_id || null) : existing.project_id,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    format !== undefined ? format : existing.format,
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

  const data = { message: 'ProjectPulse webhook test', webhook_id: hook.id }
  const body = JSON.stringify(hook.format === 'slack' ? buildSlackBody('ping', data) : buildEventBody('ping', 0, data))
  const status = await deliver(hook, 'ping', body)
  res.json({ delivered: status >= 200 && status < 300, status })
})

export default router
