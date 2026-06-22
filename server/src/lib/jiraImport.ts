// Inbound Jira issue import — the sibling of lib/githubImport.ts and the second
// connector built on the shared CSV task-import contract (lib/csvImport.ts). The
// route fetches issues from the Jira REST API; `jiraIssuesToCsv` turns them into
// a CSV string; the same buildTaskImport + dry-run + insert pipeline does the
// rest. Pure (no network, no DB) so it is fully unit-testable.
//
// Unlike GitHub logins, a Jira assignee carries an emailAddress that usually
// DOES match a local user — so it is written to the assignee column (the
// importer resolves it to a real user id). Display name (and any unmatched
// email) still survives in the description. Jira `key` (e.g. PROJ-123) becomes
// the wbs_code for traceability and dedupe-on-reimport.

// The subset of the Jira issue payload we rely on. Everything is optional so
// partial/forged payloads can't throw. `description` is either Atlassian
// Document Format (ADF, a JSON tree — REST v3) or a plain string (REST v2).
export interface JiraIssue {
  key?: string
  fields?: {
    summary?: string
    description?: unknown
    duedate?: string | null
    status?: { name?: string; statusCategory?: { key?: string; name?: string } } | null
    priority?: { name?: string } | null
    assignee?: { emailAddress?: string; displayName?: string } | null
    issuetype?: { name?: string } | null
  } | null
}

// Normalise a user-supplied Jira base URL to a clean origin (+ optional context
// path for Jira Server). Accepts "acme.atlassian.net", with or without scheme,
// and strips trailing slashes. Returns null (never throws) for junk so the route
// can answer 400 with a friendly message.
export function parseJiraBaseUrl(input: string): string | null {
  if (typeof input !== 'string') return null
  let s = input.trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  let url: URL
  try {
    url = new URL(s)
  } catch {
    return null
  }
  // Require a dotted host (e.g. acme.atlassian.net) or localhost; reject bare
  // single-word junk like "nodot".
  if (!url.hostname || (!url.hostname.includes('.') && url.hostname !== 'localhost')) return null
  // Keep scheme://host[:port] + any context path, drop trailing slash + query/frag.
  const path = url.pathname.replace(/\/+$/, '')
  return `${url.protocol}//${url.host}${path}`
}

// Best-effort Jira priority name -> task priority. Recognises the default Jira
// scheme (Highest/High/Medium/Low/Lowest) plus Blocker/Critical/Trivial/Minor
// and P0–P4. Falls back to medium so every row stays valid for the importer.
export function priorityFromJira(name: string | undefined | null): string {
  const n = (name || '').toLowerCase().trim()
  if (!n) return 'medium'
  if (/\b(highest|blocker|critical|urgent|p0|p1)\b/.test(n)) return 'critical'
  if (/\b(high|major|p2)\b/.test(n)) return 'high'
  if (/\b(low|lowest|trivial|minor|p4)\b/.test(n)) return 'low'
  return 'medium'
}

// Jira status -> task status. Prefer the language-independent statusCategory key
// ("new" -> todo, "indeterminate" -> in_progress, "done" -> done); fall back to a
// few common status names. Defaults to todo.
export function statusFromJira(issue: JiraIssue): string {
  const cat = (issue.fields?.status?.statusCategory?.key || '').toLowerCase()
  if (cat === 'done') return 'done'
  if (cat === 'indeterminate') return 'in_progress'
  if (cat === 'new') return 'todo'
  const name = (issue.fields?.status?.name || '').toLowerCase()
  if (/\b(done|closed|resolved|complete)\b/.test(name)) return 'done'
  if (/\b(in progress|in review|review|doing)\b/.test(name)) return 'in_progress'
  if (/\bblocked\b/.test(name)) return 'blocked'
  return 'todo'
}

// Flatten an Atlassian Document Format (ADF) description to plain text. ADF is a
// nested {type, content:[…], text} tree; we collect text nodes and insert line
// breaks at block boundaries. A plain string (REST v2) is returned as-is. Never
// throws on malformed input.
export function adfToText(doc: unknown): string {
  if (doc == null) return ''
  if (typeof doc === 'string') return doc.trim()
  const BLOCK = new Set(['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock', 'rule'])
  const parts: string[] = []
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    const n = node as { type?: string; text?: string; content?: unknown[] }
    if (typeof n.text === 'string') parts.push(n.text)
    if (n.type === 'hardBreak') parts.push('\n')
    if (Array.isArray(n.content)) {
      n.content.forEach(walk)
      if (n.type && BLOCK.has(n.type)) parts.push('\n\n')
    }
  }
  walk(doc)
  return parts.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return '"' + value.replace(/"/g, '""') + '"'
  return value
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/
const BODY_LIMIT = 2000

export interface IssuesToCsvOptions {
  bodyLimit?: number
  browseBase?: string // base URL, used to build a "Jira KEY: <base>/browse/KEY" link
}

/**
 * Convert a list of Jira issues into a task-import CSV. Issues without a summary
 * are skipped (the importer would reject a nameless row anyway). The assignee's
 * email goes in the assignee column (it usually matches a local user); the
 * display name and the issue link are appended to the description. The Jira key
 * becomes the wbs_code. Jira `duedate` maps to end_date. Returns a header-only
 * CSV when nothing maps.
 */
export function jiraIssuesToCsv(issues: JiraIssue[], opts: IssuesToCsvOptions = {}): string {
  const limit = opts.bodyLimit ?? BODY_LIMIT
  const base = (opts.browseBase || '').replace(/\/+$/, '')
  const header = 'name,description,status,priority,assignee,end_date,wbs_code'
  const lines: string[] = [header]

  for (const issue of Array.isArray(issues) ? issues : []) {
    const f = issue.fields || {}
    const title = (f.summary || '').trim()
    if (!title) continue

    const bodyParts: string[] = []
    const rawBody = adfToText(f.description)
    if (rawBody) bodyParts.push(rawBody.length > limit ? rawBody.slice(0, limit) + '…' : rawBody)

    const email = (f.assignee?.emailAddress || '').trim()
    const displayName = (f.assignee?.displayName || '').trim()
    // Surface the human name in the description; if we have no email to resolve,
    // the name at least records who Jira had assigned.
    if (displayName) bodyParts.push(`Jira assignee: ${displayName}${email ? ` <${email}>` : ''}`)

    if (issue.key) {
      bodyParts.push(base ? `Jira ${issue.key}: ${base}/browse/${issue.key}` : `Jira ${issue.key}`)
    }
    const description = bodyParts.join('\n\n')

    const due = (f.duedate || '').trim()
    const endDate = ISO_DATE.test(due) ? due.slice(0, 10) : ''

    lines.push([
      csvEscape(title),
      csvEscape(description),
      statusFromJira(issue),
      priorityFromJira(f.priority?.name),
      csvEscape(email),
      csvEscape(endDate),
      csvEscape(issue.key || ''),
    ].join(','))
  }

  return lines.join('\n') + '\n'
}

// Number of mappable (titled) issues in a payload — lets the route report a
// useful "N fetched, M importable" message.
export function countImportableJira(issues: JiraIssue[]): number {
  if (!Array.isArray(issues)) return 0
  return issues.filter(i => (i.fields?.summary || '').trim()).length
}
