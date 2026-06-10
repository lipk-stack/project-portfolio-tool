import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'
import { computeBurndown, computeVelocity, AgileTask } from '../lib/agile'

const router = Router()

router.get('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const sprints = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM tasks t WHERE t.sprint_id = s.id) as task_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.sprint_id = s.id AND t.status = 'done') as done_count,
      (SELECT COALESCE(SUM(t.story_points), 0) FROM tasks t WHERE t.sprint_id = s.id) as total_points,
      (SELECT COALESCE(SUM(t.story_points), 0) FROM tasks t WHERE t.sprint_id = s.id AND t.status = 'done') as done_points
    FROM sprints s
    WHERE s.project_id = ?
    ORDER BY s.start_date ASC
  `).all(req.params.projectId)
  res.json({ sprints })
})

router.post('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const { name, goal, start_date, end_date } = req.body
  if (!name) return res.status(400).json({ error: 'Sprint name required' })

  const result = db.prepare(`
    INSERT INTO sprints (project_id, name, goal, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, 'planned')
  `).run(req.params.projectId, name, goal || null, start_date || null, end_date || null)

  db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)')
    .run('project', req.params.projectId, req.user!.userId, 'sprint_created', JSON.stringify({ name }))

  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ sprint })
})

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!existing) return res.status(404).json({ error: 'Sprint not found' })

  const { name, goal, start_date, end_date, status } = req.body
  db.prepare(`
    UPDATE sprints SET name = ?, goal = ?, start_date = ?, end_date = ?, status = ?
    WHERE id = ?
  `).run(
    name ?? existing.name, goal ?? existing.goal,
    start_date ?? existing.start_date, end_date ?? existing.end_date,
    status ?? existing.status, req.params.id
  )

  if (status && status !== existing.status) {
    db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)')
      .run('project', existing.project_id, req.user!.userId, 'sprint_status_changed', JSON.stringify({ sprint: existing.name, from: existing.status, to: status }))
  }

  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id)
  res.json({ sprint })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('UPDATE tasks SET sprint_id = NULL WHERE sprint_id = ?').run(req.params.id)
  db.prepare('DELETE FROM sprints WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.post('/:id/tasks', authenticate, (req: Request, res: Response) => {
  const { task_ids } = req.body as { task_ids: number[] }
  if (!Array.isArray(task_ids) || task_ids.length === 0) {
    return res.status(400).json({ error: 'task_ids array required' })
  }
  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id)
  if (!sprint) return res.status(404).json({ error: 'Sprint not found' })

  const assign = db.prepare('UPDATE tasks SET sprint_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  db.transaction(() => { for (const tid of task_ids) assign.run(req.params.id, tid) })()
  res.json({ success: true })
})

router.delete('/tasks/:taskId', authenticate, (req: Request, res: Response) => {
  db.prepare('UPDATE tasks SET sprint_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.taskId)
  res.json({ success: true })
})

router.get('/:id/burndown', authenticate, (req: Request, res: Response) => {
  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id) as { start_date: string; end_date: string } | undefined
  if (!sprint) return res.status(404).json({ error: 'Sprint not found' })
  if (!sprint.start_date || !sprint.end_date) return res.json({ totalPoints: 0, days: [] })

  const tasks = db.prepare('SELECT id, story_points, status, actual_end, updated_at FROM tasks WHERE sprint_id = ?').all(req.params.id) as AgileTask[]
  res.json(computeBurndown(sprint, tasks))
})

router.get('/project/:projectId/velocity', authenticate, (req: Request, res: Response) => {
  const sprints = db.prepare(`
    SELECT id, name, status FROM sprints
    WHERE project_id = ? ORDER BY start_date ASC
  `).all(req.params.projectId) as Array<{ id: number; name: string; status: string }>

  const tasksBySprint: Record<number, AgileTask[]> = {}
  const taskStmt = db.prepare('SELECT id, story_points, status, actual_end, updated_at FROM tasks WHERE sprint_id = ?')
  for (const s of sprints) tasksBySprint[s.id] = taskStmt.all(s.id) as AgileTask[]

  res.json({ velocity: computeVelocity(sprints, tasksBySprint) })
})

export default router
