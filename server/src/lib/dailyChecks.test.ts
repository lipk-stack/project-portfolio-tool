import { describe, it, expect } from 'vitest'
import {
  detectOverdueTasks,
  detectBudgetOverruns,
  detectMissedMilestones,
  OverdueTaskRow,
  BudgetRow,
  MilestoneRow,
} from './dailyChecks'

describe('detectOverdueTasks', () => {
  const today = '2026-06-25'
  const tasks: OverdueTaskRow[] = [
    { id: 1, name: 'Past due, open', project_id: 1, status: 'in_progress', end_date: '2026-06-20' },
    { id: 2, name: 'Past due, done', project_id: 1, status: 'done', end_date: '2026-06-20' },
    { id: 3, name: 'Due today', project_id: 1, status: 'todo', end_date: '2026-06-25' },
    { id: 4, name: 'Future', project_id: 1, status: 'todo', end_date: '2026-07-01' },
    { id: 5, name: 'No due date', project_id: 1, status: 'todo', end_date: null },
  ]

  it('flags only open tasks whose due date is strictly in the past', () => {
    expect(detectOverdueTasks(tasks, today).map((t) => t.id)).toEqual([1])
  })

  it('does not flag a task due today', () => {
    expect(detectOverdueTasks([tasks[2]], today)).toEqual([])
  })

  it('ignores a time component on the due date', () => {
    const t: OverdueTaskRow[] = [{ id: 9, name: 'X', project_id: 1, status: 'todo', end_date: '2026-06-24T23:59:00' }]
    expect(detectOverdueTasks(t, today).map((x) => x.id)).toEqual([9])
  })

  it('returns nothing when no task is overdue', () => {
    expect(detectOverdueTasks([tasks[3], tasks[4]], today)).toEqual([])
  })
})

describe('detectBudgetOverruns', () => {
  const projects: BudgetRow[] = [
    { id: 1, name: 'Over', budget: 100, spent: 120 },
    { id: 2, name: 'Under', budget: 100, spent: 80 },
    { id: 3, name: 'Exactly at budget', budget: 100, spent: 100 },
    { id: 4, name: 'No budget set', budget: 0, spent: 50 },
  ]

  it('flags only projects whose spend strictly exceeds a positive budget', () => {
    expect(detectBudgetOverruns(projects).map((p) => p.id)).toEqual([1])
  })

  it('does not flag a project spent exactly to budget', () => {
    expect(detectBudgetOverruns([projects[2]])).toEqual([])
  })

  it('skips projects with no budget set', () => {
    expect(detectBudgetOverruns([projects[3]])).toEqual([])
  })
})

describe('detectMissedMilestones', () => {
  const today = '2026-06-25'
  const milestones: MilestoneRow[] = [
    { id: 1, name: 'Past, upcoming', project_id: 1, date: '2026-06-20', status: 'upcoming' },
    { id: 2, name: 'Past, achieved', project_id: 1, date: '2026-06-20', status: 'achieved' },
    { id: 3, name: 'Due today', project_id: 1, date: '2026-06-25', status: 'upcoming' },
    { id: 4, name: 'Future', project_id: 1, date: '2026-07-10', status: 'upcoming' },
  ]

  it('flags only unachieved milestones whose date is strictly in the past', () => {
    expect(detectMissedMilestones(milestones, today).map((m) => m.id)).toEqual([1])
  })

  it('does not flag a milestone due today', () => {
    expect(detectMissedMilestones([milestones[2]], today)).toEqual([])
  })

  it('never flags an achieved milestone regardless of date', () => {
    expect(detectMissedMilestones([milestones[1]], today)).toEqual([])
  })

  it('ignores a time component on the milestone date', () => {
    const m: MilestoneRow[] = [{ id: 9, name: 'X', project_id: 1, date: '2026-06-24T23:59:00', status: 'upcoming' }]
    expect(detectMissedMilestones(m, today).map((x) => x.id)).toEqual([9])
  })
})
