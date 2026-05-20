import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const { projectId } = req.params
  const sprints = db.prepare(`
    SELECT s.*,
      COUNT(DISTINCT t.id) as task_count,
      COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as done_count,
      COALESCE(SUM(t.story_points), 0) as total_points,
      COALESCE(SUM(CASE WHEN t.status = 'done' THEN t.story_points ELSE 0 END), 0) as completed_points
    FROM sprints s
    LEFT JOIN tasks t ON t.sprint = s.name AND t.project_id = s.project_id
    WHERE s.project_id = ?
    GROUP BY s.id
    ORDER BY s.start_date ASC
  `).all(projectId)
  res.json({ sprints })
})

router.post('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const { projectId } = req.params
  const { name, goal, start_date, end_date, capacity } = req.body
  const result = db.prepare(`
    INSERT INTO sprints (project_id, name, goal, start_date, end_date, status, capacity)
    VALUES (?, ?, ?, ?, ?, 'planning', ?)
  `).run(projectId, name, goal, start_date, end_date, capacity || 0)
  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ sprint })
})

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const { id } = req.params
  const { name, goal, start_date, end_date, status, capacity, velocity } = req.body
  db.prepare(`
    UPDATE sprints SET name=?, goal=?, start_date=?, end_date=?, status=?, capacity=?, velocity=?
    WHERE id=?
  `).run(name, goal, start_date, end_date, status, capacity || 0, velocity || 0, id)
  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(id)
  res.json({ sprint })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM sprints WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

router.get('/:id/burndown', authenticate, (req: Request, res: Response) => {
  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id) as any
  if (!sprint) return res.status(404).json({ error: 'Sprint not found' })

  const tasks = db.prepare(`
    SELECT story_points, status
    FROM tasks
    WHERE sprint = ? AND project_id = ? AND story_points > 0
  `).all(sprint.name, sprint.project_id) as any[]

  const totalPoints = tasks.reduce((s: number, t: any) => s + (t.story_points || 0), 0)
  const completedPoints = tasks
    .filter((t: any) => t.status === 'done')
    .reduce((s: number, t: any) => s + (t.story_points || 0), 0)

  const start = new Date(sprint.start_date)
  const end = new Date(sprint.end_date)
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  const pointsPerDay = totalPoints / totalDays

  const burndown = []
  const today = new Date()
  for (let i = 0; i <= totalDays; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    const d = date.toISOString().split('T')[0]
    const isPast = date <= today
    burndown.push({
      date: d,
      ideal: Math.max(0, Math.round(totalPoints - pointsPerDay * i)),
      actual: isPast ? Math.max(0, Math.round(totalPoints - completedPoints * (i / Math.max(1, totalDays)))) : null,
    })
  }

  res.json({ sprint, burndown, totalPoints, completedPoints })
})

// Velocity chart: past sprint velocities
router.get('/project/:projectId/velocity', authenticate, (req: Request, res: Response) => {
  const sprints = db.prepare(`
    SELECT s.id, s.name, s.start_date, s.end_date, s.status,
      COALESCE(SUM(t.story_points), 0) as total_points,
      COALESCE(SUM(CASE WHEN t.status = 'done' THEN t.story_points ELSE 0 END), 0) as completed_points,
      s.capacity
    FROM sprints s
    LEFT JOIN tasks t ON t.sprint = s.name AND t.project_id = s.project_id AND t.story_points > 0
    WHERE s.project_id = ? AND s.status IN ('completed', 'active')
    GROUP BY s.id
    ORDER BY s.start_date ASC LIMIT 12
  `).all(req.params.projectId) as Array<{ id: number; name: string; start_date: string; total_points: number; completed_points: number; capacity: number; status: string }>

  const avgVelocity = sprints.filter(s => s.status === 'completed').length > 0
    ? Math.round(sprints.filter(s => s.status === 'completed').reduce((a, s) => a + s.completed_points, 0) / sprints.filter(s => s.status === 'completed').length)
    : 0

  res.json({ sprints, avgVelocity })
})

export default router
