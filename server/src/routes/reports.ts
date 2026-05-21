import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

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

router.get('/evm/:projectId', authenticate, (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as Record<string, any> | undefined
  if (!project) return res.status(404).json({ error: 'Not found' })

  const budget = project.budget || 0
  const spent = project.spent || 0
  const completion = (project.completion_percent || 0) / 100

  const start = project.start_date ? new Date(project.start_date) : new Date()
  const end = project.end_date ? new Date(project.end_date) : new Date()
  const now = new Date()
  const totalDays = Math.max(1, (end.getTime() - start.getTime()) / 86400000)
  const elapsedDays = Math.max(0, (now.getTime() - start.getTime()) / 86400000)
  const plannedPct = Math.min(1, elapsedDays / totalDays)

  const PV = budget * plannedPct
  const EV = budget * completion
  const AC = spent
  const SPI = PV > 0 ? EV / PV : 1
  const CPI = AC > 0 ? EV / AC : 1
  const EAC = CPI > 0 ? budget / CPI : budget
  const ETC = Math.max(0, EAC - AC)
  const VAC = budget - EAC
  const CV = EV - AC
  const SV = EV - PV

  // Monthly S-curve data
  const sCurveData: Array<{ month: string; planned: number; actual: number; earned: number }> = []
  const monthCount = Math.ceil(totalDays / 30)
  for (let i = 0; i <= Math.min(monthCount, 24); i++) {
    const d = new Date(start)
    d.setMonth(d.getMonth() + i)
    const pct = Math.min(1, i / monthCount)
    const isElapsed = d <= now
    sCurveData.push({
      month: d.toISOString().slice(0, 7),
      planned: Math.round(budget * pct),
      actual: isElapsed ? Math.round(spent * (pct / Math.min(1, plannedPct || 1))) : 0,
      earned: isElapsed ? Math.round(EV * (pct / Math.min(1, plannedPct || 1))) : 0,
    })
  }

  res.json({
    PV: Math.round(PV), EV: Math.round(EV), AC: Math.round(AC),
    SPI: Math.round(SPI * 100) / 100,
    CPI: Math.round(CPI * 100) / 100,
    EAC: Math.round(EAC), ETC: Math.round(ETC), VAC: Math.round(VAC),
    CV: Math.round(CV), SV: Math.round(SV),
    budget, completion: project.completion_percent,
    plannedPct: Math.round(plannedPct * 100),
    sCurveData,
  })
})

