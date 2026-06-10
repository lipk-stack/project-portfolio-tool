import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JwtPayload } from '../types'
import { db } from '../database'
import { hashToken, isApiToken } from '../lib/tokens'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  const token = authHeader.slice(7)

  // Personal access tokens (ppt_...) for external integrations
  if (isApiToken(token)) {
    const row = db.prepare(`
      SELECT t.id as token_id, u.id as user_id, u.email, u.role
      FROM api_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ? AND t.revoked = 0
    `).get(hashToken(token)) as { token_id: number; user_id: number; email: string; role: string } | undefined
    if (!row) return res.status(401).json({ error: 'Invalid or revoked API token' })
    db.prepare('UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.token_id)
    req.user = { userId: row.user_id, email: row.email, role: row.role }
    return next()
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as JwtPayload
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}
