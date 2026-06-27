// The daily-sweep job. Runs at server startup (see index.ts) and consolidates
// every "once a day, look at the whole portfolio" signal in one place:
//   - the health snapshot + red/recovery transition alerts (delegated to
//     healthService), and
//   - the new task_overdue / budget_overrun alerts owned here.
//
// Each new alert fires AT MOST ONCE per task/project, de-duped through the
// alert_log table, so restarting the server never re-notifies a known problem.
// Pure detection lives in dailyChecks.ts; this file only does the DB reads,
// the de-dupe bookkeeping and the notify/automation side effects.

import { db } from '../database'
import { createNotification } from './notify'
import { runAutomations } from './automationRunner'
import { detectOverdueTasks, detectBudgetOverruns, detectMissedMilestones, OverdueTaskRow, BudgetRow, MilestoneRow } from './dailyChecks'
import { recordDailySnapshots, backfillDemoHistory, notifyRedTransitions, notifyHealthRecoveries } from './healthService'

// System actor id for automation events not triggered by a logged-in user.
// 0 never matches a real user, so notify_manager / notify_user still fire.
const SYSTEM_ACTOR_ID = 0

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function adminIds(): number[] {
  return (db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as Array<{ id: number }>).map((u) => u.id)
}

function projectManagerId(projectId: number): number | null {
  const row = db.prepare('SELECT manager_id FROM projects WHERE id = ?').get(projectId) as { manager_id: number | null } | undefined
  return row?.manager_id ?? null
}

// Prepared lazily (inside helpers, not at module load) so importing this file
// never touches the schema before initializeDatabase() has created alert_log —
// imports hoist above the bootstrap call in index.ts. better-sqlite3 caches by
// SQL string, so re-preparing on each call is effectively free.
const wasFired = (kind: string, refId: number): boolean =>
  !!db.prepare('SELECT 1 FROM alert_log WHERE kind = ? AND ref_id = ?').get(kind, refId)
const markFired = (kind: string, refId: number): void => {
  db.prepare('INSERT OR IGNORE INTO alert_log (kind, ref_id, fired_on) VALUES (?, ?, ?)').run(kind, refId, today())
}

// Open tasks with a due date, scoped to live projects — the candidate set the
// pure detector then filters down to the genuinely overdue ones.
function candidateTasks(): OverdueTaskRow[] {
  return db.prepare(`
    SELECT t.id, t.name, t.project_id, t.status, t.end_date, t.priority, t.assignee_id
    FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE p.status NOT IN ('cancelled') AND t.status != 'done' AND t.end_date IS NOT NULL
  `).all() as OverdueTaskRow[]
}

function budgetedProjects(): BudgetRow[] {
  return db.prepare(`
    SELECT id, name, budget, spent FROM projects WHERE status NOT IN ('cancelled')
  `).all() as BudgetRow[]
}

// Milestones with a target date, scoped to live projects — the pure detector
// then keeps only the ones that slipped past their date without being achieved.
function candidateMilestones(): MilestoneRow[] {
  return db.prepare(`
    SELECT m.id, m.name, m.project_id, m.date, m.status
    FROM milestones m JOIN projects p ON p.id = m.project_id
    WHERE p.status NOT IN ('cancelled') AND m.status != 'achieved' AND m.date IS NOT NULL
  `).all() as MilestoneRow[]
}

// Notifies the assignee, project manager and admins the first time a task slips
// past its due date, and fires any matching `task_overdue` automation rule. In
// `baseline` mode it only records the alert_log marker (silent) — used on a
// fresh database so the demo's already-overdue tasks aren't alerted en masse;
// only tasks that become overdue LATER will notify. Returns the task names that
// newly fired (empty in baseline mode).
export function notifyOverdueTasks(baseline = false): string[] {
  const overdue = detectOverdueTasks(candidateTasks(), today())
  if (overdue.length === 0) return []
  const admins = adminIds()
  const fired: string[] = []

  for (const t of overdue) {
    if (wasFired('task_overdue', t.id)) continue // already alerted once
    markFired('task_overdue', t.id)
    if (baseline) continue

    const recipients = new Set<number>(admins)
    if (t.assignee_id) recipients.add(t.assignee_id)
    const mgr = projectManagerId(t.project_id)
    if (mgr) recipients.add(mgr)

    const link = `/projects/${t.project_id}/tasks`
    const title = `Task overdue: ${t.name}`
    const message = `"${t.name}" passed its due date (${t.end_date}) and isn't done yet.`
    for (const userId of recipients) createNotification(userId, 'task_overdue', title, message, link)

    runAutomations(
      {
        type: 'task_overdue',
        projectId: t.project_id,
        task: { id: t.id, name: t.name, status: t.status, priority: t.priority, assignee_id: t.assignee_id },
      },
      SYSTEM_ACTOR_ID
    )
    fired.push(t.name)
  }
  return fired
}

