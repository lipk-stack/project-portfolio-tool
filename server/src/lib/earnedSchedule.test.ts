import { describe, it, expect } from 'vitest'
import { computeEarnedSchedule } from './earnedSchedule'

// 100-day project, Jan 1 → Apr 11. asOf day 50 unless stated.
const base = { BAC: 100000, start: '2026-01-01', end: '2026-04-11' }
const day = (n: number) => new Date(Date.parse('2026-01-01') + n * 86400000)

describe('computeEarnedSchedule', () => {
  it('is on schedule when earned fraction matches elapsed fraction', () => {
    const r = computeEarnedSchedule({ ...base, EV: 50000, asOf: day(50) })!
    expect(r.plannedDurationDays).toBe(100)
    expect(r.actualTimeDays).toBe(50)
    expect(r.earnedScheduleDays).toBe(50)
    expect(r.SPIt).toBe(1)
    expect(r.timeVarianceDays).toBe(0)
    expect(r.forecastEndDate).toBe('2026-04-11')
    expect(r.forecastSlipDays).toBe(0)
  })

  it('forecasts slip when behind schedule', () => {
    // Earned only 25% of value at day 50 → SPI(t)=0.5 → 200-day forecast
    const r = computeEarnedSchedule({ ...base, EV: 25000, asOf: day(50) })!
    expect(r.SPIt).toBe(0.5)
    expect(r.timeVarianceDays).toBe(-25)
    expect(r.forecastDurationDays).toBe(200)
    expect(r.forecastSlipDays).toBe(100)
  })

  it('forecasts early finish when ahead', () => {
    const r = computeEarnedSchedule({ ...base, EV: 75000, asOf: day(50) })!
    expect(r.SPIt).toBe(1.5)
    expect(r.timeVarianceDays).toBe(25)
    expect(r.forecastDurationDays).toBe(67)
    expect(r.forecastSlipDays).toBeLessThan(0)
  })

  it('keeps SPI(t) meaningful after the planned end (unlike classic SPI)', () => {
    // Day 120 of a 100-day plan, only 60% earned → still clearly behind
    const r = computeEarnedSchedule({ ...base, EV: 60000, asOf: day(120) })!
    expect(r.actualTimeDays).toBe(120)
    expect(r.earnedScheduleDays).toBe(60)
    expect(r.SPIt).toBe(0.5)
  })

  it('has no signal before any time elapses', () => {
    const r = computeEarnedSchedule({ ...base, EV: 0, asOf: day(0) })!
    expect(r.actualTimeDays).toBe(0)
    expect(r.SPIt).toBe(1)
  })

  it('clamps EV above BAC and forecasts completion at actual time', () => {
    const r = computeEarnedSchedule({ ...base, EV: 150000, asOf: day(80) })!
    expect(r.earnedScheduleDays).toBe(100)
    expect(r.forecastDurationDays).toBe(80)
  })

  it('returns null for invalid inputs', () => {
    expect(computeEarnedSchedule({ ...base, BAC: 0, EV: 0 })).toBeNull()
    expect(computeEarnedSchedule({ BAC: 1, EV: 0, start: '', end: '2026-01-01' })).toBeNull()
    expect(computeEarnedSchedule({ BAC: 1, EV: 0, start: '2026-02-01', end: '2026-01-01' })).toBeNull()
  })

  it('treats negative EV as zero progress', () => {
    const r = computeEarnedSchedule({ ...base, EV: -5, asOf: day(10) })!
    expect(r.earnedScheduleDays).toBe(0)
    expect(r.SPIt).toBe(0)
  })
})
