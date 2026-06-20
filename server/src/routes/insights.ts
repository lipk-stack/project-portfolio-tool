import { Router, Request, Response } from 'express'
import { authenticate } from '../middleware/auth'
import { scoreProjectById, scoreAllProjects, getProjectTrend, getPortfolioTrend } from '../lib/healthService'
import { summarizeTrend } from '../lib/healthTrend'

function clampDays(raw: unknown): number {
  return Math.max(7, Math.min(180, parseInt(String(raw || '30'), 10) || 30))
}

const router = Router()

// Single-project health with factors and the auto-narrative.
router.get('/project/:id', authenticate, (req: Request, res: Response) => {
  const scored = scoreProjectById(req.params.id)
  if (!scored) return res.status(404).json({ error: 'Project not found' })
  res.json(scored)
})

// Per-project health-score trend over a trailing window (default 30 days).
router.get('/project/:id/trend', authenticate, (req: Request, res: Response) => {
  const exists = scoreProjectById(req.params.id)
  if (!exists) return res.status(404).json({ error: 'Project not found' })
  res.json(summarizeTrend(getProjectTrend(req.params.id, clampDays(req.query.days))))
})

// Portfolio-level health-score trend (mean score across all projects per day).
router.get('/portfolio/trend', authenticate, (req: Request, res: Response) => {
  res.json(summarizeTrend(getPortfolioTrend(clampDays(req.query.days))))
})

// Portfolio rollup: every active project scored, plus aggregate counts and the
// lowest-scoring projects called out for an at-a-glance executive view.
router.get('/portfolio', authenticate, (_req: Request, res: Response) => {
  const scored = scoreAllProjects()
  const counts = { green: 0, amber: 0, red: 0 }
  for (const s of scored) counts[s.rag]++

  const avgScore = scored.length
    ? Math.round(scored.reduce((sum, s) => sum + s.score, 0) / scored.length)
    : 100
  const overallRag: 'green' | 'amber' | 'red' = avgScore >= 80 ? 'green' : avgScore >= 55 ? 'amber' : 'red'

  const attention = scored
    .filter((s) => s.rag !== 'green')
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((s) => ({ id: s.id, name: s.name, score: s.score, rag: s.rag, color: s.color, headline: s.headline }))

  res.json({
    overall: { score: avgScore, rag: overallRag, projectCount: scored.length, counts },
    needsAttention: attention,
    projects: scored.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      score: s.score,
      rag: s.rag,
      cpi: s.cpi,
      priority: s.priority,
      factors: s.factors,
    })),
  })
})

export default router
