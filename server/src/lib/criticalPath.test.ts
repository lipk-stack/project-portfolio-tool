import { describe, it, expect } from 'vitest'
import { computeCriticalPath, durationInDays, CpmActivity, CpmLink } from './criticalPath'

// Helper: pull one activity's schedule out of the result by id.
function sched(result: ReturnType<typeof computeCriticalPath>, id: number) {
  return result.activities.find((a) => a.id === id)!
}

describe('computeCriticalPath', () => {
  it('schedules a simple FS chain with zero float on every node', () => {
    const activities: CpmActivity[] = [
      { id: 1, duration: 3 },
      { id: 2, duration: 2 },
      { id: 3, duration: 4 },
    ]
    const links: CpmLink[] = [
      { predecessor_id: 1, successor_id: 2 },
      { predecessor_id: 2, successor_id: 3 },
    ]
    const r = computeCriticalPath(activities, links)
    expect(r.projectDuration).toBe(9)
    expect(r.hasCycle).toBe(false)
    expect(sched(r, 1)).toMatchObject({
      earlyStart: 0,
      earlyFinish: 3,
      totalFloat: 0,
      isCritical: true,
    })
    expect(sched(r, 2)).toMatchObject({ earlyStart: 3, earlyFinish: 5, isCritical: true })
    expect(sched(r, 3)).toMatchObject({ earlyStart: 5, earlyFinish: 9, isCritical: true })
    expect(r.criticalPath).toEqual([1, 2, 3])
  })

  it('computes float for a parallel branch that is shorter than the critical one', () => {
    // 1 -> 2 -> 4 (3+5+2 = 10, critical) and 1 -> 3 -> 4 (3+1+2 = 6, slack)
    const activities: CpmActivity[] = [
      { id: 1, duration: 3 },
      { id: 2, duration: 5 },
      { id: 3, duration: 1 },
      { id: 4, duration: 2 },
    ]
    const links: CpmLink[] = [
      { predecessor_id: 1, successor_id: 2 },
      { predecessor_id: 1, successor_id: 3 },
      { predecessor_id: 2, successor_id: 4 },
      { predecessor_id: 3, successor_id: 4 },
    ]
    const r = computeCriticalPath(activities, links)
    expect(r.projectDuration).toBe(10)
    expect(r.criticalPath).toEqual([1, 2, 4])
    // Activity 3 can slip 4 days (start by day 7 instead of 3) without delaying 4.
    expect(sched(r, 3).totalFloat).toBe(4)
    expect(sched(r, 3).freeFloat).toBe(4)
    expect(sched(r, 3).isCritical).toBe(false)
    // Critical activities have no float.
    expect(sched(r, 2).totalFloat).toBe(0)
  })

  it('distinguishes free float from total float on a chain that joins a critical merge', () => {
    // Critical chain 1(4) -> 4(4) = 8. Side chain 2(1) -> 3(1) -> 4. Node 2 and 3
    // share total float, but only the last of them (3) has free float, because 2
    // slipping would push 3's early start.
    const activities: CpmActivity[] = [
      { id: 1, duration: 4 },
      { id: 2, duration: 1 },
      { id: 3, duration: 1 },
      { id: 4, duration: 4 },
    ]
    const links: CpmLink[] = [
      { predecessor_id: 1, successor_id: 4 },
      { predecessor_id: 2, successor_id: 3 },
      { predecessor_id: 3, successor_id: 4 },
    ]
    const r = computeCriticalPath(activities, links)
    expect(r.projectDuration).toBe(8)
    expect(sched(r, 2).totalFloat).toBe(2)
    expect(sched(r, 2).freeFloat).toBe(0) // slipping 2 immediately delays 3
    expect(sched(r, 3).totalFloat).toBe(2)
    expect(sched(r, 3).freeFloat).toBe(2) // 3 can slip 2 days before 4's ES moves
  })

  it('honours lag on a finish-to-start link', () => {
    const r = computeCriticalPath(
      [
        { id: 1, duration: 2 },
        { id: 2, duration: 2 },
      ],
      [{ predecessor_id: 1, successor_id: 2, type: 'FS', lag: 3 }],
    )
    expect(sched(r, 2).earlyStart).toBe(5) // 2 (finish) + 3 (lag)
    expect(r.projectDuration).toBe(7)
  })

  it('supports start-to-start and finish-to-finish relationships', () => {
    const ss = computeCriticalPath(
      [
        { id: 1, duration: 5 },
        { id: 2, duration: 3 },
      ],
      [{ predecessor_id: 1, successor_id: 2, type: 'SS', lag: 1 }],
    )
    expect(sched(ss, 2).earlyStart).toBe(1) // starts 1 day after 1 starts
    expect(ss.projectDuration).toBe(5)

    const ff = computeCriticalPath(
      [
        { id: 1, duration: 5 },
        { id: 2, duration: 3 },
      ],
      [{ predecessor_id: 1, successor_id: 2, type: 'FF', lag: 0 }],
    )
    expect(sched(ff, 2).earlyFinish).toBe(5) // finishes when 1 finishes
    expect(sched(ff, 2).earlyStart).toBe(2)
  })

  it('flags cycles without throwing', () => {
    const r = computeCriticalPath(
      [
        { id: 1, duration: 2 },
        { id: 2, duration: 2 },
      ],
      [
        { predecessor_id: 1, successor_id: 2 },
        { predecessor_id: 2, successor_id: 1 },
      ],
    )
    expect(r.hasCycle).toBe(true)
    expect(r.activities).toHaveLength(2)
  })

  it('ignores links that reference unknown activities', () => {
    const r = computeCriticalPath(
      [{ id: 1, duration: 3 }],
      [{ predecessor_id: 1, successor_id: 999 }],
    )
    expect(r.projectDuration).toBe(3)
    expect(sched(r, 1).isCritical).toBe(true)
  })

  it('returns an empty schedule for no activities', () => {
    const r = computeCriticalPath([], [])
    expect(r.projectDuration).toBe(0)
    expect(r.criticalPath).toEqual([])
    expect(r.hasCycle).toBe(false)
  })
})

describe('durationInDays', () => {
  it('uses the date span when both dates are present', () => {
    expect(durationInDays('2026-01-01', '2026-01-06')).toBe(5)
  })

  it('treats a same-day task as a zero-duration milestone', () => {
    expect(durationInDays('2026-01-01', '2026-01-01')).toBe(0)
  })

  it('falls back to the estimate (8h per day) when dates are missing', () => {
    expect(durationInDays(null, null, 16)).toBe(2)
    expect(durationInDays(undefined, undefined, 6)).toBe(0.75)
  })

  it('returns 0 when there is no date and no estimate', () => {
    expect(durationInDays(null, null, null)).toBe(0)
  })
})
