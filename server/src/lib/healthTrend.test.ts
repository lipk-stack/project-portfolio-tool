import { describe, it, expect } from 'vitest'
import { summarizeTrend, TrendPoint } from './healthTrend'

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
