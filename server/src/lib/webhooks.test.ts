import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { buildEventBody, isValidEventList, signPayload, webhookMatches } from './webhooks'

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
