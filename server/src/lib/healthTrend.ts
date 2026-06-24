// Pure helpers for shaping a project's stored health-score history into a
// trend summary (current value, change over the window, direction, range).
// Kept dependency-free so it is fully unit-testable; the route/service layer
// reads the rows from the health_history table and feeds them in.

export interface TrendPoint {
  date: string // YYYY-MM-DD
  score: number // 0-100
  rag?: string
}

export type TrendDirection = 'up' | 'down' | 'flat'

export interface TrendSummary {
  points: TrendPoint[] // chronological (oldest -> newest)
  current: number | null // latest score
  previous: number | null // earliest score in the window
  delta: number | null // current - previous
  direction: TrendDirection
  min: number | null
  max: number | null
}

// Summarises a series of daily health snapshots. Input may be in any order; it
// is sorted ascending by date. `flatThreshold` is the absolute change (in
// points) below which the trend is reported as flat rather than up/down.
export function summarizeTrend(points: TrendPoint[], flatThreshold = 1): TrendSummary {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  if (sorted.length === 0) {
    return { points: [], current: null, previous: null, delta: null, direction: 'flat', min: null, max: null }
  }
  const scores = sorted.map((p) => p.score)
  const current = scores[scores.length - 1]
  const previous = scores[0]
  const delta = current - previous
  const direction: TrendDirection = Math.abs(delta) <= flatThreshold ? 'flat' : delta > 0 ? 'up' : 'down'
  return {
    points: sorted,
    current,
    previous,
    delta,
    direction,
    min: Math.min(...scores),
    max: Math.max(...scores),
  }
}

// Single source of truth for mapping a 0-100 health score to a RAG band. Shared
// by the scoring service and the portfolio-trend aggregator so the thresholds
// never drift apart.
export function ragForScore(score: number): 'green' | 'amber' | 'red' {
  return score >= 80 ? 'green' : score >= 55 ? 'amber' : 'red'
}

// Rolls up per-project daily snapshots into a single portfolio-level series:
// one point per date carrying the mean score across all projects that have a
// snapshot on that date (rounded), tagged with the RAG band for that average.
// Input may be in any order and may have several rows per date.
export function aggregatePortfolioTrend(rows: TrendPoint[]): TrendPoint[] {
  const byDate = new Map<string, { sum: number; n: number }>()
  for (const r of rows) {
    const acc = byDate.get(r.date) || { sum: 0, n: 0 }
    acc.sum += r.score
    acc.n += 1
    byDate.set(r.date, acc)
  }
  return [...byDate.entries()]
    .map(([date, { sum, n }]) => {
      const score = Math.round(sum / n)
      return { date, score, rag: ragForScore(score) }
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

export interface RagSnapshot {
  id: number
  name: string
  rag: string
}

// Given yesterday's and today's per-project RAG snapshots, returns the projects
// that newly slipped INTO red (were green or amber yesterday, red today).
// Projects with no prior snapshot are intentionally skipped: a freshly added
// red project hasn't "transitioned" and shouldn't trigger a regression alert.
export function detectRedTransitions(prev: RagSnapshot[], curr: RagSnapshot[]): RagSnapshot[] {
  const prevRag = new Map(prev.map((p) => [p.id, p.rag]))
  return curr.filter((c) => {
    const before = prevRag.get(c.id)
    return c.rag === 'red' && before !== undefined && before !== 'red'
  })
}

// The mirror of detectRedTransitions: projects that recovered OUT of red (were
// red yesterday, green or amber today). Projects with no prior snapshot are
// skipped for the same reason — a brand-new healthy project hasn't "recovered".
export function detectHealthRecoveries(prev: RagSnapshot[], curr: RagSnapshot[]): RagSnapshot[] {
  const prevRag = new Map(prev.map((p) => [p.id, p.rag]))
  return curr.filter((c) => {
    const before = prevRag.get(c.id)
    return before === 'red' && c.rag !== 'red'
  })
}
