import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const project = db.prepare('SELECT id, name, budget, spent FROM projects WHERE id = ?').get(req.params.projectId)
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const lines = db.prepare('SELECT * FROM budget_lines WHERE project_id = ? ORDER BY category, created_at').all(req.params.projectId)

  const byCategory = db.prepare(`
    SELECT category,
      SUM(planned_amount) as planned,
      SUM(actual_amount) as actual
    FROM budget_lines WHERE project_id = ? GROUP BY category
  `).all(req.params.projectId)

  const timeSpend = db.prepare(`
    SELECT strftime('%Y-%m', te.date) as month, SUM(te.hours * u.hourly_rate) as labor_cost, SUM(te.hours) as hours
    FROM time_entries te JOIN users u ON u.id = te.user_id
    WHERE te.project_id = ? AND te.date >= date('now', '-6 months')
    GROUP BY month ORDER BY month
  `).all(req.params.projectId)

  res.json({ project, lines, byCategory, timeSpend })
})

router.get('/project/:projectId/cashflow', authenticate, (req: Request, res: Response) => {
  const project = db.prepare('SELECT id, name, start_date, end_date, budget, spent FROM projects WHERE id = ?').get(req.params.projectId) as
    { id: number; name: string; start_date: string | null; end_date: string | null; budget: number; spent: number } | undefined
  if (!project) return res.status(404).json({ error: 'Project not found' })
  if (!project.start_date || !project.end_date) return res.json({ months: [] })

  // Month buckets across the project schedule
  const months: string[] = []
  const cur = new Date(project.start_date.slice(0, 7) + '-01T00:00:00Z')
  const last = new Date(project.end_date.slice(0, 7) + '-01T00:00:00Z')
  while (cur <= last && months.length < 60) {
    months.push(cur.toISOString().slice(0, 7))
    cur.setUTCMonth(cur.getUTCMonth() + 1)
  }
  const monthIdx: Record<string, number> = {}
  months.forEach((m, i) => { monthIdx[m] = i })

  // Planned labor: each task's estimated cost spread evenly across its scheduled months
  const tasks = db.prepare(`
    SELECT t.start_date, t.end_date, t.estimated_hours, COALESCE(u.hourly_rate, 100) as rate
    FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.project_id = ? AND t.start_date IS NOT NULL AND t.end_date IS NOT NULL
  `).all(req.params.projectId) as Array<{ start_date: string; end_date: string; estimated_hours: number; rate: number }>

  const planned = new Array(months.length).fill(0)
  for (const t of tasks) {
    const cost = (t.estimated_hours || 0) * t.rate
    if (cost === 0) continue
    const from = monthIdx[t.start_date.slice(0, 7)]
    const to = monthIdx[t.end_date.slice(0, 7)]
    if (from === undefined && to === undefined) continue
    const a = from ?? 0
    const b = to ?? months.length - 1
    const span = Math.max(1, b - a + 1)
    for (let i = a; i <= b && i < months.length; i++) planned[i] += cost / span
  }

  // Planned non-labor: budget lines other than labor, spread evenly over the whole schedule
  const nonLabor = db.prepare(`
    SELECT COALESCE(SUM(planned_amount), 0) as total FROM budget_lines
    WHERE project_id = ? AND category != 'labor'
  `).get(req.params.projectId) as { total: number }
  for (let i = 0; i < months.length; i++) planned[i] += nonLabor.total / months.length

  // Actuals: logged time cost per month
  const actualRows = db.prepare(`
    SELECT strftime('%Y-%m', te.date) as month, SUM(te.hours * u.hourly_rate) as cost
    FROM time_entries te JOIN users u ON u.id = te.user_id
    WHERE te.project_id = ? GROUP BY month
  `).all(req.params.projectId) as Array<{ month: string; cost: number }>
  const actual = new Array(months.length).fill(0)
  for (const r of actualRows) {
    if (monthIdx[r.month] !== undefined) actual[monthIdx[r.month]] += r.cost
  }
  // Plus non-labor actuals spread over elapsed months
  const nonLaborActual = db.prepare(`
    SELECT COALESCE(SUM(actual_amount), 0) as total FROM budget_lines
    WHERE project_id = ? AND category != 'labor'
  `).get(req.params.projectId) as { total: number }
  const nowMonth = new Date().toISOString().slice(0, 7)
  const elapsed = months.filter(m => m <= nowMonth).length || 1
  for (let i = 0; i < Math.min(elapsed, months.length); i++) actual[i] += nonLaborActual.total / elapsed

  let cumPlanned = 0
  let cumActual = 0
  const result = months.map((month, i) => {
    cumPlanned += planned[i]
    const isFuture = month > nowMonth
    if (!isFuture) cumActual += actual[i]
    return {
      month,
      planned: Math.round(planned[i]),
      actual: isFuture ? null : Math.round(actual[i]),
      cumPlanned: Math.round(cumPlanned),
      cumActual: isFuture ? null : Math.round(cumActual),
    }
  })

  res.json({ project: { id: project.id, name: project.name, budget: project.budget }, months: result })
})

router.post('/project/:projectId/lines', authenticate, (req: Request, res: Response) => {
  const { category, description, planned_amount, actual_amount, period } = req.body
  if (!category) return res.status(400).json({ error: 'Category required' })

  const result = db.prepare('INSERT INTO budget_lines (project_id, category, description, planned_amount, actual_amount, period) VALUES (?, ?, ?, ?, ?, ?)').run(req.params.projectId, category, description || null, planned_amount || 0, actual_amount || 0, period || null)
  const line = db.prepare('SELECT * FROM budget_lines WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ line })
})

router.put('/lines/:id', authenticate, (req: Request, res: Response) => {
  const { category, description, planned_amount, actual_amount, period } = req.body
  db.prepare('UPDATE budget_lines SET category=?, description=?, planned_amount=?, actual_amount=?, period=? WHERE id=?').run(category, description || null, planned_amount || 0, actual_amount || 0, period || null, req.params.id)
  const line = db.prepare('SELECT * FROM budget_lines WHERE id = ?').get(req.params.id)
  res.json({ line })
})

router.delete('/lines/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM budget_lines WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.get('/portfolio/overview', authenticate, (_req: Request, res: Response) => {
  const overview = db.prepare(`
    SELECT p.id, p.name, p.status, p.health, p.color, p.budget, p.spent,
      CASE WHEN p.budget > 0 THEN ROUND((p.spent / p.budget) * 100, 1) ELSE 0 END as budget_utilization,
      p.completion_percent
    FROM projects p
    WHERE p.status != 'cancelled'
    ORDER BY p.budget DESC
  `).all()

  const totals = db.prepare(`
    SELECT SUM(budget) as total_budget, SUM(spent) as total_spent
    FROM projects WHERE status != 'cancelled'
  `).get() as { total_budget: number; total_spent: number }

  const byCategory = db.prepare(`
    SELECT bl.category,
      SUM(bl.planned_amount) as planned,
      SUM(bl.actual_amount) as actual
    FROM budget_lines bl
    JOIN projects p ON p.id = bl.project_id
    WHERE p.status != 'cancelled'
    GROUP BY bl.category
  `).all()

  res.json({ overview, totals, byCategory })
})

export default router
