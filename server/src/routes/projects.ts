import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', authenticate, (req: Request, res: Response) => {
  const { status, portfolio_id, health, priority } = req.query
  let query = `
    SELECT p.*, u.name as manager_name, u.email as manager_email,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as done_task_count,
      (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count,
      (SELECT COUNT(*) FROM risks r WHERE r.project_id = p.id AND r.status != 'closed') as open_risk_count,
      po.name as portfolio_name
    FROM projects p
    LEFT JOIN users u ON u.id = p.manager_id
    LEFT JOIN portfolios po ON po.id = p.portfolio_id
    WHERE 1=1
  `
  const params: (string | number)[] = []
  if (status) { query += ' AND p.status = ?'; params.push(status as string) }
  if (portfolio_id) { query += ' AND p.portfolio_id = ?'; params.push(portfolio_id as string) }
  if (health) { query += ' AND p.health = ?'; params.push(health as string) }
  if (priority) { query += ' AND p.priority = ?'; params.push(priority as string) }
  query += " ORDER BY CASE p.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, p.created_at DESC"

  const projects = db.prepare(query).all(...params)
  res.json({ projects })
})

router.post('/', authenticate, (req: Request, res: Response) => {
  const { name, description, portfolio_id, status, priority, health, phase, start_date, end_date, budget, manager_id, color, tags } = req.body
  if (!name) return res.status(400).json({ error: 'Project name required' })

  const result = db.prepare(`
    INSERT INTO projects (name, description, portfolio_id, status, priority, health, phase, start_date, end_date, budget, manager_id, color, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, description || null, portfolio_id || null,
    status || 'planning', priority || 'medium', health || 'green',
    phase || 'initiation', start_date || null, end_date || null,
    budget || 0, manager_id || req.user!.userId, color || '#3B82F6',
    tags ? JSON.stringify(tags) : null
  )

  db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(result.lastInsertRowid, req.user!.userId, 'manager')
  db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run('project', result.lastInsertRowid, req.user!.userId, 'created', JSON.stringify({ name }))

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ project })
})

router.get('/:id', authenticate, (req: Request, res: Response) => {
  const project = db.prepare(`
    SELECT p.*, u.name as manager_name, u.email as manager_email, po.name as portfolio_name
    FROM projects p
    LEFT JOIN users u ON u.id = p.manager_id
    LEFT JOIN portfolios po ON po.id = p.portfolio_id
    WHERE p.id = ?
  `).get(req.params.id)
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.role as system_role, u.department, pm.role, pm.allocation_percent
    FROM project_members pm JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?
  `).all(req.params.id)

  const milestones = db.prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY date ASC').all(req.params.id)

  const taskStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
      SUM(estimated_hours) as total_estimated,
      SUM(actual_hours) as total_actual
    FROM tasks WHERE project_id = ? AND parent_id IS NULL
  `).get(req.params.id)

  res.json({ project, members, milestones, taskStats })
})

router.put('/:id', authenticate, (req: Request, res: Response) => {
  const { name, description, portfolio_id, status, priority, health, phase, start_date, end_date, budget, spent, manager_id, color, tags, completion_percent } = req.body
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as { health: string } | undefined
  if (!existing) return res.status(404).json({ error: 'Project not found' })

  db.prepare(`
    UPDATE projects SET name=?, description=?, portfolio_id=?, status=?, priority=?, health=?,
      phase=?, start_date=?, end_date=?, budget=?, spent=?, manager_id=?, color=?, tags=?,
      completion_percent=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(name, description || null, portfolio_id || null, status, priority, health, phase, start_date || null, end_date || null, budget, spent, manager_id, color, tags ? JSON.stringify(tags) : null, completion_percent || 0, req.params.id)

  if (existing.health !== health) {
    db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run('project', req.params.id, req.user!.userId, 'health_changed', JSON.stringify({ from: existing.health, to: health }))
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  res.json({ project })
})

router.delete('/:id', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.get('/:id/members', authenticate, (req: Request, res: Response) => {
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.department, u.capacity, pm.role, pm.allocation_percent
    FROM project_members pm JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?
  `).all(req.params.id)
  res.json({ members })
})

router.post('/:id/members', authenticate, (req: Request, res: Response) => {
  const { user_id, role, allocation_percent } = req.body
  db.prepare('INSERT OR REPLACE INTO project_members (project_id, user_id, role, allocation_percent) VALUES (?, ?, ?, ?)').run(req.params.id, user_id, role || 'member', allocation_percent || 100)
  res.json({ success: true })
})

router.delete('/:id/members/:userId', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.params.id, req.params.userId)
  res.json({ success: true })
})

router.get('/:id/milestones', authenticate, (req: Request, res: Response) => {
  const milestones = db.prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY date ASC').all(req.params.id)
  res.json({ milestones })
})

router.post('/:id/milestones', authenticate, (req: Request, res: Response) => {
  const { name, date, status, description } = req.body
  const result = db.prepare('INSERT INTO milestones (project_id, name, date, status, description) VALUES (?, ?, ?, ?, ?)').run(req.params.id, name, date, status || 'upcoming', description || null)
  const milestone = db.prepare('SELECT * FROM milestones WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ milestone })
})

router.put('/:id/milestones/:mid', authenticate, (req: Request, res: Response) => {
  const { name, date, status, description } = req.body
  db.prepare('UPDATE milestones SET name=?, date=?, status=?, description=? WHERE id=? AND project_id=?').run(name, date, status, description || null, req.params.mid, req.params.id)
  const milestone = db.prepare('SELECT * FROM milestones WHERE id = ?').get(req.params.mid)
  res.json({ milestone })
})

router.delete('/:id/milestones/:mid', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM milestones WHERE id = ? AND project_id = ?').run(req.params.mid, req.params.id)
  res.json({ success: true })
})

router.get('/:id/activity', authenticate, (req: Request, res: Response) => {
  const activity = db.prepare(`
    SELECT a.*, u.name as user_name, u.email as user_email
    FROM activity_log a JOIN users u ON u.id = a.user_id
    WHERE a.entity_type = 'project' AND a.entity_id = ?
    ORDER BY a.created_at DESC LIMIT 50
  `).all(req.params.id)
  res.json({ activity })
})

router.get('/:id/documents', authenticate, (req: Request, res: Response) => {
  const docs = db.prepare(`
    SELECT d.*, u.name as uploaded_by_name
    FROM project_documents d LEFT JOIN users u ON d.uploaded_by = u.id
    WHERE d.project_id = ? ORDER BY d.created_at DESC
  `).all(req.params.id)
  res.json({ documents: docs })
})

router.post('/:id/documents', authenticate, (req: Request, res: Response) => {
  const { name, url, description, doc_type } = req.body
  const result = db.prepare(`
    INSERT INTO project_documents (project_id, name, url, description, doc_type, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, name, url, description, doc_type || 'link', req.user!.userId)
  const doc = db.prepare(`
    SELECT d.*, u.name as uploaded_by_name FROM project_documents d LEFT JOIN users u ON d.uploaded_by = u.id WHERE d.id = ?
  `).get(result.lastInsertRowid)
  res.status(201).json({ document: doc })
})

router.delete('/:id/documents/:docId', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM project_documents WHERE id = ? AND project_id = ?').run(req.params.docId, req.params.id)
  res.json({ ok: true })
})

router.get('/:id/time-entries', authenticate, (req: Request, res: Response) => {
  const entries = db.prepare(`
    SELECT te.*, u.name as user_name, t.name as task_name
    FROM time_entries te
    LEFT JOIN users u ON te.user_id = u.id
    LEFT JOIN tasks t ON te.task_id = t.id
    WHERE te.project_id = ?
    ORDER BY te.date DESC LIMIT 100
  `).all(req.params.id)
  res.json({ entries })
})

// Auto-score project health and update the health field
router.post('/:id/auto-health', authenticate, (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any
  if (!project) return res.status(404).json({ error: 'Not found' })

  // Compute EVM-like indicators
  const today = new Date()
  const start = project.start_date ? new Date(project.start_date) : null
  const end = project.end_date ? new Date(project.end_date) : null
  const bac = project.budget || 0
  const spent = project.spent || 0
  const pct = (project.completion_percent || 0) / 100

  let spi = 1, cpi = 1
  if (start && end && bac > 0) {
    const totalMs = end.getTime() - start.getTime()
    const elapsed = Math.max(0, Math.min(today.getTime() - start.getTime(), totalMs))
    const pv = totalMs > 0 ? bac * (elapsed / totalMs) : 0
    const ev = bac * pct
    spi = pv > 0 ? ev / pv : 1
    cpi = spent > 0 ? ev / spent : 1
  }

  const openRisks = (db.prepare("SELECT COUNT(*) as c FROM risks WHERE project_id = ? AND status != 'closed' AND score >= 6").get(req.params.id) as { c: number }).c
  const overdueTaskCount = (db.prepare("SELECT COUNT(*) as c FROM tasks WHERE project_id = ? AND status NOT IN ('done','cancelled') AND end_date < date('now')").get(req.params.id) as { c: number }).c

  // Scoring: SPI (0-30) + CPI (0-30) + overdue (-10 each, -30 max) + high risks (-10 each, -20 max)
  let score = 0
  score += Math.min(30, Math.max(0, spi * 30))
  score += Math.min(30, Math.max(0, cpi * 30))
  score -= Math.min(30, overdueTaskCount * 10)
  score -= Math.min(20, openRisks * 10)

  const health = score >= 45 ? 'green' : score >= 25 ? 'yellow' : 'red'
  db.prepare("UPDATE projects SET health = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(health, req.params.id)

  res.json({ health, score: Math.round(score), spi: Math.round(spi * 100) / 100, cpi: Math.round(cpi * 100) / 100, overdueTaskCount, openRisks })
})

// CPM: compute critical path and update is_critical flags
router.post('/:id/compute-cpm', authenticate, (req: Request, res: Response) => {
  const projectId = req.params.id
  const rawTasks = db.prepare('SELECT id, start_date, end_date FROM tasks WHERE project_id = ? AND parent_id IS NULL').all(projectId) as Array<{ id: number; start_date: string | null; end_date: string | null }>

  const deps = db.prepare(`
    SELECT td.predecessor_id, td.successor_id FROM task_dependencies td
    JOIN tasks t ON t.id = td.predecessor_id WHERE t.project_id = ?
  `).all(projectId) as Array<{ predecessor_id: number; successor_id: number }>

  // Build predecessor/successor maps
  const preds = new Map<number, number[]>()
  const succs = new Map<number, number[]>()
  for (const t of rawTasks) { preds.set(t.id, []); succs.set(t.id, []) }
  for (const d of deps) {
    preds.get(d.successor_id)?.push(d.predecessor_id)
    succs.get(d.predecessor_id)?.push(d.successor_id)
  }

  function daysBetween(a: string | null, b: string | null): number {
    if (!a || !b) return 1
    return Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
  }

  const dur = new Map<number, number>()
  for (const t of rawTasks) dur.set(t.id, daysBetween(t.start_date, t.end_date))

  // Forward pass
  const es = new Map<number, number>()
  const ef = new Map<number, number>()

  function forwardPass(id: number): number {
    if (ef.has(id)) return ef.get(id)!
    const predEFs = (preds.get(id) || []).map(p => forwardPass(p))
    const start = predEFs.length ? Math.max(...predEFs) : 0
    es.set(id, start)
    ef.set(id, start + (dur.get(id) || 1))
    return ef.get(id)!
  }
  for (const t of rawTasks) forwardPass(t.id)

  const projectEnd = Math.max(...[...ef.values()])

  // Backward pass
  const ls = new Map<number, number>()
  const lf = new Map<number, number>()

  function backwardPass(id: number): number {
    if (ls.has(id)) return ls.get(id)!
    const succLSs = (succs.get(id) || []).map(s => backwardPass(s))
    const finish = succLSs.length ? Math.min(...succLSs) : projectEnd
    lf.set(id, finish)
    ls.set(id, finish - (dur.get(id) || 1))
    return ls.get(id)!
  }
  for (const t of rawTasks) backwardPass(t.id)

  // Tasks with TF = 0 are critical
  const criticalIds = new Set<number>()
  for (const t of rawTasks) {
    const tf = (ls.get(t.id) || 0) - (es.get(t.id) || 0)
    if (tf === 0) criticalIds.add(t.id)
  }

  // Update is_critical
  db.prepare('UPDATE tasks SET is_critical = 0 WHERE project_id = ?').run(projectId)
  for (const id of criticalIds) {
    db.prepare('UPDATE tasks SET is_critical = 1 WHERE id = ?').run(id)
  }

  res.json({
    critical_count: criticalIds.size,
    total_count: rawTasks.length,
    critical_ids: [...criticalIds],
    project_duration: projectEnd,
  })
})

// S-curve data: cumulative task completion over time
router.get('/:id/s-curve', authenticate, (req: Request, res: Response) => {
  const completionHistory = db.prepare(`
    SELECT DATE(updated_at) as date,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done_count,
      COUNT(*) as total_count
    FROM tasks
    WHERE project_id = ? AND parent_id IS NULL
    GROUP BY DATE(updated_at)
    ORDER BY DATE(updated_at) ASC
  `).all(req.params.id) as Array<{ date: string; done_count: number; total_count: number }>

  const project = db.prepare('SELECT start_date, end_date, budget FROM projects WHERE id = ?').get(req.params.id) as { start_date: string; end_date: string; budget: number }

  // Build cumulative timeline
  let cumDone = 0
  const totalTasks = (db.prepare('SELECT COUNT(*) as c FROM tasks WHERE project_id = ? AND parent_id IS NULL').get(req.params.id) as { c: number }).c
  const points = completionHistory.map(row => {
    cumDone += row.done_count
    return { date: row.date, cumulative_done: cumDone, percent: totalTasks > 0 ? Math.round((cumDone / totalTasks) * 100) : 0 }
  })

  // Build planned S-curve (uniform distribution from project start to end)
  const plannedPoints: Array<{ date: string; planned_percent: number }> = []
  if (project?.start_date && project?.end_date) {
    const start = new Date(project.start_date)
    const end = new Date(project.end_date)
    const totalMs = end.getTime() - start.getTime()
    const totalDays = Math.ceil(totalMs / 86400000)
    const step = Math.max(1, Math.floor(totalDays / 10))
    for (let i = 0; i <= totalDays; i += step) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      // S-curve uses logistic function for realistic shape
      const t = i / totalDays
      const sCurve = Math.round(100 / (1 + Math.exp(-10 * (t - 0.5))))
      plannedPoints.push({ date: d.toISOString().split('T')[0], planned_percent: sCurve })
    }
  }

  res.json({ actual: points, planned: plannedPoints, totalTasks })
})

// Baselines
router.get('/:id/baselines', authenticate, (req: Request, res: Response) => {
  const baselines = db.prepare('SELECT id, name, created_at FROM project_baselines WHERE project_id = ? ORDER BY created_at DESC').all(req.params.id)
  res.json({ baselines })
})

router.post('/:id/baselines', authenticate, (req: Request, res: Response) => {
  const { name } = req.body
  const tasks = db.prepare('SELECT id, name, start_date, end_date, estimated_hours, completion_percent, status FROM tasks WHERE project_id = ?').all(req.params.id)
  const project = db.prepare('SELECT start_date, end_date, budget, completion_percent FROM projects WHERE id = ?').get(req.params.id)

  const baseline_data = JSON.stringify({ tasks, project, saved_at: new Date().toISOString() })
  const result = db.prepare('INSERT INTO project_baselines (project_id, name, baseline_data) VALUES (?, ?, ?)').run(req.params.id, name || `Baseline ${new Date().toLocaleDateString()}`, baseline_data)
  const baseline = db.prepare('SELECT id, name, created_at FROM project_baselines WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ baseline })
})

router.get('/:id/baselines/:bid', authenticate, (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM project_baselines WHERE id = ? AND project_id = ?').get(req.params.bid, req.params.id) as { baseline_data: string } | undefined
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json({ ...row, baseline_data: JSON.parse(row.baseline_data) })
})

router.delete('/:id/baselines/:bid', authenticate, (req: Request, res: Response) => {
  db.prepare('DELETE FROM project_baselines WHERE id = ? AND project_id = ?').run(req.params.bid, req.params.id)
  res.json({ ok: true })
})

export default router
