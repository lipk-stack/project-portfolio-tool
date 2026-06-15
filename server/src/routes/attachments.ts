import { Router, Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import { db, dataDir } from '../database'
import { authenticate } from '../middleware/auth'
import { emitToProject } from '../lib/realtime'
import { decodeAndValidate, storageName } from '../lib/attachments'

const router = Router()

const uploadsDir = path.join(dataDir, 'uploads')
function ensureUploadsDir() {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
}

interface AttachmentRow {
  id: number; task_id: number; project_id: number | null; filename: string
  mime: string | null; size: number; storage_path: string; uploaded_by: number | null
  created_at: string; uploader_name?: string
}

// List attachments for a task.
router.get('/task/:taskId', authenticate, (req: Request, res: Response) => {
  const attachments = db.prepare(`
    SELECT a.id, a.task_id, a.project_id, a.filename, a.mime, a.size, a.created_at, a.uploaded_by,
      u.name as uploader_name
    FROM attachments a LEFT JOIN users u ON u.id = a.uploaded_by
    WHERE a.task_id = ?
    ORDER BY a.created_at DESC
  `).all(req.params.taskId)
  res.json({ attachments })
})

// Upload an attachment to a task (base64 JSON body).
router.post('/task/:taskId', authenticate, (req: Request, res: Response) => {
  const task = db.prepare('SELECT id, project_id, name FROM tasks WHERE id = ?').get(req.params.taskId) as
    { id: number; project_id: number; name: string } | undefined
  if (!task) return res.status(404).json({ error: 'Task not found' })

  const decoded = decodeAndValidate({ filename: req.body?.filename, mime: req.body?.mime, data: req.body?.data })
  if (!decoded.ok) return res.status(400).json({ error: decoded.error })

  // Insert first to get the id, then write the file using an id-prefixed name.
  const result = db.prepare(`
    INSERT INTO attachments (task_id, project_id, filename, mime, size, storage_path, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(task.id, task.project_id, decoded.safeName, decoded.mime, decoded.size, '', req.user!.userId)
  const id = Number(result.lastInsertRowid)
  const diskName = storageName(id, decoded.safeName!)

  try {
    ensureUploadsDir()
    fs.writeFileSync(path.join(uploadsDir, diskName), decoded.buffer!)
  } catch {
    db.prepare('DELETE FROM attachments WHERE id = ?').run(id)
    return res.status(500).json({ error: 'Could not store the file' })
  }
  db.prepare('UPDATE attachments SET storage_path = ? WHERE id = ?').run(diskName, id)

  db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)')
    .run('project', task.project_id, req.user!.userId, 'attachment_added', JSON.stringify({ task: task.name, filename: decoded.safeName }))
  emitToProject(task.project_id, 'task_changed', { action: 'updated', task_id: task.id, actor_id: req.user!.userId })

  const attachment = db.prepare(`
    SELECT a.id, a.task_id, a.project_id, a.filename, a.mime, a.size, a.created_at, a.uploaded_by,
      u.name as uploader_name
    FROM attachments a LEFT JOIN users u ON u.id = a.uploaded_by WHERE a.id = ?
  `).get(id)
  res.status(201).json({ attachment })
})

// Download an attachment (auth via Bearer header — the client uses an authed fetch).
router.get('/:id/download', authenticate, (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id) as AttachmentRow | undefined
  if (!row) return res.status(404).json({ error: 'Attachment not found' })
  const filePath = path.join(uploadsDir, row.storage_path)
  // Guard against any path escaping the uploads dir.
  if (!filePath.startsWith(uploadsDir) || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File missing on disk' })
  }
  res.setHeader('Content-Type', row.mime || 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename="${row.filename.replace(/"/g, '')}"`)
  fs.createReadStream(filePath).pipe(res)
})

// Delete an attachment (row + file).
router.delete('/:id', authenticate, (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id) as AttachmentRow | undefined
  if (!row) return res.status(404).json({ error: 'Attachment not found' })
  try {
    const filePath = path.join(uploadsDir, row.storage_path)
    if (filePath.startsWith(uploadsDir) && fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch { /* best-effort: still drop the row */ }
  db.prepare('DELETE FROM attachments WHERE id = ?').run(row.id)
  if (row.project_id) emitToProject(row.project_id, 'task_changed', { action: 'updated', task_id: row.task_id, actor_id: req.user!.userId })
  res.json({ success: true })
})

export default router
