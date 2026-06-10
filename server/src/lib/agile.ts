export interface AgileTask {
  id: number
  story_points: number | null
  status: string
  actual_end: string | null
  updated_at?: string | null
}

export interface SprintWindow {
  start_date: string
  end_date: string
}

export interface BurndownDay {
  date: string
  ideal: number
  actual: number | null
}

export function eachDay(start: string, end: string): string[] {
  const days: string[] = []
  const cur = new Date(start + 'T00:00:00Z')
  const last = new Date(end + 'T00:00:00Z')
  while (cur <= last) {
    days.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return days
}

function doneDate(task: AgileTask): string | null {
  if (task.status !== 'done') return null
  if (task.actual_end) return task.actual_end.slice(0, 10)
  if (task.updated_at) return task.updated_at.slice(0, 10)
  return null
}

export function computeBurndown(sprint: SprintWindow, tasks: AgileTask[], today?: string): { totalPoints: number; days: BurndownDay[] } {
  const totalPoints = tasks.reduce((s, t) => s + (t.story_points || 0), 0)
  const allDays = eachDay(sprint.start_date, sprint.end_date)
  const todayStr = today || new Date().toISOString().slice(0, 10)

  const days: BurndownDay[] = allDays.map((date, i) => {
    const ideal = allDays.length > 1
      ? Math.round(totalPoints * (1 - i / (allDays.length - 1)) * 10) / 10
      : 0

    let actual: number | null = null
    if (date <= todayStr) {
      const burned = tasks.reduce((s, t) => {
        const dd = doneDate(t)
        return dd && dd <= date ? s + (t.story_points || 0) : s
      }, 0)
      actual = totalPoints - burned
    }
    return { date, ideal, actual }
  })

  return { totalPoints, days }
}

export interface VelocityEntry {
  sprint_id: number
  name: string
  committed: number
  completed: number
}

export function computeVelocity(
  sprints: Array<{ id: number; name: string; status: string }>,
  tasksBySprint: Record<number, AgileTask[]>
): VelocityEntry[] {
  return sprints
    .filter(s => s.status === 'completed' || s.status === 'active')
    .map(s => {
      const tasks = tasksBySprint[s.id] || []
      return {
        sprint_id: s.id,
        name: s.name,
        committed: tasks.reduce((sum, t) => sum + (t.story_points || 0), 0),
        completed: tasks.reduce((sum, t) => sum + (t.status === 'done' ? (t.story_points || 0) : 0), 0),
      }
    })
}
