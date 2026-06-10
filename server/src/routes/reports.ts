import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'
import { buildStatusPdf } from '../lib/statusPdf'

const router = Router()

router.get('/project/:id/status.pdf', authenticate, (req: Request, res: Response) => {
  const doc = buildStatusPdf(Number(req.params.id))
  if (!doc) return res.status(404).json({ error: 'Project not found' })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="project-${req.params.id}-status.pdf"`)
  doc.pipe(res)
})

router.get('/overview', authenticate, (_req: Request, res: Response) => {
  const projectsByStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM projects GROUP BY status
  `).all()

  const projectsByHealth = db.prepare(`
    SELECT health, COUNT(*) as count FROM projects WHERE status = 'active' GROUP BY health
  `).all()

  const budgetPerformance = db.prepare(`
    SELECT p.name, p.budget, p.spent, p.completion_percent,
      CASE WHEN p.budget > 0 THEN ROUND((p.spent / p.budget) * 100, 1) ELSE 0 END as spend_rate,
      p.health, p.status, p.color
    FROM projects p WHERE p.status != 'cancelled'
    ORDER BY spend_rate DESC LIMIT 10
  `).all()

  const taskCompletionByProject = db.prepare(`
    SELECT p.name, p.color,
      COUNT(t.id) as total_tasks,
      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_tasks,
      CASE WHEN COUNT(t.id) > 0 THEN ROUND(SUM(CASE WHEN t.status = 'done' THEN 1.0 ELSE 0 END) / COUNT(t.id) * 100, 1) ELSE 0 END as completion_rate
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id AND t.parent_id IS NULL
    WHERE p.status = 'active'
    GROUP BY p.id ORDER BY completion_rate DESC
  `).all()

  const velocityData = db.prepare(`
    SELECT strftime('%Y-%W', t.updated_at) as week,
      SUM(t.story_points) as points_completed
    FROM tasks t
    WHERE t.status = 'done' AND t.updated_at >= datetime('now', '-90 days') AND t.story_points IS NOT NULL
    GROUP BY week ORDER BY week
  `).all()

  const hoursLogged = db.prepare(`
    SELECT p.name, p.color, SUM(te.hours) as total_hours, SUM(te.hours * u.hourly_rate) as total_cost
    FROM time_entries te
    JOIN projects p ON p.id = te.project_id
    JOIN users u ON u.id = te.user_id
    WHERE te.date >= date('now', '-30 days')
    GROUP BY p.id ORDER BY total_hours DESC
  `).all()

  const overdueTaskCount = (db.prepare(`
    SELECT COUNT(*) as c FROM tasks
    WHERE end_date < date('now') AND status NOT IN ('done', 'cancelled') AND end_date IS NOT NULL
  `).get() as { c: number }).c

  const avgProjectCompletion = (db.prepare(`
    SELECT AVG(completion_percent) as avg FROM projects WHERE status = 'active'
  `).get() as { avg: number }).avg

  res.json({
    projectsByStatus,
    projectsByHealth,
    budgetPerformance,
    taskCompletionByProject,
    velocityData,
    hoursLogged,
    overdueTaskCount,
    avgProjectCompletion: Math.round(avgProjectCompletion || 0),
  })
})

router.get('/resource-utilization', authenticate, (_req: Request, res: Response) => {
  const weekly = db.prepare(`
    SELECT u.name, u.department, strftime('%Y-%W', te.date) as week,
      SUM(te.hours) as hours, u.capacity
    FROM time_entries te JOIN users u ON u.id = te.user_id
    WHERE te.date >= date('now', '-12 weeks')
    GROUP BY u.id, week ORDER BY u.name, week
  `).all()

  const byDepartment = db.prepare(`
    SELECT u.department, SUM(te.hours) as total_hours,
      COUNT(DISTINCT u.id) as headcount,
      SUM(u.capacity) as total_capacity
    FROM time_entries te JOIN users u ON u.id = te.user_id
    WHERE te.date >= date('now', '-30 days')
    GROUP BY u.department
  `).all()

  res.json({ weekly, byDepartment })
})

router.get('/critical-path/:projectId', authenticate, (req: Request, res: Response) => {
  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? AND is_critical = 1 ORDER BY start_date ASC').all(req.params.projectId)
  const deps = db.prepare(`
    SELECT td.* FROM task_dependencies td
    JOIN tasks t ON t.id = td.predecessor_id
    WHERE t.project_id = ? AND t.is_critical = 1
  `).all(req.params.projectId)
  res.json({ tasks, dependencies: deps })
})

export default router
