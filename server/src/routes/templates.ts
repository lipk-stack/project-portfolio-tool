import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', authenticate, (_req: Request, res: Response) => {
  const templates = db.prepare(`
    SELECT pt.*, u.name as created_by_name FROM project_templates pt
    LEFT JOIN users u ON u.id = pt.created_by
    ORDER BY pt.is_system DESC, pt.created_at DESC
  `).all()
  res.json({ templates })
})

router.post('/', authenticate, (req: Request, res: Response) => {
  const { name, description, category, template_data } = req.body
  if (!name || !template_data) return res.status(400).json({ error: 'Name and template data required' })

  const result = db.prepare(`
    INSERT INTO project_templates (name, description, category, template_data, created_by, is_system)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(name, description || null, category || 'custom', JSON.stringify(template_data), req.user!.userId)

  const template = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ template })
})

router.post('/from-project/:projectId', authenticate, (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as Record<string, unknown> | undefined
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY position ASC').all(req.params.projectId) as Array<Record<string, unknown>>
  const milestones = db.prepare('SELECT * FROM milestones WHERE project_id = ?').all(req.params.projectId) as Array<Record<string, unknown>>
  const risks = db.prepare('SELECT title, description, category, probability, impact FROM risks WHERE project_id = ?').all(req.params.projectId) as Array<Record<string, unknown>>

  const templateData = {
    defaultPhase: project.phase,
    tasks: tasks.map(t => ({
      name: t.name, description: t.description, priority: t.priority,
      estimated_hours: t.estimated_hours, wbs_code: t.wbs_code,
      story_points: t.story_points, tags: t.tags,
    })),
    milestones: milestones.map(m => ({ name: m.name, description: m.description })),
    risks: risks,
  }

  const { name, description, category } = req.body
  const result = db.prepare(`
    INSERT INTO project_templates (name, description, category, template_data, created_by, is_system)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(
    name || `${project.name} Template`,
    description || `Template based on ${project.name}`,
    category || 'custom',
    JSON.stringify(templateData),
    req.user!.userId
  )

  const template = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ template })
})

router.post('/:id/create-project', authenticate, (req: Request, res: Response) => {
  const template = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(req.params.id) as {
    id: number; name: string; template_data: string
  } | undefined
  if (!template) return res.status(404).json({ error: 'Template not found' })

  const { name, portfolio_id, start_date, manager_id, color } = req.body
  if (!name) return res.status(400).json({ error: 'Project name required' })

  const data = JSON.parse(template.template_data)

  const projectResult = db.prepare(`
    INSERT INTO projects (name, portfolio_id, status, priority, health, phase, start_date, manager_id, color)
    VALUES (?, ?, 'planning', 'medium', 'green', ?, ?, ?, ?)
  `).run(name, portfolio_id || null, data.defaultPhase || 'initiation', start_date || null, manager_id || req.user!.userId, color || '#3B82F6')

  const projectId = projectResult.lastInsertRowid

  db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(projectId, req.user!.userId, 'manager')

  if (data.tasks) {
    const insertTask = db.prepare(`INSERT INTO tasks (project_id, name, description, priority, estimated_hours, wbs_code, story_points, tags, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'todo')`)
    for (const t of data.tasks) {
      insertTask.run(projectId, t.name, t.description || null, t.priority || 'medium', t.estimated_hours || 0, t.wbs_code || null, t.story_points || null, t.tags || null)
    }
  }

  if (data.milestones) {
    const insertMilestone = db.prepare(`INSERT INTO milestones (project_id, name, description, date, status) VALUES (?, ?, ?, date('now', '+30 days'), 'upcoming')`)
    for (const m of data.milestones) {
      insertMilestone.run(projectId, m.name, m.description || null)
    }
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId)
  res.status(201).json({ project })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  const template = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(req.params.id) as { created_by: number; is_system: number } | undefined
  if (!template) return res.status(404).json({ error: 'Template not found' })
  if (template.is_system) return res.status(403).json({ error: 'Cannot delete system templates' })
  if (template.created_by !== req.user!.userId && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' })
  }
  db.prepare('DELETE FROM project_templates WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
