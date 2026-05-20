import { Router, Request, Response } from 'express'
import { db } from '../database'
import { authenticate } from '../middleware/auth'

const router = Router()

function calcEVM(project: any) {
  const today = new Date()
  const start = project.start_date ? new Date(project.start_date) : null
  const end = project.end_date ? new Date(project.end_date) : null
  const bac = project.budget || 0
  const acwp = project.spent || 0
  const pctComplete = (project.completion_percent || 0) / 100

  let pv = 0
  if (start && end && bac > 0) {
    const totalMs = end.getTime() - start.getTime()
    const elapsedMs = Math.max(0, Math.min(today.getTime() - start.getTime(), totalMs))
    pv = totalMs > 0 ? bac * (elapsedMs / totalMs) : 0
  }

  const ev = bac * pctComplete
  const sv = ev - pv
  const cv = ev - acwp
  const spi = pv > 0 ? ev / pv : 1
  const cpi = acwp > 0 ? ev / acwp : 1
  const eac = cpi > 0 ? bac / cpi : bac
  const etc = eac - acwp
  const vac = bac - eac
  const tcpi = (bac - acwp) > 0 ? (bac - ev) / (bac - acwp) : 1

  return {
    bac, pv: Math.round(pv), ev: Math.round(ev), acwp: Math.round(acwp),
    sv: Math.round(sv), cv: Math.round(cv),
    spi: Math.round(spi * 100) / 100,
    cpi: Math.round(cpi * 100) / 100,
    eac: Math.round(eac), etc: Math.max(0, Math.round(etc)),
    vac: Math.round(vac),
    tcpi: Math.round(tcpi * 100) / 100,
    completion_percent: project.completion_percent,
  }
}

router.get('/project/:id', authenticate, (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any
  if (!project) return res.status(404).json({ error: 'Not found' })

  const evm = calcEVM(project)

  const trend = db.prepare(`
    SELECT strftime('%Y-%m', date) as month, SUM(hours) as hours
    FROM time_entries
    WHERE project_id = ?
    GROUP BY month ORDER BY month ASC LIMIT 12
  `).all(req.params.id) as any[]

  let cumHours = 0
  const trendData = trend.map(t => {
    cumHours += t.hours || 0
    return { month: t.month, hours: Math.round(cumHours) }
  })

  res.json({ evm, trend: trendData, project: { name: project.name, color: project.color } })
})

router.get('/portfolio', authenticate, (_req: Request, res: Response) => {
  const projects = db.prepare(`
    SELECT p.*, u.name as manager_name
    FROM projects p LEFT JOIN users u ON p.manager_id = u.id
    WHERE p.status NOT IN ('cancelled')
  `).all() as any[]

  const evmData = projects.map(p => ({
    id: p.id, name: p.name, color: p.color, status: p.status, health: p.health,
    manager_name: p.manager_name,
    ...calcEVM(p),
  }))

  const active = evmData.filter(p => p.status === 'active')
  const totals = {
    bac: active.reduce((s, p) => s + p.bac, 0),
    ev: active.reduce((s, p) => s + p.ev, 0),
    pv: active.reduce((s, p) => s + p.pv, 0),
    acwp: active.reduce((s, p) => s + p.acwp, 0),
    eac: active.reduce((s, p) => s + p.eac, 0),
    spi: 0, cpi: 0,
  }
  totals.spi = totals.pv > 0 ? Math.round((totals.ev / totals.pv) * 100) / 100 : 1
  totals.cpi = totals.acwp > 0 ? Math.round((totals.ev / totals.acwp) * 100) / 100 : 1

  res.json({ projects: evmData, totals })
})

export default router
