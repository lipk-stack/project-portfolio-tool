import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

// Ensure table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS custom_field_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    name TEXT NOT NULL,
    field_type TEXT NOT NULL DEFAULT 'text',
    options TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS custom_field_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_id INTEGER REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    entity_id INTEGER NOT NULL,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_cfv_unique ON custom_field_values(field_id, entity_id);
`)

router.get('/definitions/:entityType', authenticate, (req: Request, res: Response) => {
  const defs = db.prepare('SELECT * FROM custom_field_definitions WHERE entity_type = ? ORDER BY id').all(req.params.entityType)
  res.json({ definitions: defs })
})

router.post('/definitions', authenticate, (req: Request, res: Response) => {
  const { entity_type, name, field_type, options } = req.body
  if (!entity_type || !name) return res.status(400).json({ error: 'entity_type and name required' })
  const result = db.prepare('INSERT INTO custom_field_definitions (entity_type, name, field_type, options) VALUES (?, ?, ?, ?)').run(entity_type, name, field_type || 'text', options ? JSON.stringify(options) : null)
  const def = db.prepare('SELECT * FROM custom_field_definitions WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ definition: def })
})

router.delete('/definitions/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM custom_field_definitions WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.get('/values/:entityType/:entityId', authenticate, (req: Request, res: Response) => {
  const values = db.prepare(`
    SELECT cfv.*, cfd.name, cfd.field_type, cfd.options
    FROM custom_field_values cfv
    JOIN custom_field_definitions cfd ON cfd.id = cfv.field_id
    WHERE cfd.entity_type = ? AND cfv.entity_id = ?
  `).all(req.params.entityType, req.params.entityId)
  res.json({ values })
})

router.put('/values/:fieldId/:entityId', authenticate, (req: Request, res: Response) => {
  const { value } = req.body
  db.prepare('INSERT OR REPLACE INTO custom_field_values (field_id, entity_id, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)').run(req.params.fieldId, req.params.entityId, value ?? null)
  res.json({ success: true })
})

export default router
