import crypto from 'crypto'

export interface WebhookRow {
  id: number
  url: string
  secret: string | null
  events: string // JSON array of event types, e.g. ["task.created","risk.updated"]
  project_id: number | null // null = all projects
  enabled: number
}

export const WEBHOOK_EVENTS = [
  'task.created', 'task.updated', 'task.deleted',
  'risk.created', 'risk.updated',
  'comment.created', 'project.updated',
] as const

export type WebhookEventType = typeof WEBHOOK_EVENTS[number]

export function isValidEventList(events: unknown): events is string[] {
  return Array.isArray(events) && events.length > 0 &&
    events.every(e => (WEBHOOK_EVENTS as readonly string[]).includes(e))
}

export function webhookMatches(hook: Pick<WebhookRow, 'events' | 'project_id' | 'enabled'>, eventType: string, projectId: number): boolean {
  if (!hook.enabled) return false
  if (hook.project_id !== null && hook.project_id !== projectId) return false
  try {
    const events = JSON.parse(hook.events) as string[]
    return Array.isArray(events) && events.includes(eventType)
  } catch {
    return false
  }
}

export function buildEventBody(eventType: string, projectId: number, data: Record<string, unknown>) {
  return {
    event: eventType,
    project_id: projectId,
    timestamp: new Date().toISOString(),
    data,
  }
}

// HMAC-SHA256 of the raw JSON body, hex-encoded — receivers verify with their
// shared secret, GitHub-webhook style ("sha256=<hex>").
export function signPayload(secret: string, rawBody: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
}
