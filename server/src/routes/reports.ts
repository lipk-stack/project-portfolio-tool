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

// EVM (Earned Value Management) metrics
router.get('/evm', (_req, res) => {
  const projects = db.prepare(`
    SELECT id, name, color, budget, spent, completion_percent, start_date, end_date, status
    FROM projects WHERE status = 'active'
  `).all() as any[]

  const evmData = projects.map((p: any) => {
    const budget = p.budget || 0
    const spent = p.spent || 0
    const completion = (p.completion_percent || 0) / 100

    // EVM calculations
    const BAC = budget                           // Budget at Completion
    const BCWP = BAC * completion                // Earned Value (EV)
    const ACWP = spent                           // Actual Cost (AC)

    // Schedule variance - estimate planned % based on timeline
    let plannedPct = completion
    if (p.start_date && p.end_date) {
      const start = new Date(p.start_date).getTime()
      const end = new Date(p.end_date).getTime()
      const now = Date.now()
      plannedPct = Math.min(1, Math.max(0, (now - start) / (end - start)))
    }
    const BCWS = BAC * plannedPct               // Planned Value (PV)

    const CV = BCWP - ACWP                       // Cost Variance
    const SV = BCWP - BCWS                       // Schedule Variance
    const CPI = ACWP > 0 ? BCWP / ACWP : 1     // Cost Performance Index
    const SPI = BCWS > 0 ? BCWP / BCWS : 1     // Schedule Performance Index
    const EAC = CPI > 0 ? BAC / CPI : BAC       // Estimate at Completion
    const ETC = EAC - ACWP                       // Estimate to Complete
    const VAC = BAC - EAC                        // Variance at Completion
    const TCPI = (EAC - ACWP) > 0 ? (BAC - BCWP) / (EAC - ACWP) : 1  // To Complete Performance Index

    return {
      id: p.id,
      name: p.name,
      color: p.color,
      status: p.status,
      BAC, BCWP, ACWP, BCWS,
      CV: Math.round(CV),
      SV: Math.round(SV),
      CPI: Math.round(CPI * 100) / 100,
      SPI: Math.round(SPI * 100) / 100,
      EAC: Math.round(EAC),
      ETC: Math.round(ETC),
      VAC: Math.round(VAC),
      TCPI: Math.round(TCPI * 100) / 100,
      completion_percent: p.completion_percent,
      planned_percent: Math.round(plannedPct * 100),
    }
  })

  // Portfolio totals
  const totals = evmData.reduce((acc: any, p: any) => ({
    BAC: acc.BAC + p.BAC,
    BCWP: acc.BCWP + p.BCWP,
    ACWP: acc.ACWP + p.ACWP,
    BCWS: acc.BCWS + p.BCWS,
  }), { BAC: 0, BCWP: 0, ACWP: 0, BCWS: 0 })

  const portfolioCPI = totals.ACWP > 0 ? totals.BCWP / totals.ACWP : 1
  const portfolioSPI = totals.BCWS > 0 ? totals.BCWP / totals.BCWS : 1
  const portfolioEAC = portfolioCPI > 0 ? totals.BAC / portfolioCPI : totals.BAC

  res.json({
    projects: evmData,
    portfolio: {
      ...totals,
      CPI: Math.round(portfolioCPI * 100) / 100,
      SPI: Math.round(portfolioSPI * 100) / 100,
      EAC: Math.round(portfolioEAC),
      VAC: Math.round(totals.BAC - portfolioEAC),
    }
  })
})

// Burndown data for a project
router.get('/burndown/:projectId', (req, res) => {
  const { projectId } = req.params

  const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId) as any
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const tasks = db.prepare(`
    SELECT id, status, story_points, estimated_hours, created_at, updated_at, end_date
    FROM tasks WHERE project_id = ? AND parent_id IS NULL
  `).all(projectId) as any[]

  const totalPoints = tasks.reduce((s: number, t: any) => s + (t.story_points || 1), 0)

  // Generate ideal burndown line
  const startDate = project.start_date ? new Date(project.start_date) : new Date()
  const endDate = project.end_date ? new Date(project.end_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))

  // Create weekly data points
  const burndown: Array<{ date: string; ideal: number; actual: number; completed: number }> = []
  const weeks = Math.ceil(totalDays / 7)

  for (let w = 0; w <= weeks; w++) {
    const date = new Date(startDate.getTime() + w * 7 * 24 * 60 * 60 * 1000)
    if (date > new Date()) break

    const ideal = Math.max(0, totalPoints * (1 - w / weeks))
    const completedByDate = tasks.filter((t: any) =>
      t.status === 'done' && t.updated_at && new Date(t.updated_at) <= date
    ).reduce((s: number, t: any) => s + (t.story_points || 1), 0)

    burndown.push({
      date: date.toISOString().split('T')[0],
      ideal: Math.round(ideal),
      actual: Math.max(0, totalPoints - completedByDate),
      completed: completedByDate,
    })
  }

  // Add today if project is still active
  if (new Date() <= endDate) {
    const doneTasks = tasks.filter((t: any) => t.status === 'done')
    const completedPoints = doneTasks.reduce((s: number, t: any) => s + (t.story_points || 1), 0)
    const elapsedDays = (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    burndown.push({
      date: new Date().toISOString().split('T')[0],
      ideal: Math.max(0, Math.round(totalPoints * (1 - elapsedDays / totalDays))),
      actual: Math.max(0, totalPoints - completedPoints),
      completed: completedPoints,
    })
  }

  res.json({ burndown, totalPoints, project: { name: project.name, color: project.color } })
})

// Portfolio roadmap data
router.get('/roadmap', (_req, res) => {
  const projects = db.prepare(`
    SELECT p.*, po.name as portfolio_name, u.name as manager_name,
           COUNT(DISTINCT t.id) as task_count,
           COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as done_tasks
    FROM projects p
    LEFT JOIN portfolios po ON po.id = p.portfolio_id
    LEFT JOIN users u ON u.id = p.manager_id
    LEFT JOIN tasks t ON t.project_id = p.id AND t.parent_id IS NULL
    WHERE p.status NOT IN ('cancelled')
    GROUP BY p.id
    ORDER BY p.start_date ASC
  `).all()

  const milestones = db.prepare(`
    SELECT m.*, p.color as project_color, p.name as project_name
    FROM milestones m
    JOIN projects p ON p.id = m.project_id
    ORDER BY m.date ASC
  `).all()

  res.json({ projects, milestones })
})

export default router
