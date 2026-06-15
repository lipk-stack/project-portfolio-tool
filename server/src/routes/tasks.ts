import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'
import { runAutomations } from '../lib/automationRunner'
import { saveCustomValues } from './customFields'
import { createNotification } from '../lib/notify'
import { emitToProject } from '../lib/realtime'
import { dispatchWebhooks } from '../lib/webhookDispatcher'
import { computeNextOccurrence, isValidRecurrence } from '../lib/recurrence'
import { buildTaskImport, ImportUser, TASK_IMPORT_TEMPLATE } from '../lib/csvImport'

const router = Router()

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

  const users = db.prepare('SELECT id, name, email FROM users').all() as ImportUser[]
  const result = buildTaskImport(csv, users)

  let imported = 0
  if (commit === true && result.validCount > 0) {
    const maxPos = (db.prepare('SELECT MAX(position) as mp FROM tasks WHERE project_id = ?').get(projectId) as { mp: number }).mp || 0
    const insert = db.prepare(`
      INSERT INTO tasks (project_id, name, description, status, priority, assignee_id,
        start_date, end_date, estimated_hours, story_points, wbs_code, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertMany = db.transaction(() => {
      let pos = maxPos
      for (const row of result.rows) {
        if (row.errors.length > 0) continue
        pos++
        insert.run(projectId, row.name, row.description, row.status, row.priority, row.assignee_id,
          row.start_date, row.end_date, row.estimated_hours, row.story_points, row.wbs_code, pos)
        imported++
      }
    })
    insertMany()
    db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)')
      .run('project', projectId, req.user!.userId, 'tasks_imported', JSON.stringify({ count: imported }))
    emitToProject(projectId, 'task_changed', { action: 'imported', actor_id: req.user!.userId })
  }

  res.json({
    committed: commit === true,
    imported,
    headers: result.headers,
    mappedColumns: result.mappedColumns,
    unmappedHeaders: result.unmappedHeaders,
    validCount: result.validCount,
    errorCount: result.errorCount,
    rows: result.rows,
  })
})

export default router
