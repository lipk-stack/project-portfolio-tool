import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

const TEMPLATES = [
  {
    id: 'software-launch',
    name: 'Software Launch',
    description: 'Standard software development and launch lifecycle',
    icon: '🚀',
    category: 'Engineering',
    phases: ['Discovery', 'Design', 'Development', 'Testing', 'Launch'],
    tasks: [
      { name: 'Requirements gathering', status: 'todo', priority: 'high', wbs_code: '1.1', estimated_hours: 16, sprint: 'Sprint 1' },
      { name: 'Technical architecture design', status: 'todo', priority: 'high', wbs_code: '1.2', estimated_hours: 24, sprint: 'Sprint 1' },
      { name: 'UI/UX wireframes', status: 'todo', priority: 'medium', wbs_code: '2.1', estimated_hours: 20, sprint: 'Sprint 1' },
      { name: 'Design system setup', status: 'todo', priority: 'medium', wbs_code: '2.2', estimated_hours: 12, sprint: 'Sprint 1' },
      { name: 'Backend API development', status: 'todo', priority: 'high', wbs_code: '3.1', estimated_hours: 80, sprint: 'Sprint 2', story_points: 13 },
      { name: 'Frontend implementation', status: 'todo', priority: 'high', wbs_code: '3.2', estimated_hours: 60, sprint: 'Sprint 2', story_points: 13 },
      { name: 'Database schema design', status: 'todo', priority: 'high', wbs_code: '3.3', estimated_hours: 16, sprint: 'Sprint 2', story_points: 5 },
      { name: 'Integration testing', status: 'todo', priority: 'high', wbs_code: '4.1', estimated_hours: 24, sprint: 'Sprint 3', story_points: 8 },
      { name: 'Performance testing', status: 'todo', priority: 'medium', wbs_code: '4.2', estimated_hours: 16, sprint: 'Sprint 3', story_points: 5 },
      { name: 'Security audit', status: 'todo', priority: 'critical', wbs_code: '4.3', estimated_hours: 20, sprint: 'Sprint 3', story_points: 8 },
      { name: 'Staging deployment', status: 'todo', priority: 'high', wbs_code: '5.1', estimated_hours: 8, sprint: 'Sprint 4', story_points: 3 },
      { name: 'Production deployment', status: 'todo', priority: 'critical', wbs_code: '5.2', estimated_hours: 8, sprint: 'Sprint 4', story_points: 3 },
      { name: 'Go-live monitoring', status: 'todo', priority: 'high', wbs_code: '5.3', estimated_hours: 40, sprint: 'Sprint 4', story_points: 5 },
    ],
    milestones: [
      { name: 'Design Approved', offset_weeks: 2 },
      { name: 'Backend Alpha', offset_weeks: 6 },
      { name: 'Feature Complete', offset_weeks: 10 },
      { name: 'Go Live', offset_weeks: 14 },
    ],
    risks: [
      { title: 'Scope creep', probability: 3, impact: 4, category: 'scope' },
      { title: 'Key resource unavailability', probability: 2, impact: 4, category: 'resource' },
      { title: 'Third-party integration delays', probability: 3, impact: 3, category: 'technical' },
    ],
  },
  {
    id: 'digital-marketing',
    name: 'Marketing Campaign',
    description: 'End-to-end digital marketing campaign execution',
    icon: '📣',
    category: 'Marketing',
    phases: ['Strategy', 'Creative', 'Production', 'Launch', 'Analysis'],
    tasks: [
      { name: 'Campaign strategy definition', status: 'todo', priority: 'high', wbs_code: '1.1', estimated_hours: 12 },
      { name: 'Target audience research', status: 'todo', priority: 'high', wbs_code: '1.2', estimated_hours: 8 },
      { name: 'Budget allocation plan', status: 'todo', priority: 'medium', wbs_code: '1.3', estimated_hours: 4 },
      { name: 'Brand messaging & copy', status: 'todo', priority: 'high', wbs_code: '2.1', estimated_hours: 16 },
      { name: 'Visual asset design', status: 'todo', priority: 'high', wbs_code: '2.2', estimated_hours: 24 },
      { name: 'Video content production', status: 'todo', priority: 'medium', wbs_code: '3.1', estimated_hours: 40 },
      { name: 'Landing page development', status: 'todo', priority: 'high', wbs_code: '3.2', estimated_hours: 16 },
      { name: 'Email sequence setup', status: 'todo', priority: 'medium', wbs_code: '3.3', estimated_hours: 8 },
      { name: 'Social media scheduling', status: 'todo', priority: 'medium', wbs_code: '4.1', estimated_hours: 6 },
      { name: 'Paid ads launch', status: 'todo', priority: 'high', wbs_code: '4.2', estimated_hours: 8 },
      { name: 'Performance tracking setup', status: 'todo', priority: 'high', wbs_code: '5.1', estimated_hours: 8 },
      { name: 'Campaign analysis report', status: 'todo', priority: 'medium', wbs_code: '5.2', estimated_hours: 12 },
    ],
    milestones: [
      { name: 'Strategy Approved', offset_weeks: 1 },
      { name: 'Creative Assets Ready', offset_weeks: 4 },
      { name: 'Campaign Live', offset_weeks: 6 },
      { name: 'Final Report', offset_weeks: 10 },
    ],
    risks: [
      { title: 'Platform algorithm changes', probability: 3, impact: 3, category: 'external' },
      { title: 'Creative approval delays', probability: 2, impact: 2, category: 'schedule' },
    ],
  },
  {
    id: 'infrastructure-migration',
    name: 'Infrastructure Migration',
    description: 'Cloud infrastructure migration and modernization',
    icon: '☁️',
    category: 'Engineering',
    phases: ['Assessment', 'Planning', 'Migration', 'Testing', 'Cutover'],
    tasks: [
      { name: 'Current state assessment', status: 'todo', priority: 'critical', wbs_code: '1.1', estimated_hours: 24 },
      { name: 'Dependency mapping', status: 'todo', priority: 'high', wbs_code: '1.2', estimated_hours: 16 },
      { name: 'Target architecture design', status: 'todo', priority: 'high', wbs_code: '2.1', estimated_hours: 24 },
      { name: 'Migration runbook creation', status: 'todo', priority: 'high', wbs_code: '2.2', estimated_hours: 16 },
      { name: 'Dev environment migration', status: 'todo', priority: 'high', wbs_code: '3.1', estimated_hours: 20 },
      { name: 'Staging environment migration', status: 'todo', priority: 'high', wbs_code: '3.2', estimated_hours: 16 },
      { name: 'Data migration scripts', status: 'todo', priority: 'critical', wbs_code: '3.3', estimated_hours: 32 },
      { name: 'Performance benchmarking', status: 'todo', priority: 'high', wbs_code: '4.1', estimated_hours: 16 },
      { name: 'Failover testing', status: 'todo', priority: 'critical', wbs_code: '4.2', estimated_hours: 12 },
      { name: 'Security validation', status: 'todo', priority: 'critical', wbs_code: '4.3', estimated_hours: 16 },
      { name: 'Production cutover', status: 'todo', priority: 'critical', wbs_code: '5.1', estimated_hours: 12 },
      { name: 'Post-migration monitoring', status: 'todo', priority: 'high', wbs_code: '5.2', estimated_hours: 40 },
    ],
    milestones: [
      { name: 'Assessment Complete', offset_weeks: 2 },
      { name: 'Dev Migrated', offset_weeks: 5 },
      { name: 'Staging Validated', offset_weeks: 8 },
      { name: 'Production Cutover', offset_weeks: 10 },
    ],
    risks: [
      { title: 'Data loss during migration', probability: 1, impact: 5, category: 'technical' },
      { title: 'Service downtime', probability: 2, impact: 5, category: 'technical' },
      { title: 'Compliance gaps', probability: 2, impact: 4, category: 'compliance' },
      { title: 'Rollback complexity', probability: 3, impact: 4, category: 'technical' },
    ],
  },
  {
    id: 'product-discovery',
    name: 'Product Discovery',
    description: 'User research and product discovery process',
    icon: '🔍',
    category: 'Product',
    phases: ['Research', 'Synthesis', 'Ideation', 'Validation'],
    tasks: [
      { name: 'Stakeholder interviews', status: 'todo', priority: 'high', wbs_code: '1.1', estimated_hours: 16 },
      { name: 'User interviews', status: 'todo', priority: 'high', wbs_code: '1.2', estimated_hours: 24 },
      { name: 'Competitor analysis', status: 'todo', priority: 'medium', wbs_code: '1.3', estimated_hours: 12 },
      { name: 'Analytics review', status: 'todo', priority: 'medium', wbs_code: '1.4', estimated_hours: 8 },
      { name: 'Affinity mapping', status: 'todo', priority: 'high', wbs_code: '2.1', estimated_hours: 8 },
      { name: 'User personas', status: 'todo', priority: 'high', wbs_code: '2.2', estimated_hours: 8 },
      { name: 'Problem statement definition', status: 'todo', priority: 'high', wbs_code: '2.3', estimated_hours: 4 },
      { name: 'Solution ideation workshop', status: 'todo', priority: 'high', wbs_code: '3.1', estimated_hours: 8 },
      { name: 'Prototype creation', status: 'todo', priority: 'high', wbs_code: '3.2', estimated_hours: 20 },
      { name: 'Usability testing', status: 'todo', priority: 'high', wbs_code: '4.1', estimated_hours: 16 },
      { name: 'Discovery readout', status: 'todo', priority: 'medium', wbs_code: '4.2', estimated_hours: 8 },
    ],
    milestones: [
      { name: 'Research Complete', offset_weeks: 3 },
      { name: 'Problem Defined', offset_weeks: 5 },
      { name: 'Prototype Ready', offset_weeks: 7 },
      { name: 'Discovery Sign-off', offset_weeks: 9 },
    ],
    risks: [
      { title: 'Insufficient user participation', probability: 2, impact: 3, category: 'resource' },
      { title: 'Scope expansion', probability: 3, impact: 3, category: 'scope' },
    ],
  },
]

