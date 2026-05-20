import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../database'
import { authenticate } from '../middleware/auth'
import { User } from '../types'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User & { password_hash: string } | undefined
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
  const { password_hash: _, ...safeUser } = user
  res.json({ token, user: safeUser })
})

router.post('/register', (req: Request, res: Response) => {
  const { email, password, name, department } = req.body
  if (!email || !password || !name) return res.status(400).json({ error: 'Name, email and password required' })
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) return res.status(409).json({ error: 'Email already registered' })

  const hash = bcrypt.hashSync(password, 10)
  const result = db.prepare('INSERT INTO users (email, password_hash, name, department) VALUES (?, ?, ?, ?)').run(email, hash, name, department || null)
  const user = db.prepare('SELECT id, email, name, role, department, capacity, hourly_rate, created_at FROM users WHERE id = ?').get(result.lastInsertRowid)
  const token = jwt.sign({ userId: result.lastInsertRowid as number, email, role: 'member' }, JWT_SECRET, { expiresIn: '7d' })
  res.status(201).json({ token, user })
})

router.get('/me', authenticate, (req: Request, res: Response) => {
  const user = db.prepare('SELECT id, email, name, role, department, capacity, hourly_rate, created_at FROM users WHERE id = ?').get(req.user!.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ user })
})

router.put('/profile', authenticate, (req: Request, res: Response) => {
  const { name, department, capacity, hourly_rate } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' })
  db.prepare('UPDATE users SET name=?, department=?, capacity=?, hourly_rate=? WHERE id=?').run(
    name.trim(), department || null, capacity || 40, hourly_rate || 0, req.user!.userId
  )
  const user = db.prepare('SELECT id, email, name, role, department, capacity, hourly_rate, created_at FROM users WHERE id = ?').get(req.user!.userId)
  res.json({ user })
})

router.put('/password', authenticate, (req: Request, res: Response) => {
  const { current_password, new_password } = req.body
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' })
  if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' })

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.userId) as { password_hash: string } | undefined
  if (!user || !bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'Current password incorrect' })
  }
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(new_password, 10), req.user!.userId)
  res.json({ ok: true })
})

export default router
