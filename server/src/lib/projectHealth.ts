// Project Health Scoring & Auto-Insights — a dependency-free, rule-based engine
// that condenses the many signals ProjectPulse already tracks (earned schedule,
// cost performance, risk exposure, task execution) into a single 0-100 health
// score, a RAG (red/amber/green) status, the weighted factors that drove it, and
// a plain-English narrative — the "auto status summary" feature that Planview,
// Clarity, Smartsheet and Monday all surface. It is intentionally pure (no DB,
// no fs, no clock unless asOf is passed) so it is fully unit-testable; the route
// layer gathers the raw metrics and feeds them in.

export interface ProjectHealthInput {
  name?: string
  status?: string // planning | active | on_hold | completed | cancelled
  completionPercent?: number // 0-100
  // Schedule signal (from earnedSchedule.ts). Either may be omitted when there
  // is no baseline/EVM data yet — the factor is then reported as "no data".
  spit?: number | null // SPI(t): >1 ahead, <1 behind
  forecastSlipDays?: number | null // projected end minus planned end (negative = early)
  // Cost signal. EV is derived as budget * completion%; CPI = EV / spent.
  budget?: number | null
  spent?: number | null
  // Risk exposure
  openRiskCount?: number
  criticalRiskCount?: number // open risks with a high severity score
  // Task execution
  totalTasks?: number
  overdueTasks?: number
  asOf?: Date
}

export type Rag = 'green' | 'amber' | 'red'

export interface HealthFactor {
  key: 'schedule' | 'cost' | 'risk' | 'execution'
  label: string
  rag: Rag | 'na'
  // Points deducted from 100 for this factor (0 = perfect, capped per factor).
  penalty: number
  detail: string
}

export interface ProjectHealthResult {
  score: number // 0-100, higher is healthier
  rag: Rag
  factors: HealthFactor[]
  headline: string // one-line RAG verdict
  summary: string // multi-sentence auto-narrative
  cpi: number | null
}

// Per-factor penalty caps. They sum to 100 so a project failing on every axis
// floors at 0. Schedule and cost dominate; risk and execution are secondary.
const CAP = { schedule: 32, cost: 28, risk: 22, execution: 18 } as const

function ragFromScore(score: number): Rag {
  if (score >= 80) return 'green'
  if (score >= 55) return 'amber'
  return 'red'
}

function round(n: number, dp = 0): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

function clampPenalty(p: number, cap: number): number {
  return Math.max(0, Math.min(cap, p))
}

// Maps a performance index (1.0 = on plan) to a penalty fraction of a cap.
// >= 1.0 -> 0; degrades linearly, fully penalised at index <= floor.
function indexPenalty(index: number, cap: number, floor: number): number {
  if (index >= 1) return 0
  if (index <= floor) return cap
  return cap * ((1 - index) / (1 - floor))
}

