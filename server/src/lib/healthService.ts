// Shared health-scoring data layer. Gathers the raw signals for a project from
// the database and runs the pure computeProjectHealth engine. Also owns the
// health_history persistence: a daily score snapshot per project plus trend
// reads. The route layer (routes/insights.ts), the daily snapshot job (called
// at server startup) and the PDF status report all funnel through here so the
// scoring logic lives in exactly one place.

import { db } from '../database'
import { computeEarnedSchedule } from './earnedSchedule'
import { computeProjectHealth, ProjectHealthResult } from './projectHealth'
import { TrendPoint } from './healthTrend'

export interface ProjectRow {
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

export type ScoredProject = ProjectHealthResult & {
  id: number
  name: string
  color: string
  storedHealth: string
  priority: string
}

// A risk is "critical" when its probability×impact score reaches the high×high
// band. Scores are low1/med2/high3/crit4 per axis (see risks route), so 9 =
// high×high. Mirrors the dashboard's escalation threshold conceptually.
const CRITICAL_RISK_SCORE = 9

export const PROJECT_COLUMNS = `id, name, status, color, health, priority, completion_percent,
  budget, spent, baseline_budget, baseline_start, baseline_end, start_date, end_date`

// Gathers the raw signals for one project row and runs the pure health engine.
export function scoreProjectRow(p: ProjectRow): ScoredProject {
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

// Convenience: fetch + score a single project by id (null if it doesn't exist).
export function scoreProjectById(id: number | string): ScoredProject | null {
  const p = db.prepare(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ?`).get(id) as ProjectRow | undefined
  return p ? scoreProjectRow(p) : null
}

// All non-cancelled projects, scored.
export function scoreAllProjects(): ScoredProject[] {
  const rows = db.prepare(
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE status NOT IN ('cancelled') ORDER BY priority DESC, name ASC`
  ).all() as ProjectRow[]
  return rows.map(scoreProjectRow)
}

function ragForScore(score: number): 'green' | 'amber' | 'red' {
  return score >= 80 ? 'green' : score >= 55 ? 'amber' : 'red'
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}

const upsertSnapshot = () => db.prepare(`
  INSERT INTO health_history (project_id, date, score, rag, cpi)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(project_id, date) DO UPDATE SET score = excluded.score, rag = excluded.rag, cpi = excluded.cpi
`)

// Records today's (or a given date's) health snapshot for every active project.
// Idempotent per (project, date) — safe to call on every server start.
export function recordDailySnapshots(dateStr = isoDaysAgo(0)): number {
  const stmt = upsertSnapshot()
  const scored = scoreAllProjects()
  const tx = db.transaction(() => {
    for (const s of scored) stmt.run(s.id, dateStr, s.score, s.rag, s.cpi)
  })
  tx()
  return scored.length
}

// Reads a project's score history for the trailing window (oldest -> newest).
export function getProjectTrend(projectId: number | string, days = 30): TrendPoint[] {
  const rows = db.prepare(`
    SELECT date, score, rag FROM health_history
    WHERE project_id = ? AND date >= ?
    ORDER BY date ASC
  `).all(projectId, isoDaysAgo(days)) as Array<{ date: string; score: number; rag: string }>
  return rows
}

// Pseudo-random but deterministic value in [0,1) from an integer-ish seed, so
// the demo backfill is stable across restarts and reseeds.
function pseudo(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

// Seeds a plausible health-score history for the demo so the trend sparklines
// have something to show on a fresh database. Each project's past scores drift
// toward its current real score with a little deterministic wiggle. Today's
// real snapshot is written separately by recordDailySnapshots() at startup.
export function backfillDemoHistory(days = 21): void {
  const stmt = upsertSnapshot()
  const scored = scoreAllProjects()
  const tx = db.transaction(() => {
    for (const s of scored) {
      const startOffset = (pseudo(s.id * 7.1) - 0.5) * 30 // -15..+15 points
      for (let d = days; d >= 1; d--) {
        const t = (days - d) / days // 0 at the oldest day -> ~1 near today
        const base = s.score - startOffset * (1 - t)
        const wiggle = (pseudo(s.id * 13 + d) - 0.5) * 6
        const score = Math.round(Math.max(0, Math.min(100, base + wiggle)))
        stmt.run(s.id, isoDaysAgo(d), score, ragForScore(score), s.cpi)
      }
    }
  })
  tx()
}
