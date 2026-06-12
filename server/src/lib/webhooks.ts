import crypto from 'crypto'

export interface WebhookRow {
  id: number
  url: string
  secret: string | null
  events: string // JSON array of event types, e.g. ["task.created","risk.updated"]
  project_id: number | null // null = all projects
  enabled: number
  format: string // 'json' (signed payload) | 'slack' (incoming-webhook {text})
}

export const WEBHOOK_EVENTS = [
  'task.created', 'task.updated', 'task.deleted',
  'risk.created', 'risk.updated',
  'comment.created', 'project.created', 'project.updated',
] as const

export const WEBHOOK_FORMATS = ['json', 'slack'] as const

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

// Human-readable one-liner for Slack-format hooks (mrkdwn). Field access is
// defensive: payload shapes vary per event and may grow over time.
export function buildSlackText(eventType: string, data: Record<string, unknown>): string {
  const get = (obj: unknown, key: string): string => {
    if (obj && typeof obj === 'object' && key in (obj as object)) {
      const v = (obj as Record<string, unknown>)[key]
      if (v !== null && v !== undefined) return String(v)
    }
    return ''
  }
  const task = data.task, risk = data.risk, project = data.project, comment = data.comment

  switch (eventType) {
    case 'task.created':
      return `:sparkles: Task created: *${get(task, 'name')}* (${get(task, 'priority') || 'medium'} priority)`
    case 'task.updated': {
      const prev = String(data.previous_status ?? '')
      const status = get(task, 'status')
      const transition = prev && prev !== status ? ` — ${prev} to ${status}` : ''
      return `:pencil2: Task updated: *${get(task, 'name')}*${transition}`
    }
    case 'task.deleted':
      return `:wastebasket: Task deleted: *${get(task, 'name')}*`
    case 'risk.created':
      return `:warning: Risk identified: *${get(risk, 'title')}* (${get(risk, 'probability')} probability / ${get(risk, 'impact')} impact)`
    case 'risk.updated':
      return `:warning: Risk updated: *${get(risk, 'title')}* — status ${get(risk, 'status')}`
    case 'comment.created':
      return `:speech_balloon: New comment on *${get(comment, 'task_name')}*: ${get(comment, 'content').slice(0, 200)}`
    case 'project.created':
      return `:rocket: Project created: *${get(project, 'name')}*`
    case 'project.updated':
      return `:clipboard: Project updated: *${get(project, 'name')}* — ${get(project, 'status')}, health ${get(project, 'health')}`
    case 'ping':
      return ':wave: ProjectPulse webhook test — your integration works!'
    default:
      return `ProjectPulse event: ${eventType}`
  }
}

export function buildSlackBody(eventType: string, data: Record<string, unknown>): { text: string } {
  return { text: buildSlackText(eventType, data) }
}
