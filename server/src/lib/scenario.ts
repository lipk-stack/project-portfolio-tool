// What-if scenario planning: apply hypothetical shifts/duration changes to a
// project schedule and propagate through FS dependencies — purely in memory,
// no DB writes. Pure functions so they can be unit-tested.

export interface ScenarioTask {
  id: number
  name: string
  start_date: string | null
  end_date: string | null
  estimated_hours: number
  hourly_rate: number
  status: string
}

export interface ScenarioDep {
  predecessor_id: number
  successor_id: number
  lag?: number
}

export interface ScenarioChange {
  task_id: number
  shift_days?: number
  duration_delta_days?: number
}

export interface ScenarioTaskResult {
  id: number
  name: string
  old_start: string | null
  old_end: string | null
  new_start: string | null
  new_end: string | null
  delta_days: number
  changed: boolean
  directly_changed: boolean
}

export interface ScenarioResult {
  tasks: ScenarioTaskResult[]
  summary: {
    old_end: string | null
    new_end: string | null
    end_delta_days: number
    old_cost: number
    new_cost: number
    cost_delta: number
  }
}

export function addDaysStr(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function diffDays(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86400000)
}

// Kahn topological order over successor edges; tasks in dependency cycles are
// left in input order (the forward pass simply won't push them further).
function topoOrder(taskIds: number[], deps: ScenarioDep[]): number[] {
  const inDegree = new Map<number, number>()
  const successors = new Map<number, number[]>()
  const idSet = new Set(taskIds)
  for (const id of taskIds) inDegree.set(id, 0)
  for (const d of deps) {
    if (!idSet.has(d.predecessor_id) || !idSet.has(d.successor_id)) continue
    inDegree.set(d.successor_id, (inDegree.get(d.successor_id) || 0) + 1)
    const list = successors.get(d.predecessor_id) || []
    list.push(d.successor_id)
    successors.set(d.predecessor_id, list)
  }
  const queue = taskIds.filter(id => (inDegree.get(id) || 0) === 0)
  const order: number[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const s of successors.get(id) || []) {
      inDegree.set(s, inDegree.get(s)! - 1)
      if (inDegree.get(s) === 0) queue.push(s)
    }
  }
  // Cycle fallback: append any remaining tasks in original order
  for (const id of taskIds) if (!order.includes(id)) order.push(id)
  return order
}

export function applyScenario(
  tasks: ScenarioTask[],
  deps: ScenarioDep[],
  changes: ScenarioChange[]
): ScenarioResult {
  const changeMap = new Map<number, ScenarioChange>()
  for (const c of changes) changeMap.set(c.task_id, c)

  // Tentative schedule: apply direct shifts and duration deltas
  const sched = new Map<number, { start: string | null; end: string | null }>()
  const directlyChanged = new Set<number>()
  for (const t of tasks) {
    let start = t.start_date
    let end = t.end_date
    const c = changeMap.get(t.id)
    if (c && start && end) {
      if (c.shift_days) {
        start = addDaysStr(start, c.shift_days)
        end = addDaysStr(end, c.shift_days)
        directlyChanged.add(t.id)
      }
      if (c.duration_delta_days) {
        end = addDaysStr(end, c.duration_delta_days)
        if (diffDays(start, end) < 0) end = start // duration can't go negative
        directlyChanged.add(t.id)
      }
    }
    sched.set(t.id, { start, end })
  }

  // Forward pass: each successor starts no earlier than predecessor end + 1 + lag
  const predsOf = new Map<number, ScenarioDep[]>()
  for (const d of deps) {
    const list = predsOf.get(d.successor_id) || []
    list.push(d)
    predsOf.set(d.successor_id, list)
  }
  const order = topoOrder(tasks.map(t => t.id), deps)
  for (const id of order) {
    const s = sched.get(id)
    if (!s || !s.start || !s.end) continue
    let earliest: string | null = null
    for (const dep of predsOf.get(id) || []) {
      const pred = sched.get(dep.predecessor_id)
      if (!pred || !pred.end) continue
      const minStart = addDaysStr(pred.end, 1 + (dep.lag || 0))
      if (!earliest || minStart > earliest) earliest = minStart
    }
    if (earliest && earliest > s.start) {
      const duration = diffDays(s.start, s.end)
      s.start = earliest
      s.end = addDaysStr(earliest, duration)
    }
  }

  // Cost: hours scale with duration change (same daily burn rate)
  let oldCost = 0
  let newCost = 0
  const results: ScenarioTaskResult[] = tasks.map(t => {
    const s = sched.get(t.id)!
    const taskOldCost = (t.estimated_hours || 0) * (t.hourly_rate || 0)
    let taskNewCost = taskOldCost
    const c = changeMap.get(t.id)
    if (c?.duration_delta_days && t.start_date && t.end_date) {
      const oldDuration = Math.max(1, diffDays(t.start_date, t.end_date) + 1)
      const newDuration = Math.max(1, oldDuration + c.duration_delta_days)
      taskNewCost = taskOldCost * (newDuration / oldDuration)
    }
    oldCost += taskOldCost
    newCost += taskNewCost
    const deltaDays = t.end_date && s.end ? diffDays(t.end_date, s.end) : 0
    return {
      id: t.id,
      name: t.name,
      old_start: t.start_date,
      old_end: t.end_date,
      new_start: s.start,
      new_end: s.end,
      delta_days: deltaDays,
      changed: deltaDays !== 0 || (t.start_date !== s.start),
      directly_changed: directlyChanged.has(t.id),
    }
  })

  const oldEnd = tasks.reduce<string | null>((max, t) => (t.end_date && (!max || t.end_date > max) ? t.end_date : max), null)
  const newEnd = results.reduce<string | null>((max, r) => (r.new_end && (!max || r.new_end > max) ? r.new_end : max), null)

  return {
    tasks: results,
    summary: {
      old_end: oldEnd,
      new_end: newEnd,
      end_delta_days: oldEnd && newEnd ? diffDays(oldEnd, newEnd) : 0,
      old_cost: Math.round(oldCost),
      new_cost: Math.round(newCost),
      cost_delta: Math.round(newCost - oldCost),
    },
  }
}
