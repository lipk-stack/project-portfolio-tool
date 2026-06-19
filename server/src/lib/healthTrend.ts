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
