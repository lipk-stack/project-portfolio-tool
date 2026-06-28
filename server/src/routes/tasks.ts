import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'
import { runAutomations } from '../lib/automationRunner'
import { saveCustomValues } from './customFields'
import { createNotification } from '../lib/notify'
import { emitToProject } from '../lib/realtime'
import { dispatchWebhooks } from '../lib/webhookDispatcher'
import { computeNextOccurrence, isValidRecurrence } from '../lib/recurrence'
import { computeCriticalPath, durationInDays, DependencyType } from '../lib/criticalPath'
import { buildTaskImport, ImportUser, TASK_IMPORT_TEMPLATE, TaskImportResult } from '../lib/csvImport'
import { parseGithubRepo, githubIssuesToCsv, countImportableIssues, GithubIssue } from '../lib/githubImport'
import { parseJiraBaseUrl, jiraIssuesToCsv, countImportableJira, JiraIssue } from '../lib/jiraImport'

const router = Router()

// Shared dry-run/commit pipeline behind every task importer (CSV paste, GitHub,
// Jira). Always validates; only writes the error-free rows when `commit` is
// true, then returns the same plan either way so the UI can preview before
// committing. A valid row whose wbs_code already exists in the project is a
// "duplicate" keyed by that natural code (GH-<n> for GitHub, the Jira key, or a
// user-supplied CSV wbs). Duplicates are handled two ways:
//   - DEDUPE (default): the duplicate is skipped, never touched.
//   - SYNC (`sync` = true): the existing task's status/priority/assignee are
//     updated in place when any of them differs; an identical row is a no-op and
//     still counted as skipped. This keeps re-imported tracker tasks current
//     without creating duplicates.
// Rows with no wbs_code have no natural key and are always inserted.
// `imported`/`updated` describe the plan (== what's realized on commit, since
// every planned row is error-free and applies cleanly); writes only happen when
// `commit` is true.
function importTasks(projectId: number, csv: string, commit: boolean, userId: number, sync = false): { imported: number; updated: number; skipped: number; result: TaskImportResult } {
  const users = db.prepare('SELECT id, name, email FROM users').all() as ImportUser[]
  const result = buildTaskImport(csv, users)

  // Existing wbs_code -> task, for dedupe (skip) or in-place update (sync).
  const existing = new Map<string, { id: number; status: string; priority: string; assignee_id: number | null }>()
  for (const r of db.prepare('SELECT id, wbs_code, status, priority, assignee_id FROM tasks WHERE project_id = ? AND wbs_code IS NOT NULL').all(projectId) as Array<{ id: number; wbs_code: string; status: string; priority: string; assignee_id: number | null }>) {
    existing.set(r.wbs_code, { id: r.id, status: r.status, priority: r.priority, assignee_id: r.assignee_id })
  }

  const validRows = result.rows.filter(r => r.errors.length === 0)
  const newRows = validRows.filter(r => !r.wbs_code || !existing.has(r.wbs_code))
  const dupRows = validRows.filter(r => !!r.wbs_code && existing.has(r.wbs_code))
  // A duplicate is updated (sync mode only) when a synced field differs; an
  // identical duplicate is a no-op and counted as skipped.
  const differs = (row: TaskImportResult['rows'][number]) => {
    const e = existing.get(row.wbs_code!)!
    return e.status !== row.status || e.priority !== row.priority || (e.assignee_id ?? null) !== (row.assignee_id ?? null)
  }
  const updateRows = sync ? dupRows.filter(differs) : []
  const imported = newRows.length
  const updated = updateRows.length
  const skipped = dupRows.length - updated

  if (commit === true && (imported > 0 || updated > 0)) {
    const insert = db.prepare(`
      INSERT INTO tasks (project_id, name, description, status, priority, assignee_id,
        start_date, end_date, estimated_hours, story_points, wbs_code, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const update = db.prepare('UPDATE tasks SET status = ?, priority = ?, assignee_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    const maxPos = (db.prepare('SELECT MAX(position) as mp FROM tasks WHERE project_id = ?').get(projectId) as { mp: number }).mp || 0
    const apply = db.transaction(() => {
      let pos = maxPos
      for (const row of newRows) {
        pos++
        insert.run(projectId, row.name, row.description, row.status, row.priority, row.assignee_id,
          row.start_date, row.end_date, row.estimated_hours, row.story_points, row.wbs_code, pos)
      }
      for (const row of updateRows) {
        update.run(row.status, row.priority, row.assignee_id ?? null, existing.get(row.wbs_code!)!.id)
      }
    })
    apply()
    db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)')
      .run('project', projectId, userId, 'tasks_imported', JSON.stringify({ count: imported, updated, skipped }))
    emitToProject(projectId, 'task_changed', { action: 'imported', actor_id: userId })
  }

  return { imported, updated, skipped, result }
}

function importPayload(committed: boolean, imported: number, updated: number, skipped: number, result: TaskImportResult, extra: Record<string, unknown> = {}) {
  return {
    committed,
    imported,
    updated,
    skipped,
    headers: result.headers,
    mappedColumns: result.mappedColumns,
    unmappedHeaders: result.unmappedHeaders,
    validCount: result.validCount,
    errorCount: result.errorCount,
    rows: result.rows,
    ...extra,
  }
}

// When a recurring task is completed, spawn the next occurrence: a fresh copy
// (status todo, progress reset) with dates shifted forward one period. Returns
// the new task id, or null if the series has ended. Best-effort: never throws.
function materializeRecurrence(taskId: number, actorId: number): number | null {
  try {
    const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Record<string, unknown> | undefined
    if (!t) return null
    const next = computeNextOccurrence({
      start_date: (t.start_date as string) || null,
      end_date: (t.end_date as string) || null,
      recurrence: (t.recurrence as string) || null,
      recurrence_until: (t.recurrence_until as string) || null,
    })
    if (!next) return null

    const maxPos = (db.prepare('SELECT MAX(position) as mp FROM tasks WHERE project_id = ?').get(t.project_id) as { mp: number }).mp || 0
    const result = db.prepare(`
      INSERT INTO tasks (project_id, parent_id, name, description, status, priority, assignee_id,
        start_date, end_date, estimated_hours, wbs_code, position, sprint, story_points, tags,
        recurrence, recurrence_until)
      VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      t.project_id, t.parent_id ?? null, t.name, t.description ?? null, t.priority, t.assignee_id ?? null,
      next.start_date, next.end_date, t.estimated_hours ?? 0, t.wbs_code ?? null,
      maxPos + 1, t.sprint ?? null, t.story_points ?? null, t.tags ?? null,
      t.recurrence, t.recurrence_until ?? null
    )
    const newId = Number(result.lastInsertRowid)
    db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)')
      .run('project', t.project_id, actorId, 'task_recurred', JSON.stringify({ name: t.name, from_task: taskId, due: next.end_date }))
    return newId
  } catch {
    return null
  }
}

