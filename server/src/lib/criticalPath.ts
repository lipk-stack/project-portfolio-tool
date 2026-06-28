// Critical Path Method (CPM) scheduling engine — the analytical core that turns
// a network of activities (tasks with durations) and typed precedence links into
// a schedule: early/late start & finish, total & free float, and the set of
// activities whose float is zero (the critical path). This is the same forward-
// pass/backward-pass algorithm MS Project, Primavera P6 and PMBOK describe.
//
// The engine is deliberately pure and unit-agnostic: durations and lags are
// plain numbers (the caller works in days). It knows nothing about the database
// or calendar dates — the route layer derives durations from task dates, runs
// the engine, then maps the day offsets back onto a calendar anchor. That split
// is what keeps the interesting logic fully unit-testable without a live DB.

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'

export interface CpmActivity {
  id: number
  duration: number // working span in days; negative values are floored to 0
}

export interface CpmLink {
  predecessor_id: number
  successor_id: number
  type?: DependencyType // defaults to FS (finish-to-start)
  lag?: number // days; may be negative to express a lead
}

export interface ActivitySchedule {
  id: number
  duration: number
  earlyStart: number
  earlyFinish: number
  lateStart: number
  lateFinish: number
  totalFloat: number // slack before the project end slips
  freeFloat: number // slack before any successor's early start slips
  isCritical: boolean
}

export interface CpmResult {
  activities: ActivitySchedule[] // in input order
  projectDuration: number // earliest finish of the whole network, in days
  criticalPath: number[] // critical activity ids, ordered by early start
  hasCycle: boolean // true when links form a loop (schedule is then best-effort)
}

// Floats are compared against a small epsilon so fractional durations (e.g. an
// estimate of 6h → 0.75d) don't spuriously read as non-critical from rounding.
const EPS = 1e-6

// The early start a predecessor imposes on a successor, given the link type.
// FS: successor starts after predecessor finishes; SS: after it starts; FF/SF
// constrain the successor's finish, so we subtract the successor's duration to
// get the implied start.
function imposedStart(
  type: DependencyType,
  predES: number,
  predEF: number,
  lag: number,
  succDuration: number,
): number {
  switch (type) {
    case 'SS':
      return predES + lag
    case 'FF':
      return predEF + lag - succDuration
    case 'SF':
      return predES + lag - succDuration
    case 'FS':
    default:
      return predEF + lag
  }
}

// The latest finish a successor imposes on its predecessor — the mirror of
// imposedStart used by the backward pass.
function imposedFinish(
  type: DependencyType,
  succLS: number,
  succLF: number,
  lag: number,
  predDuration: number,
): number {
  switch (type) {
    case 'SS':
      return succLS - lag + predDuration
    case 'FF':
      return succLF - lag
    case 'SF':
      return succLF - lag + predDuration
    case 'FS':
    default:
      return succLS - lag
  }
}

