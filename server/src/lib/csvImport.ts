// CSV task import — the "escape hatch" from Excel / MS Project. parseCsv is a
// small RFC-4180 reader (quoted fields, embedded commas/newlines, "" escapes,
// CRLF or LF). buildTaskImport maps a header row to task fields and validates
// every row so the UI can show a dry-run preview before anything is written.
// Pure (no DB) so it is unit-testable; the route resolves assignees + inserts.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  // Strip a leading UTF-8 BOM if present.
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else field += c
  }
  // Flush trailing field/row unless the input ended on a clean newline.
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  // Drop fully-empty rows (e.g. trailing blank lines).
  return rows.filter(r => r.some(cell => cell.trim() !== ''))
}

const STATUSES = ['todo', 'in_progress', 'review', 'blocked', 'done']
const PRIORITIES = ['low', 'medium', 'high', 'critical']

// Accept a few friendly header aliases people export from other tools.
const HEADER_ALIASES: Record<string, string> = {
  'name': 'name', 'task': 'name', 'task name': 'name', 'title': 'name', 'summary': 'name',
  'description': 'description', 'notes': 'description', 'details': 'description',
  'status': 'status', 'state': 'status',
  'priority': 'priority',
  'assignee': 'assignee', 'owner': 'assignee', 'assigned to': 'assignee', 'resource': 'assignee', 'resource name': 'assignee',
  'start_date': 'start_date', 'start date': 'start_date', 'start': 'start_date',
  'end_date': 'end_date', 'end date': 'end_date', 'due date': 'end_date', 'due': 'end_date', 'finish': 'end_date', 'finish date': 'end_date', 'end': 'end_date',
  'estimated_hours': 'estimated_hours', 'estimate': 'estimated_hours', 'est hours': 'estimated_hours', 'estimated hours': 'estimated_hours', 'hours': 'estimated_hours', 'work': 'estimated_hours',
  'story_points': 'story_points', 'story points': 'story_points', 'points': 'story_points', 'sp': 'story_points',
  'wbs_code': 'wbs_code', 'wbs': 'wbs_code', 'wbs code': 'wbs_code',
}

const FIELD_KEYS = ['name', 'description', 'status', 'priority', 'assignee', 'start_date', 'end_date', 'estimated_hours', 'story_points', 'wbs_code'] as const
type FieldKey = typeof FIELD_KEYS[number]

export interface ParsedTaskRow {
  row: number // 1-based data row number (header excluded)
  name: string
  description: string | null
  status: string
  priority: string
  assignee: string | null
  assignee_id: number | null
  start_date: string | null
  end_date: string | null
  estimated_hours: number
  story_points: number | null
  wbs_code: string | null
  errors: string[]
}

export interface ImportUser { id: number; name: string; email: string }