router.get('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const tasks = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.email as assignee_email,
      (SELECT COUNT(*) FROM tasks sub WHERE sub.parent_id = t.id) as subtask_count,
      (SELECT COUNT(*) FROM tasks sub WHERE sub.parent_id = t.id AND sub.status = 'done') as done_subtask_count
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.project_id = ?
    ORDER BY t.position ASC, t.created_at ASC
  `).all(req.params.projectId)

  const dependencies = db.prepare(`
    SELECT td.* FROM task_dependencies td
    JOIN tasks t ON t.id = td.predecessor_id
    WHERE t.project_id = ?
  `).all(req.params.projectId) as Array<{ predecessor_id: number; successor_id: number; type: string }>

  const depMap: Record<number, number[]> = {}
  for (const dep of dependencies) {
    if (!depMap[dep.successor_id]) depMap[dep.successor_id] = []
    depMap[dep.successor_id].push(dep.predecessor_id)
  }

  const tasksWithDeps = (tasks as Array<Record<string, unknown>>).map(t => ({
    ...t,
    tags: t.tags ? JSON.parse(t.tags as string) : [],
    dependencies: depMap[t.id as number] || [],
  }))

  res.json({ tasks: tasksWithDeps, dependencies })
})

// Critical Path Method analysis for a project: runs a forward/backward pass over
// the task network (durations from planned dates, typed dependencies + lag) and
// returns early/late dates, total & free float, and the critical path. The
// engine works in day offsets; we anchor those to the earliest planned start to
// hand the client real dates. We also refresh each task's `is_critical` flag so
// the rest of the app (Gantt highlighting, status reports, calendar) reflects
// the computed critical path rather than a hand-set value — a derived cache, not
// user data, so recomputing it on read is safe and idempotent.
const MS_PER_DAY = 24 * 60 * 60 * 1000
function addDays(anchorMs: number, days: number): string {
  return new Date(anchorMs + Math.round(days) * MS_PER_DAY).toISOString().slice(0, 10)
}

router.get('/project/:projectId/critical-path', authenticate, (req: Request, res: Response) => {
  const rows = db
    .prepare(
      `SELECT t.id, t.name, t.start_date, t.end_date, t.estimated_hours, t.status,
        t.completion_percent, t.is_critical, u.name as assignee_name
       FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.project_id = ? ORDER BY t.start_date ASC, t.position ASC`,
    )
    .all(req.params.projectId) as Array<{
    id: number
    name: string
    start_date: string | null
    end_date: string | null
    estimated_hours: number | null
    status: string
    completion_percent: number
    is_critical: number
    assignee_name: string | null
  }>

  const links = db
    .prepare(
      `SELECT td.predecessor_id, td.successor_id, td.type, td.lag
       FROM task_dependencies td JOIN tasks t ON t.id = td.predecessor_id
       WHERE t.project_id = ?`,
    )
    .all(req.params.projectId) as Array<{ predecessor_id: number; successor_id: number; type: DependencyType; lag: number }>

  const cpm = computeCriticalPath(
    rows.map((r) => ({ id: r.id, duration: durationInDays(r.start_date, r.end_date, r.estimated_hours) })),
    links,
  )
  const scheduleById = new Map(cpm.activities.map((a) => [a.id, a]))

  // Anchor day offsets to the earliest planned start so the client gets dates.
  const anchorMs = rows
    .map((r) => (r.start_date ? Date.parse(r.start_date) : NaN))
    .filter((n) => !Number.isNaN(n))
    .reduce((min, n) => Math.min(min, n), Infinity)
  const haveAnchor = Number.isFinite(anchorMs)

  const tasks = rows.map((r) => {
    const s = scheduleById.get(r.id)!
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      completion_percent: r.completion_percent,
      assignee_name: r.assignee_name,
      duration: s.duration,
      totalFloat: s.totalFloat,
      freeFloat: s.freeFloat,
      isCritical: s.isCritical,
      earlyStart: haveAnchor ? addDays(anchorMs, s.earlyStart) : null,
      earlyFinish: haveAnchor ? addDays(anchorMs, s.earlyFinish) : null,
      lateStart: haveAnchor ? addDays(anchorMs, s.lateStart) : null,
      lateFinish: haveAnchor ? addDays(anchorMs, s.lateFinish) : null,
    }
  })

  // Refresh the persisted is_critical flag for any task whose computed status
  // differs (keeps Gantt/reports/calendar consistent with the analysis).
  const changed = rows.filter((r) => (scheduleById.get(r.id)!.isCritical ? 1 : 0) !== r.is_critical)
  if (changed.length) {
    const update = db.prepare('UPDATE tasks SET is_critical = ? WHERE id = ?')
    db.transaction(() => {
      for (const r of changed) update.run(scheduleById.get(r.id)!.isCritical ? 1 : 0, r.id)
    })()
  }

  const nameById = new Map(rows.map((r) => [r.id, r.name]))
  res.json({
    projectDuration: cpm.projectDuration,
    hasCycle: cpm.hasCycle,
    forecastFinish: haveAnchor ? addDays(anchorMs, cpm.projectDuration) : null,
    criticalCount: cpm.criticalPath.length,
    criticalPath: cpm.criticalPath.map((id) => ({ id, name: nameById.get(id)! })),
    tasks,
  })
})

// Downloadable CSV template for the task importer.
router.get('/import/template', authenticate, (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="task-import-template.csv"')
  res.send(TASK_IMPORT_TEMPLATE)
})

// Cross-project view of the current user's open tasks, for the My Work page.
router.get('/my-work', authenticate, (req: Request, res: Response) => {
  const tasks = db.prepare(`
    SELECT t.id, t.name, t.status, t.priority, t.start_date, t.end_date, t.completion_percent,
      t.story_points, t.estimated_hours, t.actual_hours, t.project_id,
      p.name as project_name, p.color as project_color
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.assignee_id = ? AND t.status != 'done' AND p.status NOT IN ('cancelled', 'completed')
    ORDER BY t.end_date IS NULL, t.end_date ASC,
      CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
  `).all(req.user!.userId) as Array<{ end_date: string | null }>

  const today = new Date().toISOString().slice(0, 10)
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const counts = {
    total: tasks.length,
    overdue: tasks.filter(t => t.end_date && t.end_date < today).length,
    due_today: tasks.filter(t => t.end_date === today).length,
    due_this_week: tasks.filter(t => t.end_date && t.end_date > today && t.end_date <= weekEnd).length,
  }
  res.json({ tasks, counts })
})

router.post('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const { name, description, parent_id, status, priority, assignee_id, start_date, end_date, estimated_hours, wbs_code, position, sprint, story_points, tags, recurrence, recurrence_until } = req.body
  if (!name) return res.status(400).json({ error: 'Task name required' })
  if (recurrence !== undefined && recurrence !== null && !isValidRecurrence(recurrence)) {
    return res.status(400).json({ error: 'Invalid recurrence (none|daily|weekly|monthly)' })
  }

  const maxPos = (db.prepare('SELECT MAX(position) as mp FROM tasks WHERE project_id = ?').get(req.params.projectId) as { mp: number }).mp || 0

  const result = db.prepare(`
    INSERT INTO tasks (project_id, parent_id, name, description, status, priority, assignee_id,
      start_date, end_date, estimated_hours, wbs_code, position, sprint, story_points, tags,
      recurrence, recurrence_until)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.projectId, parent_id || null, name, description || null,
    status || 'todo', priority || 'medium', assignee_id || null,
    start_date || null, end_date || null, estimated_hours || 0,
    wbs_code || null, position ?? (maxPos + 1), sprint || null,
    story_points || null, tags ? JSON.stringify(tags) : null,
    recurrence || 'none', recurrence_until || null
  )

  db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run('project', req.params.projectId, req.user!.userId, 'task_created', JSON.stringify({ name }))

  if (assignee_id && assignee_id !== req.user!.userId) {
    createNotification(assignee_id, 'assignment', `Assigned to "${name}"`, description || null, `/projects/${req.params.projectId}/tasks`)
  }

  const taskId = Number(result.lastInsertRowid)
  const projectId = Number(req.params.projectId)

  if (req.body.custom_values && typeof req.body.custom_values === 'object') {
    saveCustomValues(taskId, projectId, req.body.custom_values)
  }

  const eventTask = { id: taskId, name, status: status || 'todo', priority: priority || 'medium', assignee_id: assignee_id || null }
  runAutomations({ type: 'task_created', projectId, task: eventTask }, req.user!.userId)
  if (assignee_id) {
    runAutomations({ type: 'task_assigned', projectId, task: eventTask }, req.user!.userId)
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId)
  emitToProject(projectId, 'task_changed', { action: 'created', task_id: taskId, actor_id: req.user!.userId })
  dispatchWebhooks('task.created', projectId, { task })
  res.status(201).json({ task })
})

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!existing) return res.status(404).json({ error: 'Task not found' })

  const { name, description, status, priority, assignee_id, start_date, end_date, estimated_hours, actual_hours, completion_percent, wbs_code, position, sprint, story_points, tags, is_critical, recurrence, recurrence_until } = req.body
  if (recurrence !== undefined && recurrence !== null && !isValidRecurrence(recurrence)) {
    return res.status(400).json({ error: 'Invalid recurrence (none|daily|weekly|monthly)' })
  }

  db.prepare(`
    UPDATE tasks SET name=?, description=?, status=?, priority=?, assignee_id=?,
      start_date=?, end_date=?, estimated_hours=?, actual_hours=?, completion_percent=?,
      wbs_code=?, position=?, sprint=?, story_points=?, tags=?, is_critical=?,
      recurrence=?, recurrence_until=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(name, description || null, status, priority, assignee_id || null,
    start_date || null, end_date || null, estimated_hours || 0, actual_hours || 0,
    completion_percent || 0, wbs_code || null, position ?? existing.position,
    sprint || null, story_points || null, tags ? JSON.stringify(tags) : null,
    is_critical ? 1 : 0,
    recurrence ?? existing.recurrence ?? 'none',
    recurrence_until !== undefined ? (recurrence_until || null) : (existing.recurrence_until ?? null),
    req.params.id)

  if (existing.status !== status) {
    db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run('project', existing.project_id, req.user!.userId, 'task_status_changed', JSON.stringify({ task: name, from: existing.status, to: status }))
    if (status === 'done') {
      db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run('project', existing.project_id, req.user!.userId, 'task_completed', JSON.stringify({ task: name }))
    }
  }

  if (assignee_id && existing.assignee_id !== assignee_id && assignee_id !== req.user!.userId) {
    createNotification(assignee_id, 'assignment', `Assigned to "${name}"`, null, `/projects/${existing.project_id}/tasks`)
  }

  const projectId = Number(existing.project_id)

  if (req.body.custom_values && typeof req.body.custom_values === 'object') {
    saveCustomValues(Number(req.params.id), projectId, req.body.custom_values)
  }

  const eventTask = { id: Number(req.params.id), name, status, priority, assignee_id: assignee_id || null, from_status: existing.status as string }
  if (existing.status !== status) {
    runAutomations({ type: 'task_status_changed', projectId, task: eventTask }, req.user!.userId)
  }
  if (assignee_id && existing.assignee_id !== assignee_id) {
    runAutomations({ type: 'task_assigned', projectId, task: eventTask }, req.user!.userId)
  }

  // Spawn the next occurrence when a recurring task is newly completed.
  let recurred_task_id: number | null = null
  if (existing.status !== 'done' && status === 'done') {
    recurred_task_id = materializeRecurrence(Number(req.params.id), req.user!.userId)
    if (recurred_task_id) emitToProject(projectId, 'task_changed', { action: 'created', task_id: recurred_task_id, actor_id: req.user!.userId })
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  emitToProject(projectId, 'task_changed', { action: 'updated', task_id: Number(req.params.id), actor_id: req.user!.userId })
  dispatchWebhooks('task.updated', projectId, { task, previous_status: existing.status })
  res.json({ task, recurred_task_id })
})

// Status-only update — unlike PUT (full replace), this is safe for quick
// actions from list views that don't hold the complete task object.
router.patch('/:id/status', authenticate, (req: Request, res: Response) => {
  const { status } = req.body
  const VALID = ['todo', 'in_progress', 'review', 'blocked', 'done']
  if (!VALID.includes(status)) return res.status(400).json({ error: `status must be one of: ${VALID.join(', ')}` })

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!existing) return res.status(404).json({ error: 'Task not found' })

  db.prepare(`
    UPDATE tasks SET status = ?,
      completion_percent = CASE WHEN ? = 'done' THEN 100 ELSE completion_percent END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, status, req.params.id)

  const projectId = Number(existing.project_id)
  if (existing.status !== status) {
    db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run('project', projectId, req.user!.userId, 'task_status_changed', JSON.stringify({ task: existing.name, from: existing.status, to: status }))
    if (status === 'done') {
      db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run('project', projectId, req.user!.userId, 'task_completed', JSON.stringify({ task: existing.name }))
    }
    const eventTask = { id: Number(req.params.id), name: String(existing.name), status, priority: String(existing.priority), assignee_id: (existing.assignee_id as number | null), from_status: existing.status as string }
    runAutomations({ type: 'task_status_changed', projectId, task: eventTask }, req.user!.userId)
  }

  // Spawn the next occurrence when a recurring task is newly completed.
  let recurred_task_id: number | null = null
  if (existing.status !== 'done' && status === 'done') {
    recurred_task_id = materializeRecurrence(Number(req.params.id), req.user!.userId)
    if (recurred_task_id) emitToProject(projectId, 'task_changed', { action: 'created', task_id: recurred_task_id, actor_id: req.user!.userId })
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  emitToProject(projectId, 'task_changed', { action: 'updated', task_id: Number(req.params.id), actor_id: req.user!.userId })
  dispatchWebhooks('task.updated', projectId, { task, previous_status: existing.status })
  res.json({ task, recurred_task_id })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  const existing = db.prepare('SELECT id, name, project_id FROM tasks WHERE id = ?').get(req.params.id) as { id: number; name: string; project_id: number } | undefined
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id)
  if (existing) {
    emitToProject(existing.project_id, 'task_changed', { action: 'deleted', task_id: existing.id, actor_id: req.user!.userId })
    dispatchWebhooks('task.deleted', existing.project_id, { task: existing })
  }
  res.json({ success: true })
})

