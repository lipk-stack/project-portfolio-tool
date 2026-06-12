import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'
import { computeEarnedSchedule } from '../lib/earnedSchedule'

const router = Router()

interface ProjectRow {
  id: number
  budget: number
  spent: number
  start_date: string | null
  end_date: string | null
  baseline_start: string | null
  baseline_end: string | null
  baseline_budget: number | null
  completion_percent: number
}

interface TaskRow {
  estimated_hours: number
  actual_hours: number
  completion_percent: number
  start_date: string | null
  end_date: string | null
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

router.get('/project/:id', authenticate, (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const tasks = db.prepare(`
    SELECT estimated_hours, actual_hours, completion_percent, start_date, end_date
    FROM tasks WHERE project_id = ? AND parent_id IS NULL
  `).all(req.params.id) as TaskRow[]

  const BAC = project.baseline_budget ?? project.budget
  const AC = project.spent
  const completionFrac = (project.completion_percent || 0) / 100
  const EV = BAC * completionFrac

  // Planned Value: linear over schedule from start to today
  const start = project.baseline_start || project.start_date
  const end = project.baseline_end || project.end_date
  const now = new Date()
  let plannedFrac = 0
  if (start && end) {
    const s = new Date(start), e = new Date(end)
    const total = daysBetween(s, e) || 1
    const elapsed = daysBetween(s, now)
    plannedFrac = Math.min(1, Math.max(0, elapsed / total))
  }
  const PV = BAC * plannedFrac

  const CV = EV - AC
  const SV = EV - PV
  const CPI = AC > 0 ? EV / AC : 0
  const SPI = PV > 0 ? EV / PV : 0
  const EAC = CPI > 0 ? BAC / CPI : BAC
  const ETC = EAC - AC
  const VAC = BAC - EAC
  const TCPI = (BAC - AC) > 0 ? (BAC - EV) / (BAC - AC) : 0

  // Forecast: optimistic, expected, pessimistic schedule slip in days
  let scheduleSlipDays = 0
  if (start && end && SPI > 0) {
    const total = daysBetween(new Date(start), new Date(end))
    scheduleSlipDays = Math.round(total / SPI - total)
  }

  // S-curve data: planned vs earned vs actual cumulative cost over time
  const sCurve: Array<{ date: string; planned: number; earned: number; actual: number }> = []
  if (start && end) {
    const s = new Date(start), e = new Date(end)
    const total = daysBetween(s, e) || 1
    const points = 12
    const step = Math.max(1, Math.round(total / points))
    let cum = 0
    for (let i = 0; i <= points; i++) {
      const d = new Date(s)
      d.setDate(d.getDate() + i * step)
      const frac = Math.min(1, (i * step) / total)
      const isPast = d <= now
      cum = BAC * frac
      sCurve.push({
        date: d.toISOString().slice(0, 10),
        planned: Math.round(cum),
        earned: isPast ? Math.round(EV * frac / Math.max(plannedFrac, 0.001)) : 0,
        actual: isPast ? Math.round(AC * frac / Math.max(plannedFrac, 0.001)) : 0,
      })
    }
  }

  const earnedSchedule = start && end ? computeEarnedSchedule({ BAC, EV, start, end }) : null

  res.json({
    project: { id: project.id, BAC, AC, EV, PV },
    earnedSchedule,
    metrics: {
      BAC: Math.round(BAC),
      AC: Math.round(AC),
      EV: Math.round(EV),
      PV: Math.round(PV),
      CV: Math.round(CV),
      SV: Math.round(SV),
      CPI: Number(CPI.toFixed(3)),
      SPI: Number(SPI.toFixed(3)),
      EAC: Math.round(EAC),
      ETC: Math.round(ETC),
      VAC: Math.round(VAC),
      TCPI: Number(TCPI.toFixed(3)),
      scheduleSlipDays,
      completionPercent: project.completion_percent,
      plannedPercent: Math.round(plannedFrac * 100),
    },
    interpretation: {
      cost: CPI >= 1 ? 'under-budget' : CPI >= 0.95 ? 'on-budget' : 'over-budget',
      schedule: SPI >= 1 ? 'ahead' : SPI >= 0.95 ? 'on-schedule' : 'behind',
      health: CPI >= 0.95 && SPI >= 0.95 ? 'green' : CPI >= 0.85 && SPI >= 0.85 ? 'yellow' : 'red',
    },
    sCurve,
    taskCount: tasks.length,
  })
})

router.post('/project/:id/baseline', authenticate, (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined
  if (!project) return res.status(404).json({ error: 'Project not found' })

  db.prepare(`
    UPDATE projects SET baseline_start = ?, baseline_end = ?, baseline_budget = ?,
      baseline_captured_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(project.start_date, project.end_date, project.budget, req.params.id)

  db.prepare(`
    UPDATE tasks SET baseline_start = start_date, baseline_end = end_date,
      baseline_hours = estimated_hours WHERE project_id = ?
  `).run(req.params.id)

  db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)')
    .run('project', req.params.id, req.user!.userId, 'baseline_captured', JSON.stringify({ at: new Date().toISOString() }))

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  res.json({ project: updated })
})

router.delete('/project/:id/baseline', authenticate, (req: Request, res: Response) => {
  db.prepare('UPDATE projects SET baseline_start = NULL, baseline_end = NULL, baseline_budget = NULL, baseline_captured_at = NULL WHERE id = ?').run(req.params.id)
  db.prepare('UPDATE tasks SET baseline_start = NULL, baseline_end = NULL, baseline_hours = NULL WHERE project_id = ?').run(req.params.id)
  res.json({ success: true })
})

router.get('/portfolio/summary', authenticate, (_req: Request, res: Response) => {
  const projects = db.prepare(`
    SELECT id, name, budget, spent, completion_percent, baseline_budget,
      baseline_start, baseline_end, start_date, end_date, health, color
    FROM projects WHERE status NOT IN ('cancelled')
  `).all() as Array<ProjectRow & { name: string; health: string; color: string }>

  const now = new Date()
  const summary = projects.map(p => {
    const BAC = p.baseline_budget ?? p.budget
    const AC = p.spent
    const EV = BAC * ((p.completion_percent || 0) / 100)
    const start = p.baseline_start || p.start_date
    const end = p.baseline_end || p.end_date
    let plannedFrac = 0
    if (start && end) {
      const s = new Date(start), e = new Date(end)
      const total = daysBetween(s, e) || 1
      plannedFrac = Math.min(1, Math.max(0, daysBetween(s, now) / total))
    }
    const PV = BAC * plannedFrac
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      health: p.health,
      CPI: AC > 0 ? Number((EV / AC).toFixed(3)) : 1,
      SPI: PV > 0 ? Number((EV / PV).toFixed(3)) : 1,
      EV: Math.round(EV),
      AC: Math.round(AC),
      PV: Math.round(PV),
      BAC: Math.round(BAC),
      completion: p.completion_percent,
    }
  })

  const totalBAC = summary.reduce((s, x) => s + x.BAC, 0)
  const totalAC = summary.reduce((s, x) => s + x.AC, 0)
  const totalEV = summary.reduce((s, x) => s + x.EV, 0)
  const totalPV = summary.reduce((s, x) => s + x.PV, 0)

  res.json({
    portfolio: {
      BAC: totalBAC,
      AC: totalAC,
      EV: totalEV,
      PV: totalPV,
      CPI: totalAC > 0 ? Number((totalEV / totalAC).toFixed(3)) : 1,
      SPI: totalPV > 0 ? Number((totalEV / totalPV).toFixed(3)) : 1,
    },
    projects: summary,
  })
})

export default router
