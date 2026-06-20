import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { buildEventBody, buildSlackBody, buildSlackText, isValidEventList, signPayload, webhookMatches } from './webhooks'

const hook = (overrides: Partial<{ events: string; project_id: number | null; enabled: number }> = {}) => ({
  events: JSON.stringify(['task.created', 'risk.updated']),
  project_id: null,
  enabled: 1,
  ...overrides,
})

describe('webhookMatches', () => {
  it('matches a subscribed event for any project when project_id is null', () => {
    expect(webhookMatches(hook(), 'task.created', 5)).toBe(true)
  })

  it('rejects events not subscribed to', () => {
    expect(webhookMatches(hook(), 'task.deleted', 5)).toBe(false)
  })

  it('rejects disabled webhooks', () => {
    expect(webhookMatches(hook({ enabled: 0 }), 'task.created', 5)).toBe(false)
  })

  it('scopes to a specific project when project_id is set', () => {
    expect(webhookMatches(hook({ project_id: 3 }), 'task.created', 3)).toBe(true)
    expect(webhookMatches(hook({ project_id: 3 }), 'task.created', 7)).toBe(false)
  })

  it('rejects malformed events JSON instead of throwing', () => {
    expect(webhookMatches(hook({ events: 'not-json' }), 'task.created', 1)).toBe(false)
    expect(webhookMatches(hook({ events: '{"a":1}' }), 'task.created', 1)).toBe(false)
  })
})

describe('isValidEventList', () => {
  it('accepts known event types', () => {
    expect(isValidEventList(['task.created', 'comment.created'])).toBe(true)
  })

  it('rejects empty lists, non-arrays and unknown events', () => {
    expect(isValidEventList([])).toBe(false)
    expect(isValidEventList('task.created')).toBe(false)
    expect(isValidEventList(['task.created', 'bogus.event'])).toBe(false)
  })
})

describe('signPayload', () => {
  it('produces a verifiable sha256 HMAC', () => {
    const body = JSON.stringify({ hello: 'world' })
    const sig = signPayload('topsecret', body)
    const expected = 'sha256=' + crypto.createHmac('sha256', 'topsecret').update(body).digest('hex')
    expect(sig).toBe(expected)
  })

  it('changes when body or secret changes', () => {
    expect(signPayload('a', 'body')).not.toBe(signPayload('b', 'body'))
    expect(signPayload('a', 'body1')).not.toBe(signPayload('a', 'body2'))
  })
})

describe('buildEventBody', () => {
  it('wraps event metadata around the data payload', () => {
    const body = buildEventBody('task.created', 9, { task: { id: 1 } })
    expect(body.event).toBe('task.created')
    expect(body.project_id).toBe(9)
    expect(body.data).toEqual({ task: { id: 1 } })
    expect(new Date(body.timestamp).getTime()).not.toBeNaN()
  })
})

describe('buildSlackText', () => {
  it('formats task lifecycle events', () => {
    expect(buildSlackText('task.created', { task: { name: 'Ship it', priority: 'high' } }))
      .toBe(':sparkles: Task created: *Ship it* (high priority)')
    expect(buildSlackText('task.updated', { task: { name: 'Ship it', status: 'done' }, previous_status: 'review' }))
      .toBe(':pencil2: Task updated: *Ship it* — review to done')
    expect(buildSlackText('task.deleted', { task: { name: 'Old task' } }))
      .toBe(':wastebasket: Task deleted: *Old task*')
  })

  it('omits the status transition when status is unchanged', () => {
    expect(buildSlackText('task.updated', { task: { name: 'T', status: 'todo' }, previous_status: 'todo' }))
      .toBe(':pencil2: Task updated: *T*')
  })

  it('formats risk, comment and project events', () => {
    expect(buildSlackText('risk.created', { risk: { title: 'Vendor delay', probability: 'high', impact: 'medium' } }))
      .toContain('Vendor delay')
    expect(buildSlackText('comment.created', { comment: { task_name: 'API design', content: 'LGTM' } }))
      .toBe(':speech_balloon: New comment on *API design*: LGTM')
    expect(buildSlackText('project.created', { project: { name: 'Apollo' } }))
      .toBe(':rocket: Project created: *Apollo*')
    expect(buildSlackText('project.updated', { project: { name: 'Apollo', status: 'active', health: 'green' } }))
      .toBe(':clipboard: Project updated: *Apollo* — active, health green')
  })

  it('truncates long comment bodies to 200 chars', () => {
    const text = buildSlackText('comment.created', { comment: { task_name: 'T', content: 'x'.repeat(500) } })
    expect(text.length).toBeLessThan(260)
  })

  it('never throws on missing or malformed data', () => {
    expect(buildSlackText('task.created', {})).toContain('Task created')
    expect(buildSlackText('task.updated', { task: null })).toContain('Task updated')
    expect(buildSlackText('unknown.event', {})).toBe('Helmsman event: unknown.event')
  })

  it('wraps text for slack body and accepts new event types in the registry', () => {
    expect(buildSlackBody('ping', {})).toEqual({ text: ':wave: Helmsman webhook test — your integration works!' })
    expect(isValidEventList(['project.created'])).toBe(true)
  })
})