// Walks the predecessor graph to reject dependencies that would create a cycle.
function wouldCreateCycle(predecessorId: number, successorId: number): boolean {
  if (predecessorId === successorId) return true
  const getPreds = db.prepare('SELECT predecessor_id FROM task_dependencies WHERE successor_id = ?')
  const visited = new Set<number>()
  const stack = [predecessorId]
  while (stack.length) {
    const current = stack.pop()!
    if (current === successorId) return true
    if (visited.has(current)) continue
    visited.add(current)
    for (const row of getPreds.all(current) as Array<{ predecessor_id: number }>) {
      stack.push(row.predecessor_id)
    }
  }
  return false
}

router.post('/:id/dependencies', authenticate, (req: Request, res: Response) => {
  const { predecessor_id, type, lag } = req.body
  const successorId = Number(req.params.id)
  if (!predecessor_id) return res.status(400).json({ error: 'predecessor_id required' })
  if (wouldCreateCycle(Number(predecessor_id), successorId)) {
    return res.status(400).json({ error: 'This dependency would create a cycle' })
  }
  db.prepare('INSERT OR IGNORE INTO task_dependencies (predecessor_id, successor_id, type, lag) VALUES (?, ?, ?, ?)').run(predecessor_id, req.params.id, type || 'FS', lag || 0)
  res.json({ success: true })
})

