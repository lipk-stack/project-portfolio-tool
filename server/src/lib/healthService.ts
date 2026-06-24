// Shared health-scoring data layer. Gathers the raw signals for a project from
// the database and runs the pure computeProjectHealth engine. Also owns the
// health_history persistence: a daily score snapshot per project plus trend
// reads. The route layer (routes/insights.ts), the daily snapshot job (called
// at server startup) and the PDF status report all funnel through here so the
// scoring logic lives in exactly one place.

import { db } from '../database'
import { computeEarnedSchedule } from './earnedSchedule'
import { computeProjectHealth, ProjectHealthResult } from './projectHealth'
import { TrendPoint, ragForScore, aggregatePortfolioTrend, detectRedTransitions, detectHealthRecoveries, RagSnapshot } from './healthTrend'
import { createNotification } from './notify'
import { runAutomations } from './automationRunner'

// System actor id for automation events not triggered by a logged-in user (the
// daily health snapshot job). 0 never matches a real user, so notify_manager /
// notify_user actions still fire correctly (they only skip the actor itself).
const SYSTEM_ACTOR_ID = 0

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

// Portfolio-level score history: the mean score across all projects per date,
// over the trailing window (oldest -> newest). Aggregation lives in the pure
// healthTrend layer so it stays unit-tested.
export function getPortfolioTrend(days = 30): TrendPoint[] {
  const rows = db.prepare(`
    SELECT date, score FROM health_history WHERE date >= ?
  `).all(isoDaysAgo(days)) as Array<{ date: string; score: number }>
  return aggregatePortfolioTrend(rows)
}

// Reads the stored RAG band for every project on a given date.
function ragSnapshotForDate(dateStr: string): RagSnapshot[] {
  return db.prepare(`
    SELECT h.project_id AS id, p.name AS name, h.rag AS rag
    FROM health_history h JOIN projects p ON p.id = h.project_id
    WHERE h.date = ?
  `).all(dateStr) as RagSnapshot[]
}

// Notifies project managers (and admins) when a project's daily health snapshot
// crosses from green/amber into red since yesterday. Idempotent per project per
// day: a re-run won't duplicate an alert already raised today. Returns the names
// of the projects that triggered an alert. Relies on health_history already
// holding both today's and yesterday's snapshots (recordDailySnapshots is the
// writer; this should be called after it).
export function notifyRedTransitions(today = isoDaysAgo(0), yesterday = isoDaysAgo(1)): string[] {
  const prevSnap = ragSnapshotForDate(yesterday)
  const dropped = detectRedTransitions(prevSnap, ragSnapshotForDate(today))
  if (dropped.length === 0) return []

  const prevRagById = new Map(prevSnap.map((s) => [s.id, s.rag]))
  const scoreOnDay = db.prepare('SELECT score FROM health_history WHERE project_id = ? AND date = ?')
  const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as Array<{ id: number }>
  const alreadyAlerted = db.prepare(
    "SELECT 1 FROM notifications WHERE type = 'health_red' AND link = ? AND date(created_at) = ?"
  )
  const notified: string[] = []

  for (const proj of dropped) {
    const link = `/projects/${proj.id}`
    if (alreadyAlerted.get(link, today)) continue // de-dupe within the day

    const manager = db.prepare('SELECT manager_id FROM projects WHERE id = ?').get(proj.id) as { manager_id: number | null } | undefined
    const recipients = new Set<number>(admins.map((a) => a.id))
    if (manager?.manager_id) recipients.add(manager.manager_id)

    const title = `Health alert: ${proj.name} turned RED`
    const message = `${proj.name} dropped into the red health band today. Review schedule, budget and open risks.`
    for (const userId of recipients) createNotification(userId, 'health_red', title, message, link)

    // Let user-configured automation rules react to the same signal (e.g.
    // notify a specific stakeholder). The built-in manager/admin alert above is
    // always sent; automations are additive. Guarded by the same once-per-day
    // de-dupe, so a server restart won't re-fire rules.
    const scoreRow = scoreOnDay.get(proj.id, today) as { score: number } | undefined
    runAutomations(
      {
        type: 'project_health_red',
        projectId: proj.id,
        project: { id: proj.id, name: proj.name, score: scoreRow?.score ?? 0, fromRag: prevRagById.get(proj.id), toRag: 'red' },
      },
      SYSTEM_ACTOR_ID
    )
    notified.push(proj.name)
  }
  return notified
}

// The mirror of notifyRedTransitions: when a project climbs back OUT of the red
// band day-over-day, send a "recovered" notification to managers/admins and
// fire any `project_health_improved` automation rule. Idempotent per project
// per day via a type='health_green' marker — a server restart won't re-fire.
// Call after recordDailySnapshots(); never on fresh-DB bootstrap.
export function notifyHealthRecoveries(today = isoDaysAgo(0), yesterday = isoDaysAgo(1)): string[] {
  const prevSnap = ragSnapshotForDate(yesterday)
  const currSnap = ragSnapshotForDate(today)
  const recovered = detectHealthRecoveries(prevSnap, currSnap)
  if (recovered.length === 0) return []

  const currRagById = new Map(currSnap.map((s) => [s.id, s.rag]))
  const scoreOnDay = db.prepare('SELECT score FROM health_history WHERE project_id = ? AND date = ?')
  const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as Array<{ id: number }>
  const alreadyAlerted = db.prepare(
    "SELECT 1 FROM notifications WHERE type = 'health_green' AND link = ? AND date(created_at) = ?"
  )
  const notified: string[] = []

  for (const proj of recovered) {
    const link = `/projects/${proj.id}`
    if (alreadyAlerted.get(link, today)) continue // de-dupe within the day

    const toRag = currRagById.get(proj.id) ?? 'green'
    const manager = db.prepare('SELECT manager_id FROM projects WHERE id = ?').get(proj.id) as { manager_id: number | null } | undefined
    const recipients = new Set<number>(admins.map((a) => a.id))
    if (manager?.manager_id) recipients.add(manager.manager_id)

    const title = `Health recovered: ${proj.name} is back to ${toRag.toUpperCase()}`
    const message = `${proj.name} climbed out of the red health band today (now ${toRag}).`
    for (const userId of recipients) createNotification(userId, 'health_green', title, message, link)

    const scoreRow = scoreOnDay.get(proj.id, today) as { score: number } | undefined
    runAutomations(
      {
        type: 'project_health_improved',
        projectId: proj.id,
        project: { id: proj.id, name: proj.name, score: scoreRow?.score ?? 0, fromRag: 'red', toRag },
      },
      SYSTEM_ACTOR_ID
    )
    notified.push(proj.name)
  }
  return notified
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