// The budget mirror of notifyOverdueTasks: notifies the project manager and
// admins the first time a project's spend exceeds its budget, and fires any
// `budget_overrun` automation rule. `baseline` mode records markers silently.
export function notifyBudgetOverruns(baseline = false): string[] {
  const overruns = detectBudgetOverruns(budgetedProjects())
  if (overruns.length === 0) return []
  const admins = adminIds()
  const fired: string[] = []

  for (const p of overruns) {
    if (wasFired('budget_overrun', p.id)) continue
    markFired('budget_overrun', p.id)
    if (baseline) continue

    const recipients = new Set<number>(admins)
    const mgr = projectManagerId(p.id)
    if (mgr) recipients.add(mgr)

    const link = `/projects/${p.id}`
    const title = `Budget overrun: ${p.name}`
    const message = `${p.name} has spent $${p.spent} against a $${p.budget} budget.`
    for (const userId of recipients) createNotification(userId, 'budget_overrun', title, message, link)

    runAutomations(
      {
        type: 'budget_overrun',
        projectId: p.id,
        budget: { projectId: p.id, name: p.name, budget: p.budget, spent: p.spent },
      },
      SYSTEM_ACTOR_ID
    )
    fired.push(p.name)
  }
  return fired
}

// The milestone mirror of notifyOverdueTasks: notifies the project manager and
// admins the first time a milestone slips past its target date without being
// achieved, and fires any `milestone_missed` automation rule. `baseline` mode
// records markers silently so a fresh demo DB (which already has past-due
// milestones) isn't alerted en masse — only milestones that slip LATER notify.
export function notifyMissedMilestones(baseline = false): string[] {
  const missed = detectMissedMilestones(candidateMilestones(), today())
  if (missed.length === 0) return []
  const admins = adminIds()
  const fired: string[] = []

  for (const m of missed) {
    if (wasFired('milestone_missed', m.id)) continue
    markFired('milestone_missed', m.id)
    if (baseline) continue

    const recipients = new Set<number>(admins)
    const mgr = projectManagerId(m.project_id)
    if (mgr) recipients.add(mgr)

    const link = `/projects/${m.project_id}`
    const title = `Milestone missed: ${m.name}`
    const message = `Milestone "${m.name}" passed its target date (${m.date}) without being achieved.`
    for (const userId of recipients) createNotification(userId, 'milestone_missed', title, message, link)

    runAutomations(
      {
        type: 'milestone_missed',
        projectId: m.project_id,
        milestone: { id: m.id, name: m.name, date: m.date, projectId: m.project_id },
      },
      SYSTEM_ACTOR_ID
    )
    fired.push(m.name)
  }
  return fired
}

export interface DailyChecksResult {
  freshHistory: boolean
  redAlerts: string[]
  recoveries: string[]
  overdue: string[]
  overruns: string[]
  missedMilestones: string[]
}

// The single entry point the bootstrap calls. On a fresh database (no health
// history yet) it seeds a synthetic trend and records today's baseline WITHOUT
// raising any alerts — the synthetic backfill would otherwise manufacture
// transitions, and the demo's existing overdue/over-budget rows would spam.
// On every subsequent start it records today's snapshot and emits the four
// alert families for genuine day-over-day changes / newly-crossed thresholds.
export function runDailyChecks(): DailyChecksResult {
  const hist = db.prepare('SELECT COUNT(*) as c FROM health_history').get() as { c: number }
  const proj = db.prepare("SELECT COUNT(*) as c FROM projects WHERE status NOT IN ('cancelled')").get() as { c: number }
  const freshHistory = hist.c === 0 && proj.c > 0

  if (freshHistory) backfillDemoHistory()
  recordDailySnapshots()

  if (freshHistory) {
    notifyOverdueTasks(true) // seed alert_log baselines silently
    notifyBudgetOverruns(true)
    notifyMissedMilestones(true)
    return { freshHistory, redAlerts: [], recoveries: [], overdue: [], overruns: [], missedMilestones: [] }
  }

  return {
    freshHistory,
    redAlerts: notifyRedTransitions(),
    recoveries: notifyHealthRecoveries(),
    overdue: notifyOverdueTasks(),
    overruns: notifyBudgetOverruns(),
    missedMilestones: notifyMissedMilestones(),
  }
}