export interface TaskImportResult {
  headers: string[]
  mappedColumns: Record<string, string> // header -> field key
  unmappedHeaders: string[]
  rows: ParsedTaskRow[]
  validCount: number
  errorCount: number
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function parseDate(raw: string): { value: string | null; error: string | null } {
  const v = raw.trim()
  if (!v) return { value: null, error: null }
  if (!ISO_DATE.test(v) || isNaN(Date.parse(v))) return { value: null, error: `invalid date "${v}" (use YYYY-MM-DD)` }
  return { value: v, error: null }
}

/**
 * Parse + validate a CSV of tasks against the project's users. Never throws;
 * problems are reported per-row in `errors`. Rows with no errors are safe to
 * insert. The first non-empty line is treated as the header.
 */
export function buildTaskImport(csv: string, users: ImportUser[]): TaskImportResult {
  const table = parseCsv(csv)
  if (table.length === 0) {
    return { headers: [], mappedColumns: {}, unmappedHeaders: [], rows: [], validCount: 0, errorCount: 0 }
  }

  const headers = table[0].map(h => h.trim())
  const mappedColumns: Record<string, string> = {}
  const unmappedHeaders: string[] = []
  const colIndex: Partial<Record<FieldKey, number>> = {}

  headers.forEach((h, idx) => {
    const key = HEADER_ALIASES[h.toLowerCase().trim()]
    if (key) {
      mappedColumns[h] = key
      if (colIndex[key as FieldKey] === undefined) colIndex[key as FieldKey] = idx
    } else if (h) {
      unmappedHeaders.push(h)
    }
  })

  // Build case-insensitive assignee lookup by name and by email.
  const userByKey = new Map<string, number>()
  for (const u of users) {
    if (u.name) userByKey.set(u.name.toLowerCase().trim(), u.id)
    if (u.email) userByKey.set(u.email.toLowerCase().trim(), u.id)
  }

  const cell = (cols: string[], key: FieldKey): string => {
    const i = colIndex[key]
    return i === undefined || i >= cols.length ? '' : cols[i]
  }

  const rows: ParsedTaskRow[] = []
  for (let r = 1; r < table.length; r++) {
    const cols = table[r]
    const errors: string[] = []

    const name = cell(cols, 'name').trim()
    if (!name) errors.push('name is required')

    let status = cell(cols, 'status').trim().toLowerCase().replace(/[\s-]+/g, '_')
    if (!status) status = 'todo'
    else if (!STATUSES.includes(status)) { errors.push(`invalid status "${status}"`); status = 'todo' }

    let priority = cell(cols, 'priority').trim().toLowerCase()
    if (!priority) priority = 'medium'
    else if (!PRIORITIES.includes(priority)) { errors.push(`invalid priority "${priority}"`); priority = 'medium' }

    const assigneeRaw = cell(cols, 'assignee').trim()
    let assignee_id: number | null = null
    if (assigneeRaw) {
      const found = userByKey.get(assigneeRaw.toLowerCase())
      if (found === undefined) errors.push(`unknown assignee "${assigneeRaw}"`)
      else assignee_id = found
    }

    const start = parseDate(cell(cols, 'start_date'))
    if (start.error) errors.push(start.error)
    const end = parseDate(cell(cols, 'end_date'))
    if (end.error) errors.push(end.error)
    if (start.value && end.value && end.value < start.value) errors.push('end_date is before start_date')

    let estimated_hours = 0
    const hoursRaw = cell(cols, 'estimated_hours').trim()
    if (hoursRaw) {
      const n = Number(hoursRaw)
      if (isNaN(n) || n < 0) errors.push(`invalid estimated_hours "${hoursRaw}"`)
      else estimated_hours = n
    }

    let story_points: number | null = null
    const spRaw = cell(cols, 'story_points').trim()
    if (spRaw) {
      const n = Number(spRaw)
      if (isNaN(n) || n < 0 || !Number.isInteger(n)) errors.push(`invalid story_points "${spRaw}"`)
      else story_points = n
    }

    const descRaw = cell(cols, 'description').trim()
    const wbsRaw = cell(cols, 'wbs_code').trim()

    rows.push({
      row: r,
      name,
      description: descRaw || null,
      status,
      priority,
      assignee: assigneeRaw || null,
      assignee_id,
      start_date: start.value,
      end_date: end.value,
      estimated_hours,
      story_points,
      wbs_code: wbsRaw || null,
      errors,
    })
  }

  const errorCount = rows.filter(r => r.errors.length > 0).length
  return {
    headers,
    mappedColumns,
    unmappedHeaders,
    rows,
    validCount: rows.length - errorCount,
    errorCount,
  }
}

// ---------------------------------------------------------------------------
// Risk register import — same shape/contract as the task importer.
// ---------------------------------------------------------------------------

const RISK_LEVELS = ['low', 'medium', 'high', 'critical']
const RISK_STATUSES = ['open', 'mitigating', 'monitoring', 'closed', 'accepted']
const RISK_RESPONSES = ['avoid', 'mitigate', 'transfer', 'accept']
const LEVEL_SCORE: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }

const RISK_HEADER_ALIASES: Record<string, string> = {
  'title': 'title', 'risk': 'title', 'risk title': 'title', 'name': 'title', 'summary': 'title',
  'description': 'description', 'notes': 'description', 'details': 'description',
  'category': 'category', 'type': 'category',
  'probability': 'probability', 'likelihood': 'probability', 'prob': 'probability',
  'impact': 'impact', 'severity': 'impact', 'consequence': 'impact',
  'status': 'status', 'state': 'status',
  'response': 'response', 'strategy': 'response', 'response strategy': 'response',
  'mitigation_plan': 'mitigation_plan', 'mitigation': 'mitigation_plan', 'mitigation plan': 'mitigation_plan', 'plan': 'mitigation_plan',
  'owner': 'owner', 'owner_name': 'owner', 'assignee': 'owner', 'assigned to': 'owner', 'responsible': 'owner',
  'identified_date': 'identified_date', 'identified date': 'identified_date', 'identified': 'identified_date', 'date identified': 'identified_date',
  'target_date': 'target_date', 'target date': 'target_date', 'due date': 'target_date', 'due': 'target_date', 'resolution date': 'target_date',
}

const RISK_FIELD_KEYS = ['title', 'description', 'category', 'probability', 'impact', 'status', 'response', 'mitigation_plan', 'owner', 'identified_date', 'target_date'] as const
type RiskFieldKey = typeof RISK_FIELD_KEYS[number]

export interface ParsedRiskRow {
  row: number
  title: string
  description: string | null
  category: string
  probability: string
  impact: string
  score: number
  status: string
  response: string | null
  mitigation_plan: string | null
  owner: string | null
  owner_id: number | null
  identified_date: string | null
  target_date: string | null
  errors: string[]
}

export interface RiskImportResult {
  headers: string[]
  mappedColumns: Record<string, string>
  unmappedHeaders: string[]
  rows: ParsedRiskRow[]
  validCount: number
  errorCount: number
}

/**
 * Parse + validate a CSV of risks against the project's users. Never throws;
 * problems are reported per-row. Only `title` is required; probability/impact
 * default to medium and the score is derived from them.
 */
