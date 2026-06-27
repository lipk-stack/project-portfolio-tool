// The daily-sweep scheduler. The bootstrap (index.ts) runs runDailyChecks()
// once at startup; this keeps it firing for a long-lived server WITHOUT a
// restart by re-arming a setTimeout at every UTC day boundary.
//
// We anchor to UTC midnight (not local) to match the date logic the sweep
// itself uses: dailyChecksService.today() and the pure detectors all key off
// new Date().toISOString().slice(0, 10), i.e. the UTC calendar day. Firing on
// the same boundary the snapshot is recorded against keeps "today" consistent.
//
// Re-arming (rather than a fixed setInterval) recomputes the delay each day, so
// it never drifts and stays correct across any clock change. The whole sweep is
// idempotent per day — recordDailySnapshots() upserts per (project, date), the
// health transitions de-dupe on their once-per-day marker, and overdue/overrun
// de-dupe through alert_log — so even a redundant fire is harmless.

import { runDailyChecks, DailyChecksResult } from './dailyChecksService'

// Milliseconds from `now` until the next UTC midnight. Always in (0, 86_400_000]:
// at exactly midnight it returns a full day rather than 0, so we never schedule
// a zero-delay timer that would re-fire the same instant.
export function msUntilNextUtcMidnight(now: Date): number {
  const nextDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  return nextDay - now.getTime()
}

// Logs the non-empty alert families from a sweep. Shared by the startup
// bootstrap and the scheduled runs so both report identically.
export function logDailyResult(r: DailyChecksResult): void {
  if (r.redAlerts.length) console.log(`⚠️  Health alerts raised for: ${r.redAlerts.join(', ')}`)
  if (r.recoveries.length) console.log(`✅ Health recoveries noted for: ${r.recoveries.join(', ')}`)
  if (r.overdue.length) console.log(`⏰ Overdue tasks flagged: ${r.overdue.join(', ')}`)
  if (r.overruns.length) console.log(`💸 Budget overruns flagged: ${r.overruns.join(', ')}`)
  if (r.missedMilestones.length) console.log(`🚩 Milestones missed: ${r.missedMilestones.join(', ')}`)
}

let timer: ReturnType<typeof setTimeout> | null = null

// Arms the next daily sweep. `run` and `now` are injectable so the scheduler can
// be driven deterministically under fake timers in tests; production passes
// neither and gets runDailyChecks() at the real next UTC midnight.
export function startDailyScheduler(
  run: () => DailyChecksResult = runDailyChecks,
  now: () => Date = () => new Date()
): void {
  const delay = msUntilNextUtcMidnight(now())
  timer = setTimeout(() => {
    try {
      logDailyResult(run())
    } catch (err) {
      console.error('Scheduled daily checks failed:', err)
    }
    startDailyScheduler(run, now) // re-arm for the following UTC midnight
  }, delay)
  // Don't let the timer keep the process alive on its own (matters for test
  // runners and one-off scripts); the HTTP server is what keeps the server up.
  timer.unref?.()
  console.log(`🗓️  Next daily sweep scheduled in ${Math.round(delay / 3_600_000)}h (next UTC midnight)`)
}

export function stopDailyScheduler(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}