router.get('/', authenticate, (_req: Request, res: Response) => {
  res.json({ templates: TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description, icon: t.icon, category: t.category, task_count: t.tasks.length })) })
})

router.post('/apply/:templateId', authenticate, (req: Request, res: Response) => {
  const template = TEMPLATES.find(t => t.id === req.params.templateId)
  if (!template) return res.status(404).json({ error: 'Template not found' })

  const { project_id } = req.body
  if (!project_id) return res.status(400).json({ error: 'project_id required' })

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id) as Record<string, any> | undefined
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const startDate = project.start_date ? new Date(project.start_date) : new Date()

  const insertTask = db.prepare(`
    INSERT INTO tasks (project_id, name, status, priority, wbs_code, estimated_hours, sprint, story_points, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertMilestone = db.prepare(`
    INSERT INTO milestones (project_id, name, date, status) VALUES (?, ?, ?, 'upcoming')
  `)

  const insertRisk = db.prepare(`
    INSERT INTO risks (project_id, title, probability, impact, score, status, category)
    VALUES (?, ?, ?, ?, ?, 'open', ?)
  `)

  db.transaction(() => {
    template.tasks.forEach((t, i) => {
      insertTask.run(project_id, t.name, t.status, t.priority, t.wbs_code, t.estimated_hours, (t as any).sprint || null, (t as any).story_points || null, i + 1)
    })
    template.milestones.forEach(m => {
      const d = new Date(startDate)
      d.setDate(d.getDate() + m.offset_weeks * 7)
      insertMilestone.run(project_id, m.name, d.toISOString().split('T')[0])
    })
    template.risks.forEach(r => {
      insertRisk.run(project_id, r.title, r.probability, r.impact, r.probability * r.impact, r.category)
    })
    db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run('project', project_id, req.user!.userId, 'template_applied', JSON.stringify({ template: template.name }))
  })()

  res.json({ message: 'Template applied', tasks: template.tasks.length, milestones: template.milestones.length, risks: template.risks.length })
})

export default router
