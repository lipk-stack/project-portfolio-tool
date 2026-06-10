import { describe, it, expect } from 'vitest'
import { applyScenario, addDaysStr, diffDays, ScenarioTask, ScenarioDep } from './scenario'

const task = (id: number, start: string, end: string, hours = 40, rate = 100): ScenarioTask => ({
  id, name: `Task ${id}`, start_date: start, end_date: end, estimated_hours: hours, hourly_rate: rate, status: 'todo',
})

describe('date helpers', () => {
  it('adds days across month boundaries', () => {
    expect(addDaysStr('2026-01-30', 3)).toBe('2026-02-02')
    expect(addDaysStr('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('diffs days', () => {
    expect(diffDays('2026-01-01', '2026-01-11')).toBe(10)
    expect(diffDays('2026-01-11', '2026-01-01')).toBe(-10)
  })
})

describe('applyScenario', () => {
  it('returns identity when no changes', () => {
    const tasks = [task(1, '2026-01-01', '2026-01-10'), task(2, '2026-01-11', '2026-01-20')]
    const res = applyScenario(tasks, [], [])
    expect(res.tasks.every(t => !t.changed)).toBe(true)
    expect(res.summary.end_delta_days).toBe(0)
    expect(res.summary.cost_delta).toBe(0)
  })

  it('shifts a single task', () => {
    const res = applyScenario([task(1, '2026-01-01', '2026-01-10')], [], [{ task_id: 1, shift_days: 5 }])
    expect(res.tasks[0].new_start).toBe('2026-01-06')
    expect(res.tasks[0].new_end).toBe('2026-01-15')
    expect(res.tasks[0].directly_changed).toBe(true)
    expect(res.summary.end_delta_days).toBe(5)
  })

  it('propagates a shift through an FS chain', () => {
    const tasks = [
      task(1, '2026-01-01', '2026-01-10'),
      task(2, '2026-01-11', '2026-01-20'),
      task(3, '2026-01-21', '2026-01-30'),
    ]
    const deps: ScenarioDep[] = [
      { predecessor_id: 1, successor_id: 2 },
      { predecessor_id: 2, successor_id: 3 },
    ]
    const res = applyScenario(tasks, deps, [{ task_id: 1, shift_days: 7 }])
    expect(res.tasks[1].new_start).toBe('2026-01-18')
    expect(res.tasks[1].new_end).toBe('2026-01-27')
    expect(res.tasks[2].new_start).toBe('2026-01-28')
    expect(res.tasks[2].new_end).toBe('2026-02-06')
    expect(res.summary.end_delta_days).toBe(7)
    expect(res.tasks[1].directly_changed).toBe(false)
    expect(res.tasks[1].changed).toBe(true)
  })

  it('does not pull successors earlier when predecessor moves up', () => {
    const tasks = [task(1, '2026-01-01', '2026-01-10'), task(2, '2026-01-20', '2026-01-29')]
    const deps: ScenarioDep[] = [{ predecessor_id: 1, successor_id: 2 }]
    const res = applyScenario(tasks, deps, [{ task_id: 1, shift_days: -5 }])
    // Successor already starts after predecessor end; stays put
    expect(res.tasks[1].new_start).toBe('2026-01-20')
    expect(res.tasks[1].changed).toBe(false)
  })

  it('extends duration and propagates', () => {
    const tasks = [task(1, '2026-01-01', '2026-01-10'), task(2, '2026-01-11', '2026-01-20')]
    const deps: ScenarioDep[] = [{ predecessor_id: 1, successor_id: 2 }]
    const res = applyScenario(tasks, deps, [{ task_id: 1, duration_delta_days: 4 }])
    expect(res.tasks[0].new_end).toBe('2026-01-14')
    expect(res.tasks[1].new_start).toBe('2026-01-15')
  })

  it('respects dependency lag', () => {
    const tasks = [task(1, '2026-01-01', '2026-01-10'), task(2, '2026-01-11', '2026-01-20')]
    const deps: ScenarioDep[] = [{ predecessor_id: 1, successor_id: 2, lag: 3 }]
    const res = applyScenario(tasks, deps, [{ task_id: 1, shift_days: 1 }])
    // pred ends 01-11, +1 day +3 lag = starts 01-15
    expect(res.tasks[1].new_start).toBe('2026-01-15')
  })

  it('clamps negative durations to zero-length', () => {
    const res = applyScenario([task(1, '2026-01-01', '2026-01-05')], [], [{ task_id: 1, duration_delta_days: -30 }])
    expect(res.tasks[0].new_end).toBe('2026-01-01')
  })

  it('scales cost with duration changes', () => {
    // 10-day task (Jan 1-10 inclusive), 40h @ $100 = $4000; +5 days => 15/10 ratio
    const res = applyScenario([task(1, '2026-01-01', '2026-01-10')], [], [{ task_id: 1, duration_delta_days: 5 }])
    expect(res.summary.old_cost).toBe(4000)
    expect(res.summary.new_cost).toBe(6000)
    expect(res.summary.cost_delta).toBe(2000)
  })

  it('shift alone does not change cost', () => {
    const res = applyScenario([task(1, '2026-01-01', '2026-01-10')], [], [{ task_id: 1, shift_days: 10 }])
    expect(res.summary.cost_delta).toBe(0)
  })

  it('handles tasks without dates gracefully', () => {
    const noDate: ScenarioTask = { id: 9, name: 'Backlog', start_date: null, end_date: null, estimated_hours: 8, hourly_rate: 50, status: 'todo' }
    const res = applyScenario([noDate, task(1, '2026-01-01', '2026-01-10')], [], [{ task_id: 9, shift_days: 5 }])
    expect(res.tasks[0].new_start).toBeNull()
    expect(res.summary.old_end).toBe('2026-01-10')
  })

  it('survives dependency cycles without hanging', () => {
    const tasks = [task(1, '2026-01-01', '2026-01-10'), task(2, '2026-01-11', '2026-01-20')]
    const deps: ScenarioDep[] = [
      { predecessor_id: 1, successor_id: 2 },
      { predecessor_id: 2, successor_id: 1 },
    ]
    const res = applyScenario(tasks, deps, [{ task_id: 1, shift_days: 2 }])
    expect(res.tasks.length).toBe(2)
  })

  it('takes the latest predecessor when multiple converge', () => {
    const tasks = [
      task(1, '2026-01-01', '2026-01-05'),
      task(2, '2026-01-01', '2026-01-15'),
      task(3, '2026-01-16', '2026-01-25'),
    ]
    const deps: ScenarioDep[] = [
      { predecessor_id: 1, successor_id: 3 },
      { predecessor_id: 2, successor_id: 3 },
    ]
    const res = applyScenario(tasks, deps, [{ task_id: 2, duration_delta_days: 5 }])
    expect(res.tasks[2].new_start).toBe('2026-01-21')
  })
})