router.delete('/:id/dependencies/:predecessorId', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM task_dependencies WHERE predecessor_id = ? AND successor_id = ?').run(req.params.predecessorId, req.params.id)
  res.json({ success: true })
})

router.post('/:id/time', authenticate, (req: Request, res: Response) => {
  const { hours, date, description } = req.body
  const task = db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(req.params.id) as { project_id: number } | undefined
  if (!task) return res.status(404).json({ error: 'Task not found' })

  const result = db.prepare('INSERT INTO time_entries (task_id, user_id, project_id, hours, date, description) VALUES (?, ?, ?, ?, ?, ?)').run(req.params.id, req.user!.userId, task.project_id, hours, date, description || null)

  db.prepare('UPDATE tasks SET actual_hours = actual_hours + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hours, req.params.id)

  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ entry })
})

// CSV import — dry-run preview by default; pass commit:true to insert the
// valid rows. Returns the same validation payload either way so the UI can
// preview, then commit. Only rows with zero errors are written.
router.post('/project/:projectId/import', authenticate, (req: Request, res: Response) => {
  const { csv, commit } = req.body
  if (typeof csv !== 'string' || !csv.trim()) return res.status(400).json({ error: 'csv (string) required' })

  const projectId = Number(req.params.projectId)
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const { imported, updated, skipped, result } = importTasks(projectId, csv, commit === true, req.user!.userId)
  res.json(importPayload(commit === true, imported, updated, skipped, result))
})