export function computeCriticalPath(activities: CpmActivity[], links: CpmLink[]): CpmResult {
  const ids = activities.map((a) => a.id)
  const duration = new Map<number, number>()
  for (const a of activities) duration.set(a.id, Math.max(0, a.duration))

  // Keep only links whose endpoints both exist, and normalise type/lag once.
  const edges = links
    .filter((l) => duration.has(l.predecessor_id) && duration.has(l.successor_id))
    .map((l) => ({
      predecessor_id: l.predecessor_id,
      successor_id: l.successor_id,
      type: l.type || 'FS',
      lag: l.lag || 0,
    }))

  const outgoing = new Map<number, typeof edges>()
  const indegree = new Map<number, number>()
  for (const id of ids) {
    outgoing.set(id, [])
    indegree.set(id, 0)
  }
  for (const e of edges) {
    outgoing.get(e.predecessor_id)!.push(e)
    indegree.set(e.successor_id, indegree.get(e.successor_id)! + 1)
  }

  // Kahn topological sort. Leftover nodes (indegree never hit 0) sit on a cycle;
  // we flag it and append them so every activity still receives a best-effort
  // schedule rather than throwing.
  const remaining = new Map(indegree)
  const queue = ids.filter((id) => remaining.get(id) === 0)
  const order: number[] = []
  while (queue.length) {
    const n = queue.shift()!
    order.push(n)
    for (const e of outgoing.get(n)!) {
      remaining.set(e.successor_id, remaining.get(e.successor_id)! - 1)
      if (remaining.get(e.successor_id) === 0) queue.push(e.successor_id)
    }
  }
  const hasCycle = order.length < ids.length
  if (hasCycle) {
    const seen = new Set(order)
    for (const id of ids) if (!seen.has(id)) order.push(id)
  }

  // Forward pass: earliest start/finish, propagated in topological order.
  const ES = new Map<number, number>()
  const EF = new Map<number, number>()
  for (const id of ids) ES.set(id, 0)
  for (const n of order) {
    const ef = ES.get(n)! + duration.get(n)!
    EF.set(n, ef)
    for (const e of outgoing.get(n)!) {
      const start = imposedStart(e.type, ES.get(n)!, ef, e.lag, duration.get(e.successor_id)!)
      if (start > ES.get(e.successor_id)!) ES.set(e.successor_id, start)
    }
  }

  const projectDuration = ids.length ? Math.max(...ids.map((id) => EF.get(id)!)) : 0

  // Backward pass: latest finish/start, propagated in reverse topological order.
  const LF = new Map<number, number>()
  const LS = new Map<number, number>()
  for (let i = order.length - 1; i >= 0; i--) {
    const n = order[i]
    const outs = outgoing.get(n)!
    let lf = projectDuration
    for (const e of outs) {
      const cand = imposedFinish(
        e.type,
        LS.get(e.successor_id)!,
        LF.get(e.successor_id)!,
        e.lag,
        duration.get(n)!,
      )
      if (cand < lf) lf = cand
    }
    LF.set(n, lf)
    LS.set(n, lf - duration.get(n)!)
  }

  const schedule: ActivitySchedule[] = activities.map((a) => {
    const id = a.id
    const es = ES.get(id)!
    const ef = EF.get(id)!
    const totalFloat = LS.get(id)! - es
    const outs = outgoing.get(id)!
    let freeFloat: number
    if (outs.length === 0) {
      freeFloat = projectDuration - ef
    } else {
      freeFloat = Infinity
      for (const e of outs) {
        const imposed = imposedStart(e.type, es, ef, e.lag, duration.get(e.successor_id)!)
        const slack = ES.get(e.successor_id)! - imposed
        if (slack < freeFloat) freeFloat = slack
      }
    }
    return {
      id,
      duration: duration.get(id)!,
      earlyStart: es,
      earlyFinish: ef,
      lateStart: LS.get(id)!,
      lateFinish: LF.get(id)!,
      totalFloat,
      freeFloat: Math.max(0, freeFloat),
      isCritical: totalFloat <= EPS,
    }
  })

  const criticalPath = schedule
    .filter((s) => s.isCritical)
    .sort((a, b) => a.earlyStart - b.earlyStart || a.id - b.id)
    .map((s) => s.id)

  return { activities: schedule, projectDuration, criticalPath, hasCycle }
}

// Derive an activity duration in days from a task's planned dates, falling back
// to its estimate (8h = 1 working day) and finally to 0 (a milestone). Kept here
// so the date→duration convention lives next to the engine that consumes it.
const MS_PER_DAY = 24 * 60 * 60 * 1000

export function durationInDays(
  start?: string | null,
  end?: string | null,
  estimatedHours?: number | null,
): number {
  if (start && end) {
    const s = Date.parse(start)
    const e = Date.parse(end)
    if (!Number.isNaN(s) && !Number.isNaN(e)) return Math.max(0, Math.round((e - s) / MS_PER_DAY))
  }
  if (estimatedHours && estimatedHours > 0) return estimatedHours / 8
  return 0
}
