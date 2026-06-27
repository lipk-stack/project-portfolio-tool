import { db } from '../database'
import { AutomationEvent, AutomationRule, describeEvent, parseJson, ruleMatches } from './automations'
import { createNotification } from './notify'

interface NotifyConfig {
  user_id?: number
}

interface PriorityConfig {
  priority?: string
}

interface CommentConfig {
  content?: string
}

// Evaluates all enabled rules against an event and executes matching actions.
// Never throws: a misconfigured rule must not break the API mutation that triggered it.
export function runAutomations(event: AutomationEvent, actorId: number) {
  try {
    const rules = db.prepare(`
      SELECT * FROM automation_rules
      WHERE enabled = 1 AND trigger_type = ? AND (project_id IS NULL OR project_id = ?)
    `).all(event.type, event.projectId) as AutomationRule[]

    for (const rule of rules) {
      if (!ruleMatches(rule, event)) continue
      try {
        executeAction(rule, event, actorId)
        db.prepare('UPDATE automation_rules SET fire_count = fire_count + 1, last_fired_at = CURRENT_TIMESTAMP WHERE id = ?').run(rule.id)
      } catch (err) {
        console.error(`Automation rule ${rule.id} ("${rule.name}") failed:`, err)
      }
    }
  } catch (err) {
    console.error('Automation engine error:', err)
  }
}

function executeAction(rule: AutomationRule, event: AutomationEvent, actorId: number) {
  const link = event.type.startsWith('risk')
    ? `/projects/${event.projectId}/risks`
    : event.type.startsWith('project') || event.type === 'budget_overrun' || event.type === 'milestone_missed'
      ? `/projects/${event.projectId}`
      : `/projects/${event.projectId}/tasks`

  switch (rule.action_type) {
    case 'notify_manager': {
      const project = db.prepare('SELECT manager_id FROM projects WHERE id = ?').get(event.projectId) as { manager_id: number | null } | undefined
      if (project?.manager_id && project.manager_id !== actorId) {
        createNotification(project.manager_id, 'automation', `[Rule] ${rule.name}`, describeEvent(event), link)
      }
      break
    }
    case 'notify_user': {
      const config = parseJson<NotifyConfig>(rule.action_config, {})
      if (config.user_id && config.user_id !== actorId) {
        createNotification(config.user_id, 'automation', `[Rule] ${rule.name}`, describeEvent(event), link)
      }
      break
    }
    case 'set_task_priority': {
      const config = parseJson<PriorityConfig>(rule.action_config, {})
      if (event.task && config.priority && ['low', 'medium', 'high', 'critical'].includes(config.priority)) {
        db.prepare('UPDATE tasks SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(config.priority, event.task.id)
      }
      break
    }
    case 'add_comment': {
      const config = parseJson<CommentConfig>(rule.action_config, {})
      if (event.task && config.content) {
        db.prepare('INSERT INTO comments (entity_type, entity_id, user_id, content) VALUES (?, ?, ?, ?)')
          .run('task', event.task.id, actorId, `🤖 [${rule.name}] ${config.content}`)
      }
      break
    }
  }
}
