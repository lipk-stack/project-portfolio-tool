import { describe, it, expect } from 'vitest'
import { summarizeTrend, aggregatePortfolioTrend, detectRedTransitions, ragForScore, TrendPoint } from './healthTrend'

describe('summarizeTrend', () => {
  it('returns an empty/flat summary for no data', () => {
    const r = summarizeTrend([])
    expect(r.points).toEqual([])
    expect(r.current).toBeNull()
    expect(r.previous).toBeNull()
    expect(r.delta).toBeNull()
    expect(r.direction).toBe('flat')
    expect(r.min).toBeNull()
    expect(r.max).toBeNull()
  })

  it('handles a single point (current == previous, flat)', () => {
    const r = summarizeTrend([{ date: '2026-06-01', score: 72 }])
    expect(r.current).toBe(72)
    expect(r.previous).toBe(72)
    expect(r.delta).toBe(0)
    expect(r.direction).toBe('flat')
    expect(r.min).toBe(72)
    expect(r.max).toBe(72)
  })

  it('detects an upward trend and computes the delta', () => {
    const pts: TrendPoint[] = [
      { date: '2026-06-01', score: 50 },
      { date: '2026-06-02', score: 58 },
      { date: '2026-06-03', score: 67 },
    ]
    const r = summarizeTrend(pts)
    expect(r.previous).toBe(50)
    expect(r.current).toBe(67)
    expect(r.delta).toBe(17)
    expect(r.direction).toBe('up')
    expect(r.min).toBe(50)
    expect(r.max).toBe(67)
  })

  it('detects a downward trend', () => {
    const r = summarizeTrend([
      { date: '2026-06-01', score: 80 },
      { date: '2026-06-05', score: 61 },
    ])
    expect(r.delta).toBe(-19)
    expect(r.direction).toBe('down')
  })

  it('reports flat when the change is within the threshold', () => {
    const r = summarizeTrend(
      [
        { date: '2026-06-01', score: 70 },
        { date: '2026-06-02', score: 71 },
      ],
      1,
    )
    expect(r.delta).toBe(1)
    expect(r.direction).toBe('flat')
  })

  it('sorts unordered input chronologically before summarising', () => {
    const r = summarizeTrend([
      { date: '2026-06-03', score: 90 },
      { date: '2026-06-01', score: 40 },
      { date: '2026-06-02', score: 65 },
    ])
    expect(r.points.map((p) => p.date)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
    expect(r.previous).toBe(40)
    expect(r.current).toBe(90)
    expect(r.direction).toBe('up')
  })
})

describe('ragForScore', () => {
  it('maps scores to RAG bands at the 80/55 thresholds', () => {
    expect(ragForScore(80)).toBe('green')
    expect(ragForScore(79)).toBe('amber')
    expect(ragForScore(55)).toBe('amber')
    expect(ragForScore(54)).toBe('red')
    expect(ragForScore(0)).toBe('red')
    expect(ragForScore(100)).toBe('green')
  })
})

describe('aggregatePortfolioTrend', () => {
  it('averages scores per date, rounds, tags RAG, and sorts chronologically', () => {
    const rows: TrendPoint[] = [
      { date: '2026-06-02', score: 90 },
      { date: '2026-06-01', score: 40 },
      { date: '2026-06-01', score: 60 }, // avg 50 -> red
      { date: '2026-06-02', score: 70 }, // avg 80 -> green
    ]
    const out = aggregatePortfolioTrend(rows)
    expect(out).toEqual([
      { date: '2026-06-01', score: 50, rag: 'red' },
      { date: '2026-06-02', score: 80, rag: 'green' },
    ])
  })

  it('rounds the mean to the nearest integer', () => {
    const out = aggregatePortfolioTrend([
      { date: '2026-06-01', score: 70 },
      { date: '2026-06-01', score: 71 },
      { date: '2026-06-01', score: 72 }, // mean 71
    ])
    expect(out[0].score).toBe(71)
  })

  it('returns an empty series for no rows', () => {
    expect(aggregatePortfolioTrend([])).toEqual([])
  })
})

describe('detectRedTransitions', () => {
  const prev = [
    { id: 1, name: 'Alpha', rag: 'amber' },
    { id: 2, name: 'Beta', rag: 'green' },
    { id: 3, name: 'Gamma', rag: 'red' },
  ]

  it('flags projects that crossed from green/amber into red', () => {
    const curr = [
      { id: 1, name: 'Alpha', rag: 'red' }, // amber -> red: alert
      { id: 2, name: 'Beta', rag: 'green' }, // unchanged
      { id: 3, name: 'Gamma', rag: 'red' }, // was already red: no alert
    ]
    expect(detectRedTransitions(prev, curr).map((p) => p.id)).toEqual([1])
  })

  it('does not alert for projects with no prior snapshot', () => {
    const curr = [{ id: 9, name: 'NewRed', rag: 'red' }]
    expect(detectRedTransitions(prev, curr)).toEqual([])
  })

  it('returns nothing when no project newly turned red', () => {
    const curr = [
      { id: 1, name: 'Alpha', rag: 'amber' },
      { id: 2, name: 'Beta', rag: 'green' },
    ]
    expect(detectRedTransitions(prev, curr)).toEqual([])
  })
})
