import { describe, it, expect } from 'vitest'
import { computeNextOccurrence, normalizeRecurrence, isValidRecurrence } from './recurrence'

describe('computeNextOccurrence', () => {
  it('returns null for non-recurring tasks', () => {
    expect(computeNextOccurrence({ start_date: '2026-01-01', end_date: '2026-01-05', recurrence: 'none' })).toBeNull()
    expect(computeNextOccurrence({ start_date: '2026-01-01', end_date: '2026-01-05', recurrence: null })).toBeNull()
    expect(computeNextOccurrence({ start_date: '2026-01-01', end_date: '2026-01-05', recurrence: '' })).toBeNull()
  })

  it('shifts daily by one day, preserving duration', () => {
    const r = computeNextOccurrence({ start_date: '2026-01-01', end_date: '2026-01-03', recurrence: 'daily' })!
    expect(r.start_date).toBe('2026-01-02')
    expect(r.end_date).toBe('2026-01-04')
  })

  it('shifts weekly by seven days, preserving duration', () => {
    const r = computeNextOccurrence({ start_date: '2026-01-01', end_date: '2026-01-02', recurrence: 'weekly' })!
    expect(r.start_date).toBe('2026-01-08')
    expect(r.end_date).toBe('2026-01-09')
  })

  it('shifts monthly by one calendar month', () => {
    const r = computeNextOccurrence({ start_date: '2026-01-15', end_date: '2026-01-20', recurrence: 'monthly' })!
    expect(r.start_date).toBe('2026-02-15')
    expect(r.end_date).toBe('2026-02-20')
  })

  it('clamps monthly to the last day of a shorter month', () => {
    const r = computeNextOccurrence({ start_date: '2026-01-31', end_date: '2026-01-31', recurrence: 'monthly' })!
    expect(r.start_date).toBe('2026-02-28')
    expect(r.end_date).toBe('2026-02-28')
  })

  it('works with only an end date', () => {
    const r = computeNextOccurrence({ start_date: null, end_date: '2026-01-10', recurrence: 'weekly' })!
    expect(r.start_date).toBeNull()
    expect(r.end_date).toBe('2026-01-17')
  })

  it('returns null when there is no date to anchor on', () => {
    expect(computeNextOccurrence({ start_date: null, end_date: null, recurrence: 'daily' })).toBeNull()
  })

  it('stops when the next start would pass recurrence_until', () => {
    expect(computeNextOccurrence({ start_date: '2026-01-05', end_date: '2026-01-06', recurrence: 'weekly', recurrence_until: '2026-01-10' })).toBeNull()
    const ok = computeNextOccurrence({ start_date: '2026-01-05', end_date: '2026-01-06', recurrence: 'weekly', recurrence_until: '2026-01-20' })!
    expect(ok.start_date).toBe('2026-01-12')
  })
})

describe('recurrence helpers', () => {
  it('validates recurrence values', () => {
    expect(isValidRecurrence('weekly')).toBe(true)
    expect(isValidRecurrence('yearly')).toBe(false)
    expect(isValidRecurrence(5)).toBe(false)
  })

  it('normalizes unknown/empty to none', () => {
    expect(normalizeRecurrence('monthly')).toBe('monthly')
    expect(normalizeRecurrence('')).toBe('none')
    expect(normalizeRecurrence(null)).toBe('none')
    expect(normalizeRecurrence('bogus')).toBe('none')
  })
})