export function computeProjectHealth(input: ProjectHealthInput): ProjectHealthResult {
  const completion = Math.max(0, Math.min(100, input.completionPercent ?? 0))
  const factors: HealthFactor[] = []

  // --- Schedule ---------------------------------------------------------
  let schedulePenalty = 0
  let scheduleRag: Rag | 'na' = 'na'
  let scheduleDetail = 'No schedule baseline yet.'
  if (typeof input.spit === 'number' && isFinite(input.spit)) {
    // SPI(t) of 0.7 or worse is treated as a full schedule failure.
    schedulePenalty = indexPenalty(input.spit, CAP.schedule, 0.7)
    const slip = input.forecastSlipDays
    if (typeof slip === 'number' && slip > 0) {
      // Extra bite for a meaningful projected slip, on top of the index.
      schedulePenalty += Math.min(CAP.schedule * 0.4, (slip / 30) * (CAP.schedule * 0.4))
    }
    schedulePenalty = clampPenalty(schedulePenalty, CAP.schedule)
    scheduleRag = schedulePenalty <= CAP.schedule * 0.15 ? 'green' : schedulePenalty <= CAP.schedule * 0.5 ? 'amber' : 'red'
    const spitTxt = `SPI(t) ${round(input.spit, 2)}`
    if (input.spit >= 1) scheduleDetail = `On or ahead of schedule (${spitTxt}).`
    else if (typeof slip === 'number' && slip > 0) scheduleDetail = `Behind schedule (${spitTxt}); forecast slip ${round(slip)} day${slip === 1 ? '' : 's'}.`
    else scheduleDetail = `Behind schedule (${spitTxt}).`
  }
  factors.push({ key: 'schedule', label: 'Schedule', rag: scheduleRag, penalty: round(schedulePenalty, 1), detail: scheduleDetail })

  // --- Cost -------------------------------------------------------------
  let costPenalty = 0
  let costRag: Rag | 'na' = 'na'
  let costDetail = 'No budget data.'
  let cpi: number | null = null
  const budget = input.budget ?? 0
  const spent = input.spent ?? 0
  if (budget > 0 && spent > 0) {
    const ev = budget * (completion / 100)
    cpi = ev / spent
    // CPI of 0.7 or worse is a full cost failure.
    costPenalty = clampPenalty(indexPenalty(cpi, CAP.cost, 0.7), CAP.cost)
    costRag = costPenalty <= CAP.cost * 0.15 ? 'green' : costPenalty <= CAP.cost * 0.5 ? 'amber' : 'red'
    const overspend = spent > budget
    if (cpi >= 1) costDetail = `Under or on budget (CPI ${round(cpi, 2)}).`
    else costDetail = `${overspend ? 'Over budget' : 'Cost overrun risk'} (CPI ${round(cpi, 2)}, ${round((spent / budget) * 100)}% of budget spent at ${round(completion)}% complete).`
  } else if (budget > 0) {
    costRag = 'green'
    costDetail = 'No spend recorded yet.'
  }
  factors.push({ key: 'cost', label: 'Cost', rag: costRag, penalty: round(costPenalty, 1), detail: costDetail })

  // --- Risk -------------------------------------------------------------
  const openRisks = Math.max(0, input.openRiskCount ?? 0)
  const criticalRisks = Math.max(0, input.criticalRiskCount ?? 0)
  // Each critical risk bites hard; ordinary open risks contribute mildly.
  let riskPenalty = clampPenalty(criticalRisks * (CAP.risk * 0.45) + Math.max(0, openRisks - criticalRisks) * (CAP.risk * 0.08), CAP.risk)
  const riskRag: Rag = riskPenalty <= CAP.risk * 0.15 ? 'green' : riskPenalty <= CAP.risk * 0.5 ? 'amber' : 'red'
  let riskDetail: string
  if (criticalRisks > 0) riskDetail = `${criticalRisks} critical risk${criticalRisks === 1 ? '' : 's'} open${openRisks > criticalRisks ? ` (${openRisks} open total)` : ''}.`
  else if (openRisks > 0) riskDetail = `${openRisks} open risk${openRisks === 1 ? '' : 's'}, none critical.`
  else riskDetail = 'No open risks.'
  factors.push({ key: 'risk', label: 'Risk', rag: riskRag, penalty: round(riskPenalty, 1), detail: riskDetail })

  // --- Execution (overdue tasks) ---------------------------------------
  const totalTasks = Math.max(0, input.totalTasks ?? 0)
  const overdue = Math.max(0, input.overdueTasks ?? 0)
  let execPenalty = 0
  let execRag: Rag | 'na' = 'na'
  let execDetail = 'No tasks yet.'
  if (totalTasks > 0) {
    const ratio = Math.min(1, overdue / totalTasks)
    // 30%+ of tasks overdue is a full execution failure.
    execPenalty = clampPenalty((ratio / 0.3) * CAP.execution, CAP.execution)
    execRag = execPenalty <= CAP.execution * 0.15 ? 'green' : execPenalty <= CAP.execution * 0.5 ? 'amber' : 'red'
    execDetail = overdue > 0 ? `${overdue} of ${totalTasks} task${totalTasks === 1 ? '' : 's'} overdue (${round(ratio * 100)}%).` : `All ${totalTasks} tasks on track.`
  }
  factors.push({ key: 'execution', label: 'Execution', rag: execRag, penalty: round(execPenalty, 1), detail: execDetail })

  const totalPenalty = factors.reduce((s, f) => s + f.penalty, 0)
  let score = round(Math.max(0, Math.min(100, 100 - totalPenalty)))

  // Completed projects are reported green unless they overran materially.
  if (input.status === 'completed' && score < 80 && costPenalty < CAP.cost * 0.5) {
    score = Math.max(score, 80)
  }

  const rag = ragFromScore(score)
  const headline = buildHeadline(input.name, rag, score)
  const summary = buildSummary(input, factors, rag, completion, cpi)

  return { score, rag, factors, headline, summary, cpi: cpi === null ? null : round(cpi, 2) }
}

function buildHeadline(name: string | undefined, rag: Rag, score: number): string {
  const verdict = rag === 'green' ? 'On track' : rag === 'amber' ? 'Needs attention' : 'At risk'
  const subject = name ? name : 'Project'
  return `${subject}: ${verdict} (health ${score}/100)`
}

// Assembles a human-readable narrative by stitching the factor details in a
// problems-first order — the same way a PM would write a status update.
function buildSummary(
  input: ProjectHealthInput,
  factors: HealthFactor[],
  rag: Rag,
  completion: number,
  cpi: number | null,
): string {
  const sentences: string[] = []
  const opener =
    rag === 'green'
      ? `Project is healthy at ${round(completion)}% complete.`
      : rag === 'amber'
        ? `Project needs attention at ${round(completion)}% complete.`
        : `Project is at risk at ${round(completion)}% complete.`
  sentences.push(opener)

  const order: Rag[] = ['red', 'amber', 'green']
  const ranked = [...factors]
    .filter((f) => f.rag !== 'na')
    .sort((a, b) => order.indexOf(a.rag as Rag) - order.indexOf(b.rag as Rag) || b.penalty - a.penalty)

  const concerns = ranked.filter((f) => f.rag === 'red' || f.rag === 'amber')
  const healthy = ranked.filter((f) => f.rag === 'green')

  if (concerns.length) {
    sentences.push(`Key concern${concerns.length === 1 ? '' : 's'}: ${concerns.map((f) => f.detail).join(' ')}`)
  }
  if (healthy.length) {
    sentences.push(`Holding well on ${joinList(healthy.map((f) => f.label.toLowerCase()))}.`)
  }

  // A concrete, prioritised recommendation.
  const rec = recommend(concerns)
  if (rec) sentences.push(rec)
  else sentences.push('No corrective action needed; maintain current cadence.')

  return sentences.join(' ')
}

function recommend(concerns: HealthFactor[]): string | null {
  if (!concerns.length) return null
  const worst = concerns[0]
  switch (worst.key) {
    case 'schedule':
      return 'Recommended action: re-baseline or add resources to the critical path to recover schedule.'
    case 'cost':
      return 'Recommended action: review the budget burn rate and re-forecast cost to complete.'
    case 'risk':
      return 'Recommended action: escalate and accelerate mitigation of the open critical risk(s).'
    case 'execution':
      return 'Recommended action: triage overdue tasks and reassign or re-schedule blocked work.'
    default:
      return null
  }
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}
