import { describe, it, expect, vi, afterEach } from 'vitest'
import { msUntilNextUtcMidnight, startDailyScheduler, stopDailyScheduler } from './scheduler'
import type { DailyChecksResult } from './dailyChecksService'

const EMPTY: DailyChecksResult = { freshHistory: false, redAlerts: [], recoveries: [], overdue: [], overruns: [] }

describe('msUntilNextUtcMidnight', () => {
  it('counts the remaining ms to the next UTC midnight', () => {
    // 23:00:00 UTC -> 1h left
    expect(msUntilNextUtcMidnight(new Date('2026-06-25T23:00:00Z'))).toBe(60 * 60 * 1000)
  })

  it('returns a full day at exactly UTC midnight (never 0)', () => {
    expect(msUntilNextUtcMidnight(new Date('2026-06-25T00:00:00Z'))).toBe(24 * 60 * 60 * 1000)
  })

  it('handles a sub-second offset', () => {
    expect(msUntilNextUtcMidnight(new Date('2026-06-25T23:59:59.500Z'))).toBe(500)
  })
})

describe('startDailyScheduler', () => {
  afterEach(() => {
    stopDailyScheduler()
    vi.useRealTimers()
  })

  it('fires the sweep at the next UTC midnight and re-arms for the day after', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-25T22:00:00Z'))
    const run = vi.fn<[], DailyChecksResult>(() => EMPTY)

    startDailyScheduler(run, () => new Date())
    expect(run).not.toHaveBeenCalled()

    // Advance the 2h to the first midnight.
    vi.advanceTimersByTime(2 * 60 * 60 * 1000)
    expect(run).toHaveBeenCalledTimes(1)

    // It must have re-armed: 24h later it fires again.
    vi.advanceTimersByTime(24 * 60 * 60 * 1000)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('keeps running even if a sweep throws', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-25T23:00:00Z'))
    const run = vi
      .fn<[], DailyChecksResult>()
      .mockImplementationOnce(() => {
        throw new Error('boom')
      })
      .mockImplementation(() => EMPTY)

    startDailyScheduler(run, () => new Date())
    expect(() => vi.advanceTimersByTime(60 * 60 * 1000)).not.toThrow()
    expect(run).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(24 * 60 * 60 * 1000)
    expect(run).toHaveBeenCalledTimes(2) // re-armed despite the throw
  })
})
