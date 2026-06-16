import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'
import { computeEarnedSchedule } from '../lib/earnedSchedule'
import { computeProjectHealth, ProjectHealthResult } from '../lib/projectHealth'

const router = Router()

interface ProjectRow {
  id: number
  name: string
  status: string
  color: string
  health: string
  priority: string
  completion_percent: number
  budget: number
  spent: number
  baseline_budget: number | null
  baseline_start: string | null
  baseline_end: string | null
  start_date: string | null
  end_date: string | null
}

// A risk is considered "critical" when its probability×impact score reaches the
// high×high band. Scores are low1/med2/high3/crit4 per axis (see risks route),
// so 9 = high×high. Mirrors the dashboard's escalation threshold conceptually.
const CRITICAL_RISK_SCORE = 9

// Gathers the raw signals for one project and runs the pure health engine.
function healthForProject(p: ProjectRow): ProjectHealthResult & { id: number; name: string; color: string; storedHealth: string; priority: string } {
  const BAC = p.baseline_budget ?? p.budget
  const EV = BAC * ((p.completion_percent || 0) / 100)
  const start = p.baseline_start || p.start_date
  const end = p.baseline_end || p.end_date
  const es = start && end ? computeEarnedSchedule({ BAC, EV, start, end }) : null

  const openRiskCount = (db.prepare(
    "SELECT COUNT(*) as c FROM risks WHERE project_id = ? AND status NOT IN ('closed', 'accepted')"
  ).get(p.id) as { c: number }).c
  const criticalRiskCount = (db.prepare(
    "SELECT COUNT(*) as c FROM risks WHERE project_id = ? AND status NOT IN ('closed', 'accepted') AND score >= ?"
  ).get(p.id, CRITICAL_RISK_SCORE) as { c: number }).c

  const totalTasks = (db.prepare('SELECT COUNT(*) as c FROM tasks WHERE project_id = ?').get(p.id) as { c: number }).c
  const overdueTasks = (db.prepare(
    "SELECT COUNT(*) as c FROM tasks WHERE project_id = ? AND status != 'done' AND end_date IS NOT NULL AND date(end_date) < date('now')"
  ).get(p.id) as { c: number }).c

  const result = computeProjectHealth({
    name: p.name,
    status: p.status,
    completionPercent: p.completion_percent,
    spit: es ? es.SPIt : null,
    forecastSlipDays: es ? es.forecastSlipDays : null,
    budget: p.budget,
    spent: p.spent,
    openRiskCount,
    criticalRiskCount,
    totalTasks,
    overdueTasks,
  })

  return { ...result, id: p.id, name: p.name, color: p.color, storedHealth: p.health, priority: p.priority }
}

const PROJECT_COLUMNS = `id, name, status, color, health, priority, completion_percent,
  budget, spent, baseline_budget, baseline_start, baseline_end, start_date, end_date`

// Single-project health with factors and the auto-narrative.
router.get('/project/:id', authenticate, (req: Request, res: Response) => {
  const p = db.prepare(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ?`).get(req.params.id) as ProjectRow | undefined
  if (!p) return res.status(404).json({ error: 'Project not found' })
  res.json(healthForProject(p))
})

// Portfolio rollup: every active project scored, plus aggregate counts and the
// lowest-scoring projects called out for an at-a-glance executive view.
router.get('/portfolio', authenticate, (_req: Request, res: Response) => {
  const projects = db.prepare(
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE status NOT IN ('cancelled') ORDER BY priority DESC, name ASC`
  ).all() as ProjectRow[]

  const scored = projects.map(healthForProject)
  const counts = { green: 0, amber: 0, red: 0 }
  for (const s of scored) counts[s.rag]++

  const avgScore = scored.length
    ? Math.round(scored.reduce((sum, s) => sum + s.score, 0) / scored.length)
    : 100
  const overallRag: 'green' | 'amber' | 'red' = avgScore >= 80 ? 'green' : avgScore >= 55 ? 'amber' : 'red'

  const attention = scored
    .filter((s) => s.rag !== 'green')
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((s) => ({ id: s.id, name: s.name, score: s.score, rag: s.rag, color: s.color, headline: s.headline }))

  res.json({
    overall: { score: avgScore, rag: overallRag, projectCount: scored.length, counts },
    needsAttention: attention,
    projects: scored.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      score: s.score,
      rag: s.rag,
      cpi: s.cpi,
      priority: s.priority,
      factors: s.factors,
    })),
  })
})

export default router
