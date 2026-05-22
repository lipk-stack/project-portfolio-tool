import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/summary', authenticate, (_req: Request, res: Response) => {
  const totalProjects = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number }).c
  const activeProjects = (db.prepare("SELECT COUNT(*) as c FROM projects WHERE status = 'active'").get() as { c: number }).c
  const onTrack = (db.prepare("SELECT COUNT(*) as c FROM projects WHERE health = 'green' AND status = 'active'").get() as { c: number }).c
  const atRisk = (db.prepare("SELECT COUNT(*) as c FROM projects WHERE health = 'yellow' AND status = 'active'").get() as { c: number }).c
  const behind = (db.prepare("SELECT COUNT(*) as c FROM projects WHERE health = 'red' AND status = 'active'").get() as { c: number }).c
  const completed = (db.prepare("SELECT COUNT(*) as c FROM projects WHERE status = 'completed'").get() as { c: number }).c

  const budgetData = db.prepare('SELECT SUM(budget) as total_budget, SUM(spent) as total_spent FROM projects WHERE status != ?').get('cancelled') as { total_budget: number, total_spent: number }

  const openRisks = (db.prepare("SELECT COUNT(*) as c FROM risks WHERE status = 'open'").get() as { c: number }).c
  const highRisks = (db.prepare("SELECT COUNT(*) as c FROM risks WHERE status != 'closed' AND score >= 6").get() as { c: number }).c

  const upcomingMilestones = db.prepare(`
    SELECT m.*, p.name as project_name, p.color as project_color
    FROM milestones m
    JOIN projects p ON p.id = m.project_id
    WHERE m.status = 'upcoming' AND m.date >= date('now') AND m.date <= date('now', '+30 days')
    ORDER BY m.date ASC LIMIT 5
  `).all()

  const recentActivity = db.prepare(`
    SELECT a.*, u.name as user_name, u.email as user_email,
           p.name as project_name
    FROM activity_log a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN projects p ON p.id = a.entity_id AND a.entity_type = 'project'
    ORDER BY a.created_at DESC LIMIT 10
  `).all()

  const portfolioHealth = db.prepare(`
    SELECT p.id, p.name, p.status, p.health, p.priority, p.completion_percent,
           p.budget, p.spent, p.start_date, p.end_date, p.color,
           u.name as manager_name,
           (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
           (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as done_count
    FROM projects p
    LEFT JOIN users u ON u.id = p.manager_id
    WHERE p.status != 'cancelled'
    ORDER BY p.priority DESC, p.health ASC
  `).all()

  const resourceUtilization = db.prepare(`
    SELECT u.id, u.name, u.department, u.capacity,
           COALESCE(SUM(pm.allocation_percent), 0) as total_allocation,
           COUNT(DISTINCT pm.project_id) as project_count
    FROM users u
    LEFT JOIN project_members pm ON pm.user_id = u.id
    LEFT JOIN projects p ON p.id = pm.project_id AND p.status = 'active'
    WHERE u.role != 'admin'
    GROUP BY u.id
    ORDER BY total_allocation DESC
    LIMIT 8
  `).all()

  const weeklyHours = db.prepare(`
    SELECT date, SUM(hours) as total_hours
    FROM time_entries
    WHERE date >= date('now', '-28 days')
    GROUP BY date
    ORDER BY date ASC
  `).all()

  const overdueTasks = db.prepare(`
    SELECT t.id, t.name, t.status, t.priority, t.end_date,
           t.completion_percent, t.assignee_id,
           u.name as assignee_name,
           p.name as project_name, p.color as project_color, p.id as project_id
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.end_date < date('now')
    AND t.status NOT IN ('done', 'cancelled')
    AND p.status = 'active'
    AND t.parent_id IS NULL
    ORDER BY t.end_date ASC
    LIMIT 8
  `).all()

  const todayMilestones = db.prepare(`
    SELECT m.*, p.name as project_name, p.color as project_color
    FROM milestones m
    JOIN projects p ON p.id = m.project_id
    WHERE m.date = date('now') AND m.status = 'upcoming'
  `).all()

  res.json({
    kpis: {
      totalProjects,
      activeProjects,
      onTrack,
      atRisk,
      behind,
      completed,
      totalBudget: budgetData.total_budget || 0,
      totalSpent: budgetData.total_spent || 0,
      budgetUtilization: budgetData.total_budget ? Math.round((budgetData.total_spent / budgetData.total_budget) * 100) : 0,
      openRisks,
      highRisks,
    },
    upcomingMilestones,
    recentActivity,
    portfolioHealth,
    resourceUtilization,
    weeklyHours,
    overdueTasks,
    todayMilestones,
  })
})

export default router
