import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

function generateSystemNotifications(userId: number) {
  // Budget alerts
  const overBudgetProjects = db.prepare(`
    SELECT id, name, budget, spent FROM projects
    WHERE budget > 0 AND spent > budget * 0.9 AND status = 'active'
  `).all() as Array<{ id: number; name: string; budget: number; spent: number }>

  // Overdue tasks
  const overdueTasks = db.prepare(`
    SELECT t.id, t.name, p.name as project_name, t.end_date, t.assignee_id
    FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.end_date < date('now') AND t.status NOT IN ('done') AND t.end_date IS NOT NULL
    LIMIT 10
  `).all() as Array<{ id: number; name: string; project_name: string; end_date: string; assignee_id?: number }>

  // Milestones in next 7 days
  const upcomingMilestones = db.prepare(`
    SELECT m.*, p.name as project_name FROM milestones m JOIN projects p ON p.id = m.project_id
    WHERE m.date >= date('now') AND m.date <= date('now', '+7 days') AND m.status = 'upcoming'
  `).all() as Array<{ id: number; name: string; project_name: string; date: string }>

  // High risks
  const highRisks = db.prepare(`
    SELECT r.*, p.name as project_name FROM risks r JOIN projects p ON p.id = r.project_id
    WHERE r.score >= 6 AND r.status = 'open'
  `).all() as Array<{ id: number; title: string; project_name: string; score: number }>

  const notifications: Array<{ type: string; title: string; message: string; entity_type: string; entity_id: number; priority: string; created_at: string }> = []

  for (const p of overBudgetProjects) {
    const pct = Math.round((p.spent / p.budget) * 100)
    notifications.push({
      type: 'budget_alert',
      title: `Budget Alert: ${p.name}`,
      message: `${pct}% of budget consumed. $${Math.round((p.spent - p.budget) / 1000)}K over budget.`,
      entity_type: 'project', entity_id: p.id,
      priority: p.spent > p.budget ? 'high' : 'medium',
      created_at: new Date().toISOString(),
    })
  }

  for (const t of overdueTasks.slice(0, 5)) {
    notifications.push({
      type: 'overdue_task',
      title: `Overdue: ${t.name}`,
      message: `Task in "${t.project_name}" was due ${t.end_date}`,
      entity_type: 'task', entity_id: t.id,
      priority: 'medium',
      created_at: new Date().toISOString(),
    })
  }

  for (const m of upcomingMilestones) {
    notifications.push({
      type: 'milestone_due',
      title: `Milestone Due Soon: ${m.name}`,
      message: `"${m.project_name}" milestone due on ${m.date}`,
      entity_type: 'milestone', entity_id: m.id,
      priority: 'medium',
      created_at: new Date().toISOString(),
    })
  }

  for (const r of highRisks.slice(0, 5)) {
    notifications.push({
      type: 'high_risk',
      title: `High Risk: ${r.title}`,
      message: `Risk score ${r.score} in project "${r.project_name}" needs attention`,
      entity_type: 'risk', entity_id: r.id,
      priority: 'high',
      created_at: new Date().toISOString(),
    })
  }

  return notifications
}

router.get('/', authenticate, (req: Request, res: Response) => {
  const persisted = db.prepare(`
    SELECT n.*, u.name as user_name FROM notifications n
    LEFT JOIN users u ON u.id = n.user_id
    WHERE n.user_id = ? OR n.user_id IS NULL
    ORDER BY n.created_at DESC LIMIT 50
  `).all(req.user!.userId)

  const systemNotifs = generateSystemNotifications(req.user!.userId)

  const unread = (db.prepare('SELECT COUNT(*) as c FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0').get(req.user!.userId) as { c: number }).c

  res.json({
    notifications: persisted,
    systemAlerts: systemNotifs,
    unreadCount: unread + systemNotifs.length,
  })
})

router.post('/:id/read', authenticate, (req: Request, res: Response) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id = ? OR user_id IS NULL)').run(req.params.id, req.user!.userId)
  res.json({ success: true })
})

router.post('/read-all', authenticate, (req: Request, res: Response) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL').run(req.user!.userId)
  res.json({ success: true })
})

export default router
