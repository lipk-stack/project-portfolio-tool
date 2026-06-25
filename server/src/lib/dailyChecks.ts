// Pure detectors for the daily-sweep automation signals. Like healthTrend.ts,
// these are dependency-free so they stay fully unit-testable; the service layer
// (dailyChecksService.ts) reads the rows from the database, applies once-only
// de-duping via the alert_log table, and fires the notifications/automations.

export interface OverdueTaskRow {
  id: number
  name: string
  project_id: number
  status: string
  end_date: string | null // YYYY-MM-DD
  priority?: string
  assignee_id?: number | null
}

// Tasks that have slipped past their due date and aren't done yet. `today` is a
// YYYY-MM-DD string; ISO dates compare correctly lexicographically. A task due
// today is NOT overdue — only strictly-earlier due dates count.
export function detectOverdueTasks(tasks: OverdueTaskRow[], today: string): OverdueTaskRow[] {
  return tasks.filter((t) => {
    if (t.status === 'done' || !t.end_date) return false
    return t.end_date.slice(0, 10) < today
  })
}

export interface BudgetRow {
  id: number
  name: string
  budget: number
  spent: number
}

// Projects whose actual spend has exceeded their planned budget. Projects with
// no budget set (budget <= 0) are skipped — there is nothing to overrun.
export function detectBudgetOverruns(projects: BudgetRow[]): BudgetRow[] {
  return projects.filter((p) => p.budget > 0 && p.spent > p.budget)
}
