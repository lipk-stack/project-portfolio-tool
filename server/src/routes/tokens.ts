import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'
import { generateToken } from '../lib/tokens'

const router = Router()

router.get('/', authenticate, (req: Request, res: Response) => {
  const tokens = db.prepare(`
    SELECT id, name, prefix, last_used_at, created_at FROM api_tokens
    WHERE user_id = ? AND revoked = 0 ORDER BY created_at DESC
  `).all(req.user!.userId)
  res.json({ tokens })
})

router.post('/', authenticate, (req: Request, res: Response) => {
  const { name } = req.body
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Token name required' })

  const { token, hash, prefix } = generateToken()
  const result = db.prepare('INSERT INTO api_tokens (user_id, name, token_hash, prefix) VALUES (?, ?, ?, ?)')
    .run(req.user!.userId, String(name).trim(), hash, prefix)

  // The plaintext token is returned exactly once; only the hash is stored.
  res.status(201).json({
    token,
    id: Number(result.lastInsertRowid),
    name: String(name).trim(),
    prefix,
  })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  const result = db.prepare('UPDATE api_tokens SET revoked = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user!.userId)
  if (result.changes === 0) return res.status(404).json({ error: 'Token not found' })
  res.json({ success: true })
})

export default router
