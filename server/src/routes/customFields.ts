import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

const FIELD_TYPES = ['text', 'number', 'select', 'date']

router.get('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const fields = db.prepare(`
    SELECT * FROM custom_fields WHERE project_id = ? ORDER BY position ASC, id ASC
  `).all(req.params.projectId) as Array<Record<string, unknown>>
  res.json({ fields: fields.map(f => ({ ...f, options: f.options ? JSON.parse(f.options as string) : null })) })
})

router.post('/project/:projectId', authenticate, (req: Request, res: Response) => {
  const { name, field_type, options } = req.body
  if (!name) return res.status(400).json({ error: 'Field name required' })
  if (!FIELD_TYPES.includes(field_type)) return res.status(400).json({ error: `field_type must be one of ${FIELD_TYPES.join(', ')}` })
  if (field_type === 'select' && (!Array.isArray(options) || options.length === 0)) {
    return res.status(400).json({ error: 'select fields require a non-empty options array' })
  }

  const maxPos = (db.prepare('SELECT MAX(position) as mp FROM custom_fields WHERE project_id = ?').get(req.params.projectId) as { mp: number }).mp || 0
  const result = db.prepare(`
    INSERT INTO custom_fields (project_id, name, field_type, options, position) VALUES (?, ?, ?, ?, ?)
  `).run(req.params.projectId, name, field_type, options ? JSON.stringify(options) : null, maxPos + 1)

  const field = db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>
  res.status(201).json({ field: { ...field, options: field.options ? JSON.parse(field.options as string) : null } })
})

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!existing) return res.status(404).json({ error: 'Field not found' })
  const { name, options, position } = req.body
  db.prepare('UPDATE custom_fields SET name = ?, options = ?, position = ? WHERE id = ?')
    .run(name ?? existing.name, options ? JSON.stringify(options) : existing.options, position ?? existing.position, req.params.id)
  const field = db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(req.params.id) as Record<string, unknown>
  res.json({ field: { ...field, options: field.options ? JSON.parse(field.options as string) : null } })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM custom_fields WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.get('/task/:taskId', authenticate, (req: Request, res: Response) => {
  const values = db.prepare(`
    SELECT field_id, value FROM custom_field_values WHERE task_id = ?
  `).all(req.params.taskId) as Array<{ field_id: number; value: string | null }>
  const map: Record<number, string | null> = {}
  for (const v of values) map[v.field_id] = v.value
  res.json({ values: map })
})

export default router

// Upsert values for a task; called by the tasks routes after create/update so
// custom values can ride along in the same request body.
export function saveCustomValues(taskId: number, projectId: number, values: Record<string, unknown>) {
  const validFields = new Set(
    (db.prepare('SELECT id FROM custom_fields WHERE project_id = ?').all(projectId) as Array<{ id: number }>).map(f => f.id)
  )
  const upsert = db.prepare(`
    INSERT INTO custom_field_values (field_id, task_id, value) VALUES (?, ?, ?)
    ON CONFLICT(field_id, task_id) DO UPDATE SET value = excluded.value
  `)
  const remove = db.prepare('DELETE FROM custom_field_values WHERE field_id = ? AND task_id = ?')
  for (const [fieldIdStr, value] of Object.entries(values)) {
    const fieldId = Number(fieldIdStr)
    if (!validFields.has(fieldId)) continue
    if (value === null || value === undefined || value === '') {
      remove.run(fieldId, taskId)
    } else {
      upsert.run(fieldId, taskId, String(value))
    }
  }
}
