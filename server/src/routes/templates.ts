import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

// GET /templates - list all templates
router.get('/', authenticate, (_req: Request, res: Response) => {
  const templates = db.prepare('SELECT * FROM project_templates ORDER BY is_builtin DESC, category ASC, name ASC').all()
  res.json({ templates: (templates as Array<Record<string, unknown>>).map(t => ({
    ...t,
    tasks: JSON.parse(t.tasks as string),
    milestones: JSON.parse(t.milestones as string),
  })) })
})

// GET /templates/:id
router.get('/:id', authenticate, (req: Request, res: Response) => {
  const t = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!t) return res.status(404).json({ error: 'Template not found' })
  res.json({ template: { ...t, tasks: JSON.parse(t.tasks as string), milestones: JSON.parse(t.milestones as string) } })
})

// POST /templates - create custom template
router.post('/', authenticate, (req: Request, res: Response) => {
  const { name, description, category, icon, tasks, milestones, duration_days } = req.body
  if (!name) return res.status(400).json({ error: 'Name required' })

  const result = db.prepare(`
    INSERT INTO project_templates (name, description, category, icon, tasks, milestones, duration_days, created_by, is_builtin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(name, description || null, category || 'general', icon || '📋', JSON.stringify(tasks || []), JSON.stringify(milestones || []), duration_days || 90, req.user!.userId)

  const template = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>
  res.status(201).json({ template: { ...template, tasks: JSON.parse(template.tasks as string), milestones: JSON.parse(template.milestones as string) } })
})

// POST /templates/:id/apply - create a project from a template
router.post('/:id/apply', authenticate, (req: Request, res: Response) => {
  const { name, description, portfolio_id, manager_id, start_date, budget, color, priority } = req.body
  if (!name) return res.status(400).json({ error: 'Project name required' })

  const t = db.prepare('SELECT * FROM project_templates WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!t) return res.status(404).json({ error: 'Template not found' })

  const tasks = JSON.parse(t.tasks as string) as Array<Record<string, unknown>>
  const milestones = JSON.parse(t.milestones as string) as Array<{ name: string; offset_days: number }>
  const durationDays = (t.duration_days as number) || 90

  const startDateParsed = start_date ? new Date(start_date) : new Date()
  const endDate = new Date(startDateParsed)
  endDate.setDate(endDate.getDate() + durationDays)

  const formatDate = (d: Date) => d.toISOString().split('T')[0]

  // Create the project
  const projResult = db.prepare(`
    INSERT INTO projects (portfolio_id, name, description, status, priority, health, start_date, end_date, completion_percent, budget, spent, manager_id, color)
    VALUES (?, ?, ?, 'planning', ?, 'green', ?, ?, 0, ?, 0, ?, ?)
  `).run(portfolio_id || null, name, description || null, priority || 'medium', formatDate(startDateParsed), formatDate(endDate), budget || 0, manager_id || req.user!.userId, color || '#3B82F6')

  const projectId = projResult.lastInsertRowid as number

  // Create tasks from template
  const insertTask = db.prepare(`
    INSERT INTO tasks (project_id, name, status, priority, estimated_hours, wbs_code, position)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  db.transaction(() => {
    tasks.forEach((task, i) => {
      insertTask.run(projectId, task.name, task.status || 'todo', task.priority || 'medium', task.estimated_hours || 0, task.wbs_code || null, i)
    })
  })()

  // Create milestones from template
  const insertMilestone = db.prepare(`INSERT INTO milestones (project_id, name, date, status) VALUES (?, ?, ?, 'upcoming')`)
  db.transaction(() => {
    milestones.forEach(ms => {
      const msDate = new Date(startDateParsed)
      msDate.setDate(msDate.getDate() + ms.offset_days)
      insertMilestone.run(projectId, ms.name, formatDate(msDate))
    })
  })()

  // Add creator as project manager
  db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role, allocation_percent) VALUES (?, ?, ?, 100)').run(projectId, req.user!.userId, 'manager')

  db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run('project', projectId, req.user!.userId, 'created', JSON.stringify({ name, template: t.name }))

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId)
  res.status(201).json({ project, projectId })
})

// PUT /templates/:id
router.put('/:id', authenticate, (req: Request, res: Response) => {
  const { name, description, category, icon, tasks, milestones, duration_days } = req.body
  const t = db.prepare('SELECT * FROM project_templates WHERE id = ? AND is_builtin = 0').get(req.params.id)
  if (!t) return res.status(404).json({ error: 'Template not found or cannot edit built-in template' })

  db.prepare(`UPDATE project_templates SET name=?, description=?, category=?, icon=?, tasks=?, milestones=?, duration_days=? WHERE id=?`).run(
    name, description || null, category || 'general', icon || '📋', JSON.stringify(tasks || []), JSON.stringify(milestones || []), duration_days || 90, req.params.id
  )
  res.json({ success: true })
})

// DELETE /templates/:id
router.delete('/:id', authenticate, (req: Request, res: Response) => {
  const t = db.prepare('SELECT * FROM project_templates WHERE id = ? AND is_builtin = 0').get(req.params.id)
  if (!t) return res.status(404).json({ error: 'Cannot delete built-in template' })
  db.prepare('DELETE FROM project_templates WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// POST /templates/from-project/:projectId - save project as template
router.post('/from-project/:projectId', authenticate, (req: Request, res: Response) => {
  const { name, description, category, icon } = req.body
  if (!name) return res.status(400).json({ error: 'Template name required' })

  const tasks = db.prepare(`
    SELECT name, status, priority, estimated_hours, wbs_code
    FROM tasks WHERE project_id = ? AND parent_id IS NULL ORDER BY position
  `).all(req.params.projectId) as Array<Record<string, unknown>>

  const milestones = db.prepare('SELECT name FROM milestones WHERE project_id = ?').all(req.params.projectId) as Array<{ name: string }>
  const project = db.prepare('SELECT start_date, end_date FROM projects WHERE id = ?').get(req.params.projectId) as { start_date?: string; end_date?: string } | undefined

  let durationDays = 90
  if (project?.start_date && project?.end_date) {
    const s = new Date(project.start_date)
    const e = new Date(project.end_date)
    durationDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000))
  }

  const templateTasks = tasks.map(t => ({ name: t.name, status: 'todo', priority: t.priority, estimated_hours: t.estimated_hours, wbs_code: t.wbs_code }))
  const templateMilestones = milestones.map((m, i) => ({ name: m.name, offset_days: Math.round(durationDays * (i + 1) / (milestones.length + 1)) }))

  const result = db.prepare(`
    INSERT INTO project_templates (name, description, category, icon, tasks, milestones, duration_days, created_by, is_builtin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(name, description || null, category || 'custom', icon || '📁', JSON.stringify(templateTasks), JSON.stringify(templateMilestones), durationDays, req.user!.userId)

  res.status(201).json({ id: result.lastInsertRowid })
})

export default router
