// Earned Schedule (ES) — Lipke's time-based extension of EVM. Classic SV/SPI
// converge to 0/1 at project end even for late projects; ES measures schedule
// performance in TIME units instead. PV is assumed to accrue linearly over the
// planned window (the same assumption the EVM endpoint uses), so the date at
// which PV equaled today's EV is: start + plannedDuration * EV/BAC.

export interface EarnedScheduleInput {
  BAC: number
  EV: number
  start: string // planned/baseline start, YYYY-MM-DD
  end: string // planned/baseline end, YYYY-MM-DD
  asOf?: Date
}

export interface EarnedScheduleResult {
  plannedDurationDays: number // PD
  actualTimeDays: number // AT: elapsed time since start
  earnedScheduleDays: number // ES: when PV equaled current EV
  SPIt: number // SPI(t) = ES / AT
  timeVarianceDays: number // TV = ES - AT (negative = behind)
  forecastDurationDays: number // IEAC(t) = PD / SPI(t)
  forecastEndDate: string // start + IEAC(t)
  forecastSlipDays: number // forecast end - planned end
}

function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function computeEarnedSchedule(input: EarnedScheduleInput): EarnedScheduleResult | null {
  const { BAC, EV, start, end } = input
  if (!start || !end || isNaN(Date.parse(start)) || isNaN(Date.parse(end))) return null
  const PD = diffDays(start, end)
  if (PD <= 0 || BAC <= 0) return null

  const asOf = (input.asOf ?? new Date()).toISOString().slice(0, 10)
  const AT = Math.max(0, diffDays(start, asOf))
  const earnedFrac = Math.min(1, Math.max(0, EV / BAC))
  const ES = PD * earnedFrac

  // Before any time has elapsed there is no schedule signal yet.
  const SPIt = AT > 0 ? ES / AT : 1
  const forecastDuration = earnedFrac >= 1 ? Math.min(AT, PD) : SPIt > 0 ? PD / SPIt : PD * 4
  const forecastEnd = addDays(start, Math.round(forecastDuration))

  return {
    plannedDurationDays: PD,
    actualTimeDays: AT,
    earnedScheduleDays: Number(ES.toFixed(1)),
    SPIt: Number(SPIt.toFixed(3)),
    timeVarianceDays: Number((ES - AT).toFixed(1)),
    forecastDurationDays: Math.round(forecastDuration),
    forecastEndDate: forecastEnd,
    forecastSlipDays: diffDays(end, forecastEnd),
  }
}