// Inbound GitHub issue import. Pulls issues from a public (or, with a token,
// private) repo over the GitHub REST API, maps them onto the task-import CSV
// contract, then runs the SAME dry-run/commit pipeline as the CSV importer.
// Pull requests are skipped. Dry-run by default; pass commit:true to insert.
const GH_MAX_PAGES = 5 // up to 500 issues per import — keeps the call bounded
const GH_PER_PAGE = 100
// Defaults to github.com; override (no trailing slash) for GitHub Enterprise
// Server, e.g. GITHUB_API_BASE=https://github.acme.com/api/v3
const GH_API_BASE = (process.env.GITHUB_API_BASE || 'https://api.github.com').replace(/\/+$/, '')

async function fetchGithubIssues(owner: string, repo: string, state: string, labels: string | undefined, token: string | undefined): Promise<GithubIssue[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Portia-PPM',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const all: GithubIssue[] = []
  for (let page = 1; page <= GH_MAX_PAGES; page++) {
    const params = new URLSearchParams({ state, per_page: String(GH_PER_PAGE), page: String(page) })
    if (labels) params.set('labels', labels)
    const url = `${GH_API_BASE}/repos/${owner}/${repo}/issues?${params.toString()}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    let resp: globalThis.Response
    try {
      resp = await fetch(url, { headers, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }

    if (!resp.ok) {
      const status = resp.status
      let message = `GitHub API returned ${status}`
      if (status === 404) message = 'Repository not found (or private — provide a token with access)'
      else if (status === 401) message = 'GitHub token is invalid'
      else if (status === 403) message = 'GitHub API rate limit reached — provide a personal access token to raise it'
      const err = new Error(message) as Error & { httpStatus?: number }
      err.httpStatus = status
      throw err
    }

    const batch = (await resp.json()) as GithubIssue[]
    if (!Array.isArray(batch) || batch.length === 0) break
    all.push(...batch)
    if (batch.length < GH_PER_PAGE) break // last page
  }
  return all
}

router.post('/project/:projectId/import/github', authenticate, async (req: Request, res: Response) => {
  const { repo, state, labels, token, commit, sync } = req.body
  const ref = parseGithubRepo(typeof repo === 'string' ? repo : '')
  if (!ref) return res.status(400).json({ error: 'repo required — e.g. "owner/name" or a github.com URL' })

  const projectId = Number(req.params.projectId)
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const issueState = ['open', 'closed', 'all'].includes(state) ? state : 'open'
  const labelFilter = typeof labels === 'string' && labels.trim() ? labels.trim() : undefined
  const accessToken = typeof token === 'string' && token.trim() ? token.trim() : undefined

  let issues: GithubIssue[]
  try {
    issues = await fetchGithubIssues(ref.owner, ref.repo, issueState, labelFilter, accessToken)
  } catch (e) {
    const err = e as Error & { httpStatus?: number; name?: string }
    if (err.name === 'AbortError') return res.status(504).json({ error: 'GitHub request timed out' })
    return res.status(502).json({ error: err.message || 'Failed to reach GitHub' })
  }

  const csv = githubIssuesToCsv(issues)
  const { imported, updated, skipped, result } = importTasks(projectId, csv, commit === true, req.user!.userId, sync === true)
  res.json(importPayload(commit === true, imported, updated, skipped, result, {
    source: 'github',
    repo: `${ref.owner}/${ref.repo}`,
    fetched: issues.length,
    importable: countImportableIssues(issues),
  }))
})

// Inbound Jira issue import — the sibling of the GitHub importer. Fetches issues
// from the Jira REST API (Jira Cloud /rest/api/3/search, Basic email:token auth),
// maps them onto the task-import CSV contract, then runs the SAME dry-run/commit
// pipeline. Dry-run by default; pass commit:true to insert. Jira assignee emails
// resolve to local users; the Jira key becomes the wbs_code (so re-imports dedupe).
const JIRA_MAX_PAGES = 5 // up to 500 issues per import — keeps the call bounded
const JIRA_PER_PAGE = 100

async function fetchJiraIssues(base: string, jql: string, email: string, token: string): Promise<JiraIssue[]> {
  const auth = Buffer.from(`${email}:${token}`).toString('base64')
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'Portia-PPM',
    Authorization: `Basic ${auth}`,
  }
  const fields = 'summary,description,status,priority,assignee,duedate,issuetype'

  const all: JiraIssue[] = []
  for (let page = 0; page < JIRA_MAX_PAGES; page++) {
    const params = new URLSearchParams({
      jql,
      startAt: String(page * JIRA_PER_PAGE),
      maxResults: String(JIRA_PER_PAGE),
      fields,
    })
    const url = `${base}/rest/api/3/search?${params.toString()}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    let resp: globalThis.Response
    try {
      resp = await fetch(url, { headers, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }

    if (!resp.ok) {
      const status = resp.status
      let message = `Jira API returned ${status}`
      if (status === 401) message = 'Jira authentication failed — check the email and API token'
      else if (status === 403) message = 'Jira denied access — the account lacks permission for this project'
      else if (status === 404) message = 'Jira site or endpoint not found — check the base URL'
      else if (status === 400) {
        // Jira returns its JQL parse errors in errorMessages — surface the first.
        try {
          const j = (await resp.json()) as { errorMessages?: string[] }
          if (Array.isArray(j.errorMessages) && j.errorMessages.length) message = j.errorMessages[0]
        } catch { /* keep generic message */ }
      }
      const err = new Error(message) as Error & { httpStatus?: number }
      err.httpStatus = status
      throw err
    }

    const body = (await resp.json()) as { issues?: JiraIssue[]; total?: number }
    const batch = Array.isArray(body.issues) ? body.issues : []
    all.push(...batch)
    const total = typeof body.total === 'number' ? body.total : all.length
    if (batch.length < JIRA_PER_PAGE || all.length >= total) break // last page
  }
  return all
}

router.post('/project/:projectId/import/jira', authenticate, async (req: Request, res: Response) => {
  const { baseUrl, email, token, project, jql, commit, sync } = req.body
  const base = parseJiraBaseUrl(typeof baseUrl === 'string' ? baseUrl : '')
  if (!base) return res.status(400).json({ error: 'baseUrl required — e.g. "your-site.atlassian.net"' })
  if (typeof email !== 'string' || !email.trim()) return res.status(400).json({ error: 'email required (your Atlassian account email)' })
  if (typeof token !== 'string' || !token.trim()) return res.status(400).json({ error: 'token required (a Jira API token)' })

  const projectKey = typeof project === 'string' && project.trim() ? project.trim() : undefined
  const jqlRaw = typeof jql === 'string' && jql.trim() ? jql.trim() : undefined
  if (!projectKey && !jqlRaw) return res.status(400).json({ error: 'project (a Jira project key) or jql is required' })
  // A bare project key is the common case; an explicit JQL takes precedence.
  const effectiveJql = jqlRaw || `project = "${projectKey}" ORDER BY updated DESC`

  const projectId = Number(req.params.projectId)
  const projectRow = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)
  if (!projectRow) return res.status(404).json({ error: 'Project not found' })

  let issues: JiraIssue[]
  try {
    issues = await fetchJiraIssues(base, effectiveJql, email.trim(), token.trim())
  } catch (e) {
    const err = e as Error & { httpStatus?: number; name?: string }
    if (err.name === 'AbortError') return res.status(504).json({ error: 'Jira request timed out' })
    return res.status(502).json({ error: err.message || 'Failed to reach Jira' })
  }

  const csv = jiraIssuesToCsv(issues, { browseBase: base })
  const { imported, updated, skipped, result } = importTasks(projectId, csv, commit === true, req.user!.userId, sync === true)
  res.json(importPayload(commit === true, imported, updated, skipped, result, {
    source: 'jira',
    project: projectKey || effectiveJql,
    fetched: issues.length,
    importable: countImportableJira(issues),
  }))
})

export default router