router.get('/insights', authenticate, (_req: Request, res: Response) => {
  const insights: Array<{ type: string; severity: string; title: string; detail: string }> = []

  const budgetRisk = db.prepare(`
    SELECT name, budget, spent, ROUND(CAST(spent as REAL)/budget*100,1) as pct
    FROM projects WHERE budget > 0 AND CAST(spent as REAL)/budget > 0.85 AND status = 'active'
    ORDER BY pct DESC LIMIT 5
  `).all() as Array<{ name: string; pct: number }>

  for (const p of budgetRisk) {
    insights.push({
      type: 'budget',
      severity: p.pct >= 100 ? 'critical' : 'warning',
      title: p.pct >= 100 ? `${p.name} exceeded budget` : `${p.name} at ${p.pct}% budget`,
      detail: p.pct >= 100 ? 'Budget overrun — review scope or request increase' : 'Budget consumption exceeds planned rate',
    })
  }

  const overdueCount = (db.prepare(`
    SELECT COUNT(*) as c FROM tasks
    WHERE end_date < date('now') AND status NOT IN ('done', 'cancelled') AND end_date IS NOT NULL
  `).get() as { c: number }).c
  if (overdueCount > 0) {
    insights.push({ type: 'schedule', severity: overdueCount > 10 ? 'critical' : 'warning', title: `${overdueCount} tasks are overdue`, detail: 'Past due dates — review workload and timelines' })
  }

  const overallocated = db.prepare(`
    SELECT u.name, SUM(pm.allocation_percent) as total
    FROM users u JOIN project_members pm ON pm.user_id = u.id
    JOIN projects p ON p.id = pm.project_id AND p.status = 'active'
    GROUP BY u.id HAVING total > 100 LIMIT 3
  `).all() as Array<{ name: string; total: number }>

  for (const r of overallocated) {
    insights.push({ type: 'resource', severity: 'warning', title: `${r.name} is overallocated at ${r.total}%`, detail: 'Consider reducing assignments or extending timelines' })
  }

  const unassigned = (db.prepare(`
    SELECT COUNT(*) as c FROM tasks
    WHERE assignee_id IS NULL AND priority IN ('critical', 'high') AND status NOT IN ('done', 'cancelled')
  `).get() as { c: number }).c
  if (unassigned > 0) {
    insights.push({ type: 'resource', severity: 'info', title: `${unassigned} critical/high tasks unassigned`, detail: 'Assign owners to ensure accountability' })
  }

  const highRisks = (db.prepare(`
    SELECT COUNT(*) as c FROM risks WHERE score >= 6 AND status = 'open'
  `).get() as { c: number }).c
  if (highRisks > 0) {
    insights.push({ type: 'risk', severity: 'critical', title: `${highRisks} open high-severity risks`, detail: 'Action required on risk mitigation plans' })
  }

  const upcoming = db.prepare(`
    SELECT m.name, p.name as project_name,
           CAST(julianday(m.date) - julianday('now') as INTEGER) as days_left
    FROM milestones m JOIN projects p ON p.id = m.project_id
    WHERE m.status = 'upcoming' AND m.date >= date('now') AND m.date <= date('now', '+14 days')
    ORDER BY days_left ASC LIMIT 3
  `).all() as Array<{ name: string; project_name: string; days_left: number }>

  for (const m of upcoming) {
    insights.push({
      type: 'milestone',
      severity: m.days_left <= 3 ? 'critical' : m.days_left <= 7 ? 'warning' : 'info',
      title: `"${m.name}" in ${m.days_left} day${m.days_left !== 1 ? 's' : ''}`,
      detail: m.project_name,
    })
  }

  const redProjects = db.prepare(`SELECT COUNT(*) as c FROM projects WHERE health = 'red' AND status = 'active'`).get() as { c: number }
  if (redProjects.c > 0) {
    insights.push({ type: 'health', severity: 'critical', title: `${redProjects.c} projects off track`, detail: 'Immediate attention needed — review blockers' })
  }

  res.json({ insights: insights.slice(0, 8) })
})

router.get('/burndown/:projectId', authenticate, (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as Record<string, any> | undefined
  if (!project) return res.status(404).json({ error: 'Not found' })

  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? AND parent_id IS NULL').all(req.params.projectId) as Array<Record<string, any>>
  const total = tasks.length
  if (total === 0) return res.json({ data: [], total: 0 })

  const start = project.start_date ? new Date(project.start_date) : new Date()
  const end = project.end_date ? new Date(project.end_date) : new Date()
  const now = new Date()
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))

  const doneTasks = db.prepare(`
    SELECT date(updated_at) as done_date, COUNT(*) as cnt
    FROM tasks WHERE project_id = ? AND status = 'done' AND parent_id IS NULL
    GROUP BY done_date ORDER BY done_date
  `).all(req.params.projectId) as Array<{ done_date: string; cnt: number }>

  const doneByDate: Record<string, number> = {}
  for (const d of doneTasks) doneByDate[d.done_date] = d.cnt

  const data: Array<{ date: string; ideal: number; actual: number | null }> = []
  let cumulativeDone = 0
  const stepDays = Math.max(1, Math.ceil(days / 20))

  for (let i = 0; i <= days; i += stepDays) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const ideal = Math.max(0, total - Math.round((total * i) / days))

    // Count tasks completed by this date
    for (const [date, cnt] of Object.entries(doneByDate)) {
      if (date <= dateStr && !data.some(x => x.date >= date)) {
        cumulativeDone += cnt
      }
    }

    data.push({
      date: dateStr,
      ideal,
      actual: d <= now ? Math.max(0, total - cumulativeDone) : null,
    })
  }

  res.json({ data, total })
})

export default router
