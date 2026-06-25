// Pure rule-matching logic for the workflow automation engine.
// Database-dependent execution lives in automationRunner.ts so this file stays unit-testable.

export type TriggerType =
  | 'task_created'
  | 'task_status_changed'
  | 'task_assigned'
  | 'risk_created'
  | 'risk_updated'
  | 'project_health_red'
  | 'project_health_improved'
  | 'task_overdue'
  | 'budget_overrun'

export type ActionType = 'notify_manager' | 'notify_user' | 'set_task_priority' | 'add_comment'

export interface AutomationRule {
  id: number
  project_id: number | null
  name: string
  trigger_type: string
  conditions: string | null
  action_type: string
  action_config: string | null
  enabled: number
}

export interface RuleConditions {
  to_status?: string
  from_status?: string
  priority_in?: string[]
  min_score?: number
}

export interface AutomationEvent {
  type: TriggerType
  projectId: number
  task?: {
    id: number
    name: string
    status?: string
    priority?: string
    assignee_id?: number | null
    from_status?: string
  }
  risk?: {
    id: number
    title: string
    score: number
    status?: string
  }
  project?: {
    id: number
    name: string
    score: number
    fromRag?: string
    toRag: string
  }
  budget?: {
    projectId: number
    name: string
    budget: number
    spent: number
  }
}

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function ruleMatches(rule: AutomationRule, event: AutomationEvent): boolean {
  if (!rule.enabled) return false
  if (rule.trigger_type !== event.type) return false
  if (rule.project_id != null && rule.project_id !== event.projectId) return false

  const cond = parseJson<RuleConditions>(rule.conditions, {})

  if (event.type.startsWith('task')) {
    if (!event.task) return false
    if (cond.to_status && event.task.status !== cond.to_status) return false
    if (cond.from_status && event.task.from_status !== cond.from_status) return false
    if (cond.priority_in && cond.priority_in.length > 0) {
      if (!event.task.priority || !cond.priority_in.includes(event.task.priority)) return false
    }
  }

  if (event.type.startsWith('risk')) {
    if (!event.risk) return false
    if (cond.min_score != null && event.risk.score < cond.min_score) return false
  }

  if (event.type.startsWith('project')) {
    if (!event.project) return false
  }

  return true
}

export function describeEvent(event: AutomationEvent): string {
  switch (event.type) {
    case 'task_created':
      return `Task "${event.task?.name}" was created`
    case 'task_status_changed':
      return `Task "${event.task?.name}" moved from ${event.task?.from_status} to ${event.task?.status}`
    case 'task_assigned':
      return `Task "${event.task?.name}" was assigned`
    case 'risk_created':
      return `Risk "${event.risk?.title}" was identified (score ${event.risk?.score})`
    case 'risk_updated':
      return `Risk "${event.risk?.title}" was updated (score ${event.risk?.score})`
    case 'project_health_red':
      return `Project "${event.project?.name}" health turned RED (score ${event.project?.score})`
    case 'project_health_improved':
      return `Project "${event.project?.name}" health recovered to ${event.project?.toRag?.toUpperCase()} (score ${event.project?.score})`
    case 'task_overdue':
      return `Task "${event.task?.name}" is overdue`
    case 'budget_overrun':
      return `Project "${event.budget?.name}" exceeded its budget ($${event.budget?.spent} spent of $${event.budget?.budget})`
  }
}
