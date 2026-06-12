import { db } from '../database'
import { WebhookRow, buildEventBody, buildSlackBody, signPayload, webhookMatches } from './webhooks'

// Fires all matching webhooks for an event. Fully async + fail-safe: delivery
// happens in the background and never blocks or breaks the triggering request.
export function dispatchWebhooks(eventType: string, projectId: number, data: Record<string, unknown>) {
  try {
    const hooks = db.prepare('SELECT * FROM webhooks WHERE enabled = 1').all() as WebhookRow[]
    const matching = hooks.filter(h => webhookMatches(h, eventType, projectId))
    if (matching.length === 0) return

    const jsonBody = JSON.stringify(buildEventBody(eventType, projectId, data))
    const slackBody = JSON.stringify(buildSlackBody(eventType, data))
    for (const hook of matching) {
      deliver(hook, eventType, hook.format === 'slack' ? slackBody : jsonBody)
    }
  } catch (err) {
    console.error('Webhook dispatch error:', err)
  }
}

export async function deliver(hook: WebhookRow, eventType: string, rawBody: string): Promise<number> {
  let status = 0
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ProjectPulse-Webhook/1.0',
      'X-PPT-Event': eventType,
    }
    if (hook.secret) headers['X-PPT-Signature'] = signPayload(hook.secret, rawBody)

    const res = await fetch(hook.url, {
      method: 'POST',
      headers,
      body: rawBody,
      signal: AbortSignal.timeout(5000),
    })
    status = res.status
  } catch {
    status = 0 // network error / timeout
  }

  try {
    const ok = status >= 200 && status < 300
    db.prepare(`
      UPDATE webhooks SET last_status = ?, last_fired_at = CURRENT_TIMESTAMP,
        fail_count = CASE WHEN ? THEN 0 ELSE fail_count + 1 END
      WHERE id = ?
    `).run(status, ok ? 1 : 0, hook.id)
  } catch (err) {
    console.error('Webhook status update failed:', err)
  }
  return status
}
