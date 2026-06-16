import { describe, it, expect } from 'vitest'
import { computeProjectHealth, ProjectHealthInput } from './projectHealth'

// A project doing everything right.
const healthy: ProjectHealthInput = {
  name: 'Apollo',
  status: 'active',
  completionPercent: 50,
  spit: 1.02,
  forecastSlipDays: -2,
  budget: 100000,
  spent: 48000,
  openRiskCount: 1,
  criticalRiskCount: 0,
  totalTasks: 20,
  overdueTasks: 0,
}

describe('computeProjectHealth', () => {
  it('rates a well-performing project green with a high score', () => {
    const r = computeProjectHealth(healthy)
    expect(r.rag).toBe('green')
    expect(r.score).toBeGreaterThanOrEqual(80)
    expect(r.headline).toContain('Apollo')
    expect(r.headline).toContain('On track')
    expect(r.cpi).toBeGreaterThan(1)
  })

  it('always returns exactly four factors in a stable order', () => {
    const r = computeProjectHealth(healthy)
    expect(r.factors.map((f) => f.key)).toEqual(['schedule', 'cost', 'risk', 'execution'])
  })

  it('drives the score down and RAG to red when behind schedule with slip', () => {
    const r = computeProjectHealth({ ...healthy, spit: 0.6, forecastSlipDays: 45 })
    const schedule = r.factors.find((f) => f.key === 'schedule')!
    expect(schedule.rag).toBe('red')
    expect(schedule.penalty).toBeGreaterThan(20)
    expect(r.score).toBeLessThan(80)
    expect(r.summary).toContain('Behind schedule')
  })

  it('penalises cost overrun via CPI', () => {
    // 50% complete but 90% of budget spent → CPI ≈ 0.56
    const r = computeProjectHealth({ ...healthy, spent: 90000 })
    const cost = r.factors.find((f) => f.key === 'cost')!
    expect(r.cpi).toBeLessThan(0.7)
    expect(cost.rag).toBe('red')
    expect(cost.detail).toMatch(/CPI/)
  })

  it('treats critical risks as a major penalty', () => {
    const clean = computeProjectHealth(healthy).score
    const risky = computeProjectHealth({ ...healthy, openRiskCount: 3, criticalRiskCount: 2 })
    expect(risky.score).toBeLessThan(clean)
    const risk = risky.factors.find((f) => f.key === 'risk')!
    expect(risk.rag).toBe('red')
    expect(risk.detail).toContain('critical')
  })

  it('penalises execution when many tasks are overdue', () => {
    const r = computeProjectHealth({ ...healthy, totalTasks: 20, overdueTasks: 10 })
    const exec = r.factors.find((f) => f.key === 'execution')!
    expect(exec.rag).toBe('red')
    expect(exec.detail).toContain('overdue')
  })

  it('marks factors with no data as na and does not penalise them', () => {
    const r = computeProjectHealth({ name: 'New', status: 'planning', completionPercent: 0 })
    const schedule = r.factors.find((f) => f.key === 'schedule')!
    const cost = r.factors.find((f) => f.key === 'cost')!
    const exec = r.factors.find((f) => f.key === 'execution')!
    expect(schedule.rag).toBe('na')
    expect(cost.rag).toBe('na')
    expect(exec.rag).toBe('na')
    expect(schedule.penalty).toBe(0)
    expect(r.cpi).toBeNull()
  })

  it('never produces a score outside 0-100', () => {
    const worst = computeProjectHealth({
      status: 'active',
      completionPercent: 10,
      spit: 0.3,
      forecastSlipDays: 365,
      budget: 100000,
      spent: 200000,
      openRiskCount: 10,
      criticalRiskCount: 8,
      totalTasks: 20,
      overdueTasks: 20,
    })
    expect(worst.score).toBeGreaterThanOrEqual(0)
    expect(worst.score).toBeLessThanOrEqual(100)
    expect(worst.rag).toBe('red')
  })

  it('keeps a clean completed project green even with mild lag', () => {
    const r = computeProjectHealth({ ...healthy, status: 'completed', completionPercent: 100, spit: 0.9, overdueTasks: 1 })
    expect(r.rag).toBe('green')
    expect(r.score).toBeGreaterThanOrEqual(80)
  })

  it('builds a narrative that leads with concerns and ends with a recommendation', () => {
    const r = computeProjectHealth({ ...healthy, spit: 0.65, forecastSlipDays: 30 })
    expect(r.summary).toMatch(/at risk|needs attention/i)
    expect(r.summary).toContain('Recommended action')
    expect(r.summary).toContain('schedule')
  })

  it('recommends no action when everything is green', () => {
    const r = computeProjectHealth(healthy)
    expect(r.summary).toContain('No corrective action needed')
  })

  it('reports no spend cleanly when budget set but nothing spent', () => {
    const r = computeProjectHealth({ ...healthy, spent: 0 })
    const cost = r.factors.find((f) => f.key === 'cost')!
    expect(cost.rag).toBe('green')
    expect(cost.penalty).toBe(0)
    expect(r.cpi).toBeNull()
  })
})
