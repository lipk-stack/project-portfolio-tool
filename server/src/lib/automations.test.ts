import { describe, it, expect } from 'vitest'
import { AutomationEvent, AutomationRule, describeEvent, parseJson, ruleMatches } from './automations'

function rule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 1,
    project_id: null,
    name: 'Test rule',
    trigger_type: 'task_status_changed',
    conditions: null,
    action_type: 'notify_manager',
    action_config: null,
    enabled: 1,
    ...overrides,
  }
}

function taskEvent(overrides: Partial<AutomationEvent['task']> = {}, type: AutomationEvent['type'] = 'task_status_changed'): AutomationEvent {
  return {
    type,
    projectId: 10,
    task: { id: 5, name: 'Build feature', status: 'done', priority: 'high', from_status: 'in_progress', ...overrides },
  }
}

describe('parseJson', () => {
  it('parses valid JSON', () => {
    expect(parseJson('{"a":1}', {})).toEqual({ a: 1 })
  })
  it('returns fallback for null and invalid input', () => {
    expect(parseJson(null, { x: true })).toEqual({ x: true })
    expect(parseJson('not json', [])).toEqual([])
  })
})

describe('ruleMatches', () => {
  it('matches an unconditional rule with the right trigger', () => {
    expect(ruleMatches(rule(), taskEvent())).toBe(true)
  })

  it('rejects disabled rules', () => {
    expect(ruleMatches(rule({ enabled: 0 }), taskEvent())).toBe(false)
  })

  it('rejects mismatched trigger types', () => {
    expect(ruleMatches(rule({ trigger_type: 'risk_created' }), taskEvent())).toBe(false)
  })

  it('scopes rules to a project when project_id is set', () => {
    expect(ruleMatches(rule({ project_id: 10 }), taskEvent())).toBe(true)
    expect(ruleMatches(rule({ project_id: 99 }), taskEvent())).toBe(false)
  })

  it('applies global rules (project_id null) to every project', () => {
    expect(ruleMatches(rule({ project_id: null }), taskEvent())).toBe(true)
  })

  it('checks to_status condition', () => {
    const r = rule({ conditions: JSON.stringify({ to_status: 'done' }) })
    expect(ruleMatches(r, taskEvent({ status: 'done' }))).toBe(true)
    expect(ruleMatches(r, taskEvent({ status: 'in_progress' }))).toBe(false)
  })

  it('checks from_status condition', () => {
    const r = rule({ conditions: JSON.stringify({ from_status: 'review' }) })
    expect(ruleMatches(r, taskEvent({ from_status: 'review' }))).toBe(true)
    expect(ruleMatches(r, taskEvent({ from_status: 'todo' }))).toBe(false)
  })

  it('checks priority_in condition', () => {
    const r = rule({ trigger_type: 'task_created', conditions: JSON.stringify({ priority_in: ['high', 'critical'] }) })
    expect(ruleMatches(r, taskEvent({ priority: 'critical' }, 'task_created'))).toBe(true)
    expect(ruleMatches(r, taskEvent({ priority: 'low' }, 'task_created'))).toBe(false)
  })

  it('checks min_score for risk events', () => {
    const r = rule({ trigger_type: 'risk_created', conditions: JSON.stringify({ min_score: 6 }) })
    const riskEvent = (score: number): AutomationEvent => ({
      type: 'risk_created',
      projectId: 10,
      risk: { id: 1, title: 'Vendor delay', score },
    })
    expect(ruleMatches(r, riskEvent(9))).toBe(true)
    expect(ruleMatches(r, riskEvent(6))).toBe(true)
    expect(ruleMatches(r, riskEvent(4))).toBe(false)
  })

  it('rejects task rules when the event has no task payload', () => {
    const event = { type: 'task_status_changed', projectId: 10 } as AutomationEvent
    expect(ruleMatches(rule(), event)).toBe(false)
  })

  it('matches an unconditional project_health_red rule', () => {
    const r = rule({ trigger_type: 'project_health_red' })
    const event: AutomationEvent = { type: 'project_health_red', projectId: 10, project: { id: 10, name: 'Apollo', score: 40, toRag: 'red', fromRag: 'amber' } }
    expect(ruleMatches(r, event)).toBe(true)
  })

  it('scopes project_health_red rules to a project', () => {
    const event: AutomationEvent = { type: 'project_health_red', projectId: 10, project: { id: 10, name: 'Apollo', score: 40, toRag: 'red' } }
    expect(ruleMatches(rule({ trigger_type: 'project_health_red', project_id: 10 }), event)).toBe(true)
    expect(ruleMatches(rule({ trigger_type: 'project_health_red', project_id: 99 }), event)).toBe(false)
  })

  it('rejects project rules when the event has no project payload', () => {
    const event = { type: 'project_health_red', projectId: 10 } as AutomationEvent
    expect(ruleMatches(rule({ trigger_type: 'project_health_red' }), event)).toBe(false)
  })

  it('matches a project_health_improved rule', () => {
    const r = rule({ trigger_type: 'project_health_improved' })
    const event: AutomationEvent = { type: 'project_health_improved', projectId: 10, project: { id: 10, name: 'Apollo', score: 72, fromRag: 'red', toRag: 'amber' } }
    expect(ruleMatches(r, event)).toBe(true)
  })

  it('treats malformed conditions JSON as unconditional', () => {
    expect(ruleMatches(rule({ conditions: '{broken' }), taskEvent())).toBe(true)
  })

  it('matches a task_overdue rule and honours a priority filter', () => {
    const r = rule({ trigger_type: 'task_overdue', conditions: JSON.stringify({ priority_in: ['high', 'critical'] }) })
    expect(ruleMatches(r, taskEvent({ priority: 'high' }, 'task_overdue'))).toBe(true)
    expect(ruleMatches(r, taskEvent({ priority: 'low' }, 'task_overdue'))).toBe(false)
  })

  it('matches an unconditional budget_overrun rule and scopes it to a project', () => {
    const event: AutomationEvent = { type: 'budget_overrun', projectId: 10, budget: { projectId: 10, name: 'Apollo', budget: 100, spent: 130 } }
    expect(ruleMatches(rule({ trigger_type: 'budget_overrun' }), event)).toBe(true)
    expect(ruleMatches(rule({ trigger_type: 'budget_overrun', project_id: 10 }), event)).toBe(true)
    expect(ruleMatches(rule({ trigger_type: 'budget_overrun', project_id: 99 }), event)).toBe(false)
  })
})

