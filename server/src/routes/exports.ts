import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

function toCSV(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.join(',')
  const body = rows.map(r => columns.map(c => escape(r[c])).join(',')).join('\n')
  return header + '\n' + body
}

function sendCSV(res: Response, filename: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send('﻿' + csv)
}

router.get('/projects.csv', authenticate, (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT p.id, p.name, p.status, p.priority, p.health, p.phase, p.start_date, p.end_date,
      p.completion_percent, p.budget, p.spent, p.baseline_budget,
      u.name as manager, po.name as portfolio
    FROM projects p
    LEFT JOIN users u ON u.id = p.manager_id
    LEFT JOIN portfolios po ON po.id = p.portfolio_id
    ORDER BY p.created_at DESC
  `).all() as Array<Record<string, unknown>>
  const cols = ['id', 'name', 'portfolio', 'status', 'priority', 'health', 'phase', 'manager',
    'start_date', 'end_date', 'completion_percent', 'budget', 'spent', 'baseline_budget']
  sendCSV(res, 'projects.csv', toCSV(rows, cols))
})

router.get('/projects/:id/tasks.csv', authenticate, (req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT t.id, t.wbs_code, t.name, t.status, t.priority, t.start_date, t.end_date,
      t.baseline_start, t.baseline_end, t.estimated_hours, t.actual_hours,
      t.completion_percent, t.is_critical, t.story_points, u.name as assignee
    FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.project_id = ? ORDER BY t.position ASC
  `).all(req.params.id) as Array<Record<string, unknown>>
  const cols = ['id', 'wbs_code', 'name', 'status', 'priority', 'assignee', 'start_date', 'end_date',
    'baseline_start', 'baseline_end', 'estimated_hours', 'actual_hours', 'completion_percent', 'is_critical', 'story_points']
  sendCSV(res, `tasks-project-${req.params.id}.csv`, toCSV(rows, cols))
})

router.get('/projects/:id/risks.csv', authenticate, (req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT r.id, r.title, r.category, r.probability, r.impact, r.score, r.status,
      r.response, r.mitigation_plan, r.identified_date, r.target_date, u.name as owner
    FROM risks r LEFT JOIN users u ON u.id = r.owner_id
    WHERE r.project_id = ? ORDER BY r.score DESC
  `).all(req.params.id) as Array<Record<string, unknown>>
  const cols = ['id', 'title', 'category', 'probability', 'impact', 'score', 'status', 'owner', 'response', 'mitigation_plan', 'identified_date', 'target_date']
  sendCSV(res, `risks-project-${req.params.id}.csv`, toCSV(rows, cols))
})

router.get('/projects/:id/budget.csv', authenticate, (req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT id, category, description, planned_amount, actual_amount, period
    FROM budget_lines WHERE project_id = ? ORDER BY category, id
  `).all(req.params.id) as Array<Record<string, unknown>>
  sendCSV(res, `budget-project-${req.params.id}.csv`, toCSV(rows, ['id', 'category', 'description', 'planned_amount', 'actual_amount', 'period']))
})

router.get('/time-entries.csv', authenticate, (req: Request, res: Response) => {
  const { from, to, user_id, project_id } = req.query
  let query = `
    SELECT te.id, te.date, te.hours, te.description,
      u.name as user, p.name as project, t.name as task
    FROM time_entries te
    LEFT JOIN users u ON u.id = te.user_id
    LEFT JOIN projects p ON p.id = te.project_id
    LEFT JOIN tasks t ON t.id = te.task_id
    WHERE 1=1
  `
  const params: (string | number)[] = []
  if (from) { query += ' AND te.date >= ?'; params.push(from as string) }
  if (to) { query += ' AND te.date <= ?'; params.push(to as string) }
  if (user_id) { query += ' AND te.user_id = ?'; params.push(user_id as string) }
  if (project_id) { query += ' AND te.project_id = ?'; params.push(project_id as string) }
  query += ' ORDER BY te.date DESC'

  const rows = db.prepare(query).all(...params) as Array<Record<string, unknown>>
  sendCSV(res, 'time-entries.csv', toCSV(rows, ['id', 'date', 'user', 'project', 'task', 'hours', 'description']))
})

router.get('/projects/:id.json', authenticate, (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!project) return res.status(404).json({ error: 'Project not found' })
  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY position').all(req.params.id)
  const milestones = db.prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY date').all(req.params.id)
  const risks = db.prepare('SELECT * FROM risks WHERE project_id = ? ORDER BY score DESC').all(req.params.id)
  const budget = db.prepare('SELECT * FROM budget_lines WHERE project_id = ?').all(req.params.id)
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, pm.role, pm.allocation_percent
    FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ?
  `).all(req.params.id)
  const deps = db.prepare(`
    SELECT td.* FROM task_dependencies td
    JOIN tasks t ON t.id = td.predecessor_id WHERE t.project_id = ?
  `).all(req.params.id)

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="project-${req.params.id}.json"`)
  res.send(JSON.stringify({
    exportedAt: new Date().toISOString(),
    exportedBy: req.user!.email,
    project, tasks, milestones, risks, budget, members, dependencies: deps,
  }, null, 2))
})

export default router
