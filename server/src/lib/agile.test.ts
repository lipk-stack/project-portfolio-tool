import { describe, it, expect } from 'vitest'
import { computeBurndown, computeVelocity, eachDay, AgileTask } from './agile'

const task = (overrides: Partial<AgileTask>): AgileTask => ({
  id: 1, story_points: null, status: 'todo', actual_end: null, updated_at: null, ...overrides,
})

describe('eachDay', () => {
  it('returns inclusive day range', () => {
    expect(eachDay('2026-06-01', '2026-06-03')).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
  })

  it('returns single day when start equals end', () => {
    expect(eachDay('2026-06-01', '2026-06-01')).toEqual(['2026-06-01'])
  })
})

describe('computeBurndown', () => {
  const sprint = { start_date: '2026-06-01', end_date: '2026-06-05' }
  const tasks: AgileTask[] = [
    task({ id: 1, story_points: 5, status: 'done', actual_end: '2026-06-02' }),
    task({ id: 2, story_points: 3, status: 'done', actual_end: '2026-06-04' }),
    task({ id: 3, story_points: 8, status: 'in_progress' }),
  ]

  it('sums total points', () => {
    expect(computeBurndown(sprint, tasks, '2026-06-05').totalPoints).toBe(16)
  })

  it('builds a linear ideal line from total to zero', () => {
    const { days } = computeBurndown(sprint, tasks, '2026-06-05')
    expect(days[0].ideal).toBe(16)
    expect(days[days.length - 1].ideal).toBe(0)
    expect(days[2].ideal).toBe(8)
  })

  it('burns actual points on completion dates', () => {
    const { days } = computeBurndown(sprint, tasks, '2026-06-05')
    expect(days.map(d => d.actual)).toEqual([16, 11, 11, 8, 8])
  })

  it('leaves actual null for future days', () => {
    const { days } = computeBurndown(sprint, tasks, '2026-06-02')
    expect(days[1].actual).toBe(11)
    expect(days[2].actual).toBeNull()
    expect(days[4].actual).toBeNull()
  })

  it('falls back to updated_at when actual_end missing', () => {
    const t = [task({ id: 1, story_points: 4, status: 'done', updated_at: '2026-06-03 10:00:00' })]
    const { days } = computeBurndown(sprint, t, '2026-06-05')
    expect(days.map(d => d.actual)).toEqual([4, 4, 0, 0, 0])
  })

  it('ignores tasks without points', () => {
    const t = [task({ id: 1, status: 'done', actual_end: '2026-06-01' })]
    expect(computeBurndown(sprint, t, '2026-06-05').totalPoints).toBe(0)
  })
})

describe('computeVelocity', () => {
  it('computes committed vs completed per sprint, skipping planned sprints', () => {
    const sprints = [
      { id: 1, name: 'S1', status: 'completed' },
      { id: 2, name: 'S2', status: 'active' },
      { id: 3, name: 'S3', status: 'planned' },
    ]
    const tasksBySprint = {
      1: [task({ id: 1, story_points: 5, status: 'done' }), task({ id: 2, story_points: 3, status: 'done' })],
      2: [task({ id: 3, story_points: 8, status: 'in_progress' }), task({ id: 4, story_points: 2, status: 'done' })],
      3: [task({ id: 5, story_points: 13 })],
    }
    const v = computeVelocity(sprints, tasksBySprint)
    expect(v).toHaveLength(2)
    expect(v[0]).toMatchObject({ name: 'S1', committed: 8, completed: 8 })
    expect(v[1]).toMatchObject({ name: 'S2', committed: 10, completed: 2 })
  })

  it('handles sprints with no tasks', () => {
    const v = computeVelocity([{ id: 1, name: 'Empty', status: 'completed' }], {})
    expect(v[0]).toMatchObject({ committed: 0, completed: 0 })
  })
})
