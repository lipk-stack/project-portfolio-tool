import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/mine', authenticate, (req: Request, res: Response) => {
  const tasks = db.prepare(`
    SELECT t.*, u.name as assignee_name,
           p.name as project_name, p.color as project_color, p.id as project_id
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.assignee_id = ? AND t.status != 'done' AND p.status = 'active'
    ORDER BY
      CASE WHEN t.end_date < date('now') THEN 0
           WHEN t.end_date = date('now') THEN 1
           WHEN t.end_date <= date('now', '+7 days') THEN 2
           ELSE 3 END,
      t.end_date ASC NULLS LAST, t.priority DESC
  `).all(req.user!.userId)

  const completed = db.prepare(`
    SELECT COUNT(*) as count FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.assignee_id = ? AND t.status = 'done' AND t.updated_at >= date('now', '-7 days')
  `).get(req.user!.userId) as { count: number }

  const today = new Date().toISOString().split('T')[0]
  const inWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  const grouped = {
    overdue: (tasks as any[]).filter(t => t.end_date && t.end_date < today),
    today: (tasks as any[]).filter(t => t.end_date === today),
    upcoming: (tasks as any[]).filter(t => t.end_date && t.end_date > today && t.end_date <= inWeek),
    later: (tasks as any[]).filter(t => !t.end_date || t.end_date > inWeek),
  }

  res.json({ tasks, grouped, completedThisWeek: completed.count })
})

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

router.post('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const { name, description, parent_id, status, priority, assignee_id, start_date, end_date, estimated_hours, wbs_code, position, sprint, story_points, tags } = req.body
  if (!name) return res.status(400).json({ error: 'Task name required' })

  const maxPos = (db.prepare('SELECT MAX(position) as mp FROM tasks WHERE project_id = ?').get(req.params.projectId) as { mp: number }).mp || 0

  const result = db.prepare(`
    INSERT INTO tasks (project_id, parent_id, name, description, status, priority, assignee_id,
      start_date, end_date, estimated_hours, wbs_code, position, sprint, story_points, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.projectId, parent_id || null, name, description || null,
    status || 'todo', priority || 'medium', assignee_id || null,
    start_date || null, end_date || null, estimated_hours || 0,
    wbs_code || null, position ?? (maxPos + 1), sprint || null,
    story_points || null, tags ? JSON.stringify(tags) : null
  )

  db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run('project', req.params.projectId, req.user!.userId, 'task_created', JSON.stringify({ name }))

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ task })
})

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!existing) return res.status(404).json({ error: 'Task not found' })

  const { name, description, status, priority, assignee_id, start_date, end_date, estimated_hours, actual_hours, completion_percent, wbs_code, position, sprint, story_points, tags, is_critical } = req.body

  db.prepare(`
    UPDATE tasks SET name=?, description=?, status=?, priority=?, assignee_id=?,
      start_date=?, end_date=?, estimated_hours=?, actual_hours=?, completion_percent=?,
      wbs_code=?, position=?, sprint=?, story_points=?, tags=?, is_critical=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(name, description || null, status, priority, assignee_id || null,
    start_date || null, end_date || null, estimated_hours || 0, actual_hours || 0,
    completion_percent || 0, wbs_code || null, position ?? existing.position,
    sprint || null, story_points || null, tags ? JSON.stringify(tags) : null,
    is_critical ? 1 : 0, req.params.id)

  if (existing.status !== status) {
    db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run('project', existing.project_id, req.user!.userId, 'task_status_changed', JSON.stringify({ task: name, from: existing.status, to: status }))
    if (status === 'done') {
      db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run('project', existing.project_id, req.user!.userId, 'task_completed', JSON.stringify({ task: name }))
    }
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  res.json({ task })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.post('/:id/dependencies', authenticate, (req: Request, res: Response) => {
  const { predecessor_id, type, lag } = req.body
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

router.get('/:id/comments', authenticate, (req: Request, res: Response) => {
  const comments = db.prepare(`
    SELECT c.*, u.name as author_name FROM comments c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.entity_type = 'task' AND c.entity_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.id)
  res.json({ comments })
})

router.post('/:id/comments', authenticate, (req: Request, res: Response) => {
  const { content } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' })
  const result = db.prepare('INSERT INTO comments (entity_type, entity_id, user_id, content) VALUES (?, ?, ?, ?)').run('task', req.params.id, req.user!.userId, content.trim())
  const comment = db.prepare('SELECT c.*, u.name as author_name FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?').get(result.lastInsertRowid)
  res.status(201).json({ comment })
})

router.delete('/:taskId/comments/:commentId', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM comments WHERE id = ? AND user_id = ?').run(req.params.commentId, req.user!.userId)
  res.json({ success: true })
})

export default router