describe('describeEvent', () => {
  it('describes task status changes', () => {
    expect(describeEvent(taskEvent())).toContain('Build feature')
    expect(describeEvent(taskEvent())).toContain('in_progress to done')
  })
  it('describes risk creation with score', () => {
    const event: AutomationEvent = { type: 'risk_created', projectId: 1, risk: { id: 1, title: 'Outage', score: 8 } }
    expect(describeEvent(event)).toContain('Outage')
    expect(describeEvent(event)).toContain('8')
  })
  it('describes a project health red transition', () => {
    const event: AutomationEvent = { type: 'project_health_red', projectId: 1, project: { id: 1, name: 'Apollo', score: 42, toRag: 'red' } }
    expect(describeEvent(event)).toContain('Apollo')
    expect(describeEvent(event)).toContain('RED')
    expect(describeEvent(event)).toContain('42')
  })
  it('describes a project health recovery', () => {
    const event: AutomationEvent = { type: 'project_health_improved', projectId: 1, project: { id: 1, name: 'Apollo', score: 72, fromRag: 'red', toRag: 'amber' } }
    expect(describeEvent(event)).toContain('Apollo')
    expect(describeEvent(event)).toContain('recovered')
    expect(describeEvent(event)).toContain('AMBER')
    expect(describeEvent(event)).toContain('72')
  })
  it('describes an overdue task', () => {
    const event: AutomationEvent = { type: 'task_overdue', projectId: 1, task: { id: 5, name: 'Ship docs' } }
    expect(describeEvent(event)).toContain('Ship docs')
    expect(describeEvent(event)).toContain('overdue')
  })
  it('describes a budget overrun with the figures', () => {
    const event: AutomationEvent = { type: 'budget_overrun', projectId: 1, budget: { projectId: 1, name: 'Apollo', budget: 100, spent: 130 } }
    expect(describeEvent(event)).toContain('Apollo')
    expect(describeEvent(event)).toContain('130')
    expect(describeEvent(event)).toContain('100')
  })
})
