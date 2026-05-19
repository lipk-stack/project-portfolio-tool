import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(',')
  const lines = rows.map(row =>
    columns.map(col => {
      const val = row[col]
      if (val === null || val === undefined) return ''
      const str = String(val)
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"` : str
    }).join(',')
  )
  return [header, ...lines].join('\n')
}

router.get('/project/:projectId/tasks', authenticate, (req: Request, res: Response) => {
  const tasks = db.prepare(`
    SELECT t.wbs_code, t.name, t.status, t.priority, u.name as assignee,
      t.start_date, t.end_date, t.estimated_hours, t.actual_hours,
      t.completion_percent, t.sprint, t.story_points,
      CASE WHEN t.is_critical = 1 THEN 'Yes' ELSE 'No' END as critical_path
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.project_id = ?
    ORDER BY t.position ASC
  `).all(req.params.projectId) as Record<string, unknown>[]

  const csv = toCsv(tasks, ['wbs_code', 'name', 'status', 'priority', 'assignee', 'start_date', 'end_date', 'estimated_hours', 'actual_hours', 'completion_percent', 'sprint', 'story_points', 'critical_path'])

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="tasks-project-${req.params.projectId}.csv"`)
  res.send(csv)
})

router.get('/project/:projectId/risks', authenticate, (req: Request, res: Response) => {
  const risks = db.prepare(`
    SELECT r.title, r.category, r.probability, r.impact, r.score, r.status,
      r.response, r.mitigation_plan, r.identified_date, r.target_date,
      u.name as owner
    FROM risks r LEFT JOIN users u ON u.id = r.owner_id
    WHERE r.project_id = ?
    ORDER BY r.score DESC
  `).all(req.params.projectId) as Record<string, unknown>[]

  const csv = toCsv(risks, ['title', 'category', 'probability', 'impact', 'score', 'status', 'response', 'mitigation_plan', 'owner', 'identified_date', 'target_date'])
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="risks-project-${req.params.projectId}.csv"`)
  res.send(csv)
})

router.get('/portfolio/summary', authenticate, (_req: Request, res: Response) => {
  const projects = db.prepare(`
    SELECT p.name, po.name as portfolio, p.status, p.health, p.priority, p.phase,
      p.start_date, p.end_date, p.completion_percent, p.budget, p.spent,
      CASE WHEN p.budget > 0 THEN ROUND((p.spent/p.budget)*100,1) ELSE 0 END as budget_used_pct,
      u.name as manager,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as total_tasks,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as done_tasks,
      (SELECT COUNT(*) FROM risks r WHERE r.project_id = p.id AND r.status != 'closed') as open_risks
    FROM projects p
    LEFT JOIN portfolios po ON po.id = p.portfolio_id
    LEFT JOIN users u ON u.id = p.manager_id
    ORDER BY p.priority DESC
  `).all() as Record<string, unknown>[]

  const csv = toCsv(projects, ['name', 'portfolio', 'status', 'health', 'priority', 'phase', 'start_date', 'end_date', 'completion_percent', 'budget', 'spent', 'budget_used_pct', 'manager', 'total_tasks', 'done_tasks', 'open_risks'])
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="portfolio-summary.csv"')
  res.send(csv)
})

router.get('/portfolio/timelog', authenticate, (_req: Request, res: Response) => {
  const entries = db.prepare(`
    SELECT te.date, p.name as project, t.name as task, u.name as team_member,
      u.department, te.hours, te.description, ROUND(te.hours * u.hourly_rate, 2) as cost
    FROM time_entries te
    JOIN projects p ON p.id = te.project_id
    JOIN users u ON u.id = te.user_id
    LEFT JOIN tasks t ON t.id = te.task_id
    ORDER BY te.date DESC
  `).all() as Record<string, unknown>[]

  const csv = toCsv(entries, ['date', 'project', 'task', 'team_member', 'department', 'hours', 'cost', 'description'])
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="portfolio-timelog.csv"')
  res.send(csv)
})

export default router