export function buildRiskImport(csv: string, users: ImportUser[]): RiskImportResult {
  const table = parseCsv(csv)
  if (table.length === 0) {
    return { headers: [], mappedColumns: {}, unmappedHeaders: [], rows: [], validCount: 0, errorCount: 0 }
  }

  const headers = table[0].map(h => h.trim())
  const mappedColumns: Record<string, string> = {}
  const unmappedHeaders: string[] = []
  const colIndex: Partial<Record<RiskFieldKey, number>> = {}

  headers.forEach((h, idx) => {
    const key = RISK_HEADER_ALIASES[h.toLowerCase().trim()]
    if (key) {
      mappedColumns[h] = key
      if (colIndex[key as RiskFieldKey] === undefined) colIndex[key as RiskFieldKey] = idx
    } else if (h) {
      unmappedHeaders.push(h)
    }
  })

  const userByKey = new Map<string, number>()
  for (const u of users) {
    if (u.name) userByKey.set(u.name.toLowerCase().trim(), u.id)
    if (u.email) userByKey.set(u.email.toLowerCase().trim(), u.id)
  }

  const cell = (cols: string[], key: RiskFieldKey): string => {
    const i = colIndex[key]
    return i === undefined || i >= cols.length ? '' : cols[i]
  }

  const rows: ParsedRiskRow[] = []
  for (let r = 1; r < table.length; r++) {
    const cols = table[r]
    const errors: string[] = []

    const title = cell(cols, 'title').trim()
    if (!title) errors.push('title is required')

    let probability = cell(cols, 'probability').trim().toLowerCase()
    if (!probability) probability = 'medium'
    else if (!RISK_LEVELS.includes(probability)) { errors.push(`invalid probability "${probability}"`); probability = 'medium' }

    let impact = cell(cols, 'impact').trim().toLowerCase()
    if (!impact) impact = 'medium'
    else if (!RISK_LEVELS.includes(impact)) { errors.push(`invalid impact "${impact}"`); impact = 'medium' }

    let status = cell(cols, 'status').trim().toLowerCase().replace(/[\s-]+/g, '_')
    if (!status) status = 'open'
    else if (!RISK_STATUSES.includes(status)) { errors.push(`invalid status "${status}"`); status = 'open' }

    let response: string | null = cell(cols, 'response').trim().toLowerCase() || null
    if (response && !RISK_RESPONSES.includes(response)) { errors.push(`invalid response "${response}"`); response = null }

    const ownerRaw = cell(cols, 'owner').trim()
    let owner_id: number | null = null
    if (ownerRaw) {
      const found = userByKey.get(ownerRaw.toLowerCase())
      if (found === undefined) errors.push(`unknown owner "${ownerRaw}"`)
      else owner_id = found
    }

    const identified = parseDate(cell(cols, 'identified_date'))
    if (identified.error) errors.push(identified.error)
    const target = parseDate(cell(cols, 'target_date'))
    if (target.error) errors.push(target.error)

    const categoryRaw = cell(cols, 'category').trim().toLowerCase()
    const descRaw = cell(cols, 'description').trim()
    const mitRaw = cell(cols, 'mitigation_plan').trim()

    rows.push({
      row: r,
      title,
      description: descRaw || null,
      category: categoryRaw || 'general',
      probability,
      impact,
      score: LEVEL_SCORE[probability] * LEVEL_SCORE[impact],
      status,
      response,
      mitigation_plan: mitRaw || null,
      owner: ownerRaw || null,
      owner_id,
      identified_date: identified.value,
      target_date: target.value,
      errors,
    })
  }

  const errorCount = rows.filter(r => r.errors.length > 0).length
  return {
    headers,
    mappedColumns,
    unmappedHeaders,
    rows,
    validCount: rows.length - errorCount,
    errorCount,
  }
}

// CSV templates offered as downloads from the import dialogs.
export const TASK_IMPORT_TEMPLATE = `name,description,assignee,status,priority,start_date,end_date,estimated_hours,story_points,wbs_code
Kickoff workshop,Align stakeholders on goals,john.manager@demo.com,todo,high,2026-07-01,2026-07-02,8,3,1.0
Draft requirements,Capture functional requirements,Alex Rivera,in_progress,medium,2026-07-03,2026-07-10,24,5,2.0
Vendor evaluation,,,todo,low,2026-07-05,2026-07-20,16,,3.0
`

export const RISK_IMPORT_TEMPLATE = `title,description,category,probability,impact,status,response,mitigation_plan,owner,identified_date,target_date
Vendor delivery delay,Key vendor may miss the integration deadline,schedule,high,high,open,mitigate,Add a second supplier and weekly checkpoints,john.manager@demo.com,2026-07-01,2026-09-30
Budget overrun,Cloud costs trending above plan,budget,medium,high,mitigating,accept,Enable cost alerts and right-size instances,Alex Rivera,2026-07-05,2026-10-31
Scope creep,Stakeholders adding features mid-sprint,scope,high,medium,open,avoid,Enforce change control,,2026-07-10,
`

