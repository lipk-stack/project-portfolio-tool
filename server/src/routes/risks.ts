import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'
import { runAutomations } from '../lib/automationRunner'
import { dispatchWebhooks } from '../lib/webhookDispatcher'
import { buildRiskImport, ImportUser, RISK_IMPORT_TEMPLATE } from '../lib/csvImport'

const router = Router()

const LEVEL_MAP: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }

function calcScore(probability: string, impact: string): number {
  return (LEVEL_MAP[probability] || 2) * (LEVEL_MAP[impact] || 2)
}

// Downloadable CSV template for the risk importer.
router.get('/import/template', authenticate, (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="risk-import-template.csv"')
  res.send(RISK_IMPORT_TEMPLATE)
})

router.get('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const risks = db.prepare(`
    SELECT r.*, u.name as owner_name
    FROM risks r LEFT JOIN users u ON u.id = r.owner_id
    WHERE r.project_id = ?
    ORDER BY r.score DESC, r.created_at DESC
  `).all(req.params.projectId)
  res.json({ risks })
})

router.post('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const { title, description, category, probability, impact, status, response, mitigation_plan, owner_id, identified_date, target_date } = req.body
  if (!title) return res.status(400).json({ error: 'Title required' })

  const score = calcScore(probability || 'medium', impact || 'medium')
  const result = db.prepare(`
    INSERT INTO risks (project_id, title, description, category, probability, impact, score, status, response, mitigation_plan, owner_id, identified_date, target_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.projectId, title, description || null, category || 'general', probability || 'medium', impact || 'medium', score, status || 'open', response || null, mitigation_plan || null, owner_id || req.user!.userId, identified_date || new Date().toISOString().split('T')[0], target_date || null)

  db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run('project', req.params.projectId, req.user!.userId, 'risk_raised', JSON.stringify({ title }))

  runAutomations({
    type: 'risk_created',
    projectId: Number(req.params.projectId),
    risk: { id: Number(result.lastInsertRowid), title, score, status: status || 'open' },
  }, req.user!.userId)

  const risk = db.prepare('SELECT * FROM risks WHERE id = ?').get(result.lastInsertRowid)
  dispatchWebhooks('risk.created', Number(req.params.projectId), { risk })
  res.status(201).json({ risk })
})

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const { title, description, category, probability, impact, status, response, mitigation_plan, owner_id, identified_date, target_date } = req.body
  const score = calcScore(probability || 'medium', impact || 'medium')
  db.prepare(`
    UPDATE risks SET title=?, description=?, category=?, probability=?, impact=?, score=?,
      status=?, response=?, mitigation_plan=?, owner_id=?, identified_date=?, target_date=?
    WHERE id=?
  `).run(title, description || null, category, probability, impact, score, status, response || null, mitigation_plan || null, owner_id || null, identified_date, target_date || null, req.params.id)

  const risk = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id) as { project_id: number } | undefined
  if (risk) {
    runAutomations({
      type: 'risk_updated',
      projectId: risk.project_id,
      risk: { id: Number(req.params.id), title, score, status },
    }, req.user!.userId)
    dispatchWebhooks('risk.updated', risk.project_id, { risk })
  }
  res.json({ risk })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM risks WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// CSV import — dry-run preview by default; pass commit:true to insert the
// valid rows. Mirrors the task importer.
router.post('/project/:projectId/import', authenticate, (req: Request, res: Response) => {
  const { csv, commit } = req.body
  if (typeof csv !== 'string' || !csv.trim()) return res.status(400).json({ error: 'csv (string) required' })

  const projectId = Number(req.params.projectId)
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const users = db.prepare('SELECT id, name, email FROM users').all() as ImportUser[]
  const result = buildRiskImport(csv, users)

  let imported = 0
  if (commit === true && result.validCount > 0) {
    const insert = db.prepare(`
      INSERT INTO risks (project_id, title, description, category, probability, impact, score,
        status, response, mitigation_plan, owner_id, identified_date, target_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const today = new Date().toISOString().split('T')[0]
    const insertMany = db.transaction(() => {
      for (const row of result.rows) {
        if (row.errors.length > 0) continue
        insert.run(projectId, row.title, row.description, row.category, row.probability, row.impact, row.score,
          row.status, row.response, row.mitigation_plan, row.owner_id ?? req.user!.userId,
          row.identified_date ?? today, row.target_date)
        imported++
      }
    })
    insertMany()
    db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)')
      .run('project', projectId, req.user!.userId, 'risks_imported', JSON.stringify({ count: imported }))
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

router.get('/portfolio/summary', authenticate, (_req: Request, res: Response) => {
  const risksByProject = db.prepare(`
    SELECT p.id as project_id, p.name as project_name, p.color,
      COUNT(*) as total_risks,
      SUM(CASE WHEN r.status != 'closed' AND r.score >= 6 THEN 1 ELSE 0 END) as high_risks,
      SUM(CASE WHEN r.status = 'open' THEN 1 ELSE 0 END) as open_risks
    FROM risks r JOIN projects p ON p.id = r.project_id
    GROUP BY p.id ORDER BY high_risks DESC
  `).all()

  const riskMatrix = db.prepare(`
    SELECT probability, impact, COUNT(*) as count
    FROM risks WHERE status != 'closed'
    GROUP BY probability, impact
  `).all()

  res.json({ risksByProject, riskMatrix })
})

export default router
