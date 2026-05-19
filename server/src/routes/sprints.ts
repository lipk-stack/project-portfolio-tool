import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const sprints = db.prepare(`
    SELECT s.*,
      COUNT(t.id) as total_tasks,
      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_tasks,
      COALESCE(SUM(t.story_points), 0) as total_points,
      COALESCE(SUM(CASE WHEN t.status = 'done' THEN t.story_points ELSE 0 END), 0) as completed_points
    FROM sprints s
    LEFT JOIN tasks t ON t.sprint = s.name AND t.project_id = s.project_id
    WHERE s.project_id = ?
    GROUP BY s.id
    ORDER BY s.start_date DESC
  `).all(req.params.projectId)
  res.json({ sprints })
})

router.post('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const { name, goal, start_date, end_date, status } = req.body
  if (!name) return res.status(400).json({ error: 'Sprint name required' })

  const result = db.prepare(`
    INSERT INTO sprints (project_id, name, goal, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.projectId, name, goal || null, start_date || null, end_date || null, status || 'planned')

  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ sprint })
})

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const { name, goal, start_date, end_date, status, velocity } = req.body
  db.prepare(`
    UPDATE sprints SET name=?, goal=?, start_date=?, end_date=?, status=?, velocity=? WHERE id=?
  `).run(name, goal || null, start_date || null, end_date || null, status, velocity || 0, req.params.id)

  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id)
  res.json({ sprint })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM sprints WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.get('/:id/burndown', authenticate, (req: Request, res: Response) => {
  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id) as {
    id: number; project_id: number; name: string; start_date: string; end_date: string
  } | undefined
  if (!sprint) return res.status(404).json({ error: 'Sprint not found' })

  const tasks = db.prepare(`
    SELECT t.*, te.date as completed_date
    FROM tasks t
    LEFT JOIN (
      SELECT task_id, MIN(date) as date FROM time_entries GROUP BY task_id
    ) te ON te.task_id = t.id
    WHERE t.project_id = ? AND t.sprint = ?
  `).all(sprint.project_id, sprint.name) as Array<{ story_points: number; status: string; completed_date?: string; updated_at: string }>

  const totalPoints = tasks.reduce((s, t) => s + (t.story_points || 0), 0)

  if (!sprint.start_date || !sprint.end_date) {
    return res.json({ burndown: [], totalPoints, sprint })
  }

  const start = new Date(sprint.start_date)
  const end = new Date(sprint.end_date)
  const days: Array<{ date: string; remaining: number; ideal: number }> = []

  let d = new Date(start)
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))

  while (d <= end) {
    const dateStr = d.toISOString().split('T')[0]
    const completed = tasks
      .filter(t => t.status === 'done' && t.updated_at?.split('T')[0] <= dateStr)
      .reduce((s, t) => s + (t.story_points || 0), 0)
    const dayIndex = Math.ceil((d.getTime() - start.getTime()) / 86400000)
    days.push({
      date: dateStr,
      remaining: totalPoints - completed,
      ideal: Math.max(0, totalPoints * (1 - dayIndex / totalDays)),
    })
    d = new Date(d.getTime() + 86400000)
  }

  res.json({ burndown: days, totalPoints, sprint })
})

export default router
