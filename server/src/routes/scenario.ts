import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'
import { applyScenario, ScenarioTask, ScenarioDep, ScenarioChange } from '../lib/scenario'

const router = Router()

router.post('/project/:id/simulate', authenticate, (req: Request, res: Response) => {
  const project = db.prepare('SELECT id, name, end_date FROM projects WHERE id = ?').get(req.params.id)
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const changes: ScenarioChange[] = Array.isArray(req.body.changes) ? req.body.changes : []
  for (const c of changes) {
    if (typeof c.task_id !== 'number') return res.status(400).json({ error: 'Each change requires a numeric task_id' })
    if (c.shift_days != null && Math.abs(c.shift_days) > 365) return res.status(400).json({ error: 'shift_days must be within ±365' })
    if (c.duration_delta_days != null && Math.abs(c.duration_delta_days) > 365) return res.status(400).json({ error: 'duration_delta_days must be within ±365' })
  }

  const tasks = db.prepare(`
    SELECT t.id, t.name, t.start_date, t.end_date, t.estimated_hours, t.status,
      COALESCE(u.hourly_rate, 0) as hourly_rate
    FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.project_id = ? AND t.status NOT IN ('done')
    ORDER BY t.position ASC
  `).all(req.params.id) as ScenarioTask[]

  const deps = db.prepare(`
    SELECT td.predecessor_id, td.successor_id, td.lag
    FROM task_dependencies td JOIN tasks t ON t.id = td.predecessor_id
    WHERE t.project_id = ?
  `).all(req.params.id) as ScenarioDep[]

  const result = applyScenario(tasks, deps, changes)
  res.json(result)
})

export default router
