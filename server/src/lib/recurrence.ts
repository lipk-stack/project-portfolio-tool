// Recurring tasks. When a recurring task is completed we materialize the NEXT
// occurrence: a fresh copy whose dates are shifted forward by one period while
// preserving the original duration. Pure + deterministic so it can be unit
// tested without touching the DB.

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly'
export const RECURRENCES: Recurrence[] = ['none', 'daily', 'weekly', 'monthly']

export function isValidRecurrence(r: unknown): r is Recurrence {
  return typeof r === 'string' && (RECURRENCES as string[]).includes(r)
}

// Normalize whatever is stored (NULL, '', 'none', 'weekly', ...) to a Recurrence.
export function normalizeRecurrence(r: unknown): Recurrence {
  return isValidRecurrence(r) && r !== 'none' ? r : 'none'
}

export interface NextOccurrenceInput {
  start_date: string | null
  end_date: string | null
  recurrence: string | null
  recurrence_until?: string | null
}

export interface NextOccurrence {
  start_date: string | null
  end_date: string | null
}

function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Add one period to an anchor date. Monthly clamps to the last valid day of the
// target month (e.g. Jan 31 + 1 month -> Feb 28/29, never spills into March).
function addPeriod(date: string, rec: Recurrence): string {
  if (rec === 'daily') return addDays(date, 1)
  if (rec === 'weekly') return addDays(date, 7)
  if (rec === 'monthly') {
    const d = new Date(date + 'T00:00:00Z')
    const day = d.getUTCDate()
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() + 1)
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
    d.setUTCDate(Math.min(day, lastDay))
    return d.toISOString().slice(0, 10)
  }
  return date
}

/**
 * Compute the next occurrence's dates for a recurring task. Returns null when
 * the task does not recur, has no usable date to anchor on, or the next start
 * would fall after recurrence_until. Duration (end - start) is preserved.
 */
export function computeNextOccurrence(input: NextOccurrenceInput): NextOccurrence | null {
  const rec = normalizeRecurrence(input.recurrence)
  if (rec === 'none') return null

  const { start_date, end_date } = input
  const anchor = start_date || end_date
  if (!anchor || isNaN(Date.parse(anchor))) return null

  let nextStart: string | null = null
  let nextEnd: string | null = null

  if (start_date && !isNaN(Date.parse(start_date))) {
    nextStart = addPeriod(start_date, rec)
    if (end_date && !isNaN(Date.parse(end_date))) {
      const duration = Math.max(0, diffDays(start_date, end_date))
      nextEnd = addDays(nextStart, duration)
    }
  } else if (end_date && !isNaN(Date.parse(end_date))) {
    nextEnd = addPeriod(end_date, rec)
  }

  const until = input.recurrence_until
  if (until && !isNaN(Date.parse(until))) {
    const check = nextStart || nextEnd
    if (check && check > until) return null
  }

  return { start_date: nextStart, end_date: nextEnd }
}
