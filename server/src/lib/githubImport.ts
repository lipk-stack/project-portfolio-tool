// Inbound GitHub issue import. The biggest remaining parity gap vs. Jira/MS
// Project was pulling work *in* from where engineers actually file it. Rather
// than invent a second insertion path, this module maps GitHub issues onto the
// existing CSV task-import contract (lib/csvImport.ts): the route fetches issues
// over the GitHub REST API, `githubIssuesToCsv` turns them into a CSV string,
// and the same buildTaskImport + dry-run + insert pipeline does the rest. Pure
// (no network, no DB) so it is fully unit-testable; the HTTP fetch lives in the
// route.

// The subset of the GitHub issue payload we rely on. Everything is optional so
// partial/forged payloads can't throw.
export interface GithubIssue {
  number?: number
  title?: string
  body?: string | null
  state?: string
  html_url?: string
  labels?: Array<{ name?: string } | string>
  assignee?: { login?: string } | null
  assignees?: Array<{ login?: string }> | null
  pull_request?: unknown // present only on PRs — the /issues endpoint returns both
}

export interface RepoRef { owner: string; repo: string }

// Accept "owner/repo", a full github.com URL, or a "git@github.com:owner/repo"
// SSH ref. Returns null (never throws) when it isn't a plausible repo ref so the
// route can answer 400 with a friendly message.
export function parseGithubRepo(input: string): RepoRef | null {
  if (typeof input !== 'string') return null
  let s = input.trim()
  if (!s) return null
  // Strip scheme + host for the common URL forms.
  s = s.replace(/^https?:\/\//i, '').replace(/^git@github\.com:/i, '').replace(/^github\.com\//i, '')
  // Drop anything after the repo segment (/issues, /pull/3, ?q=…, #frag) and a
  // trailing .git or slash.
  s = s.replace(/\.git$/i, '').replace(/[?#].*$/, '')
  const parts = s.split('/').filter(Boolean)
  if (parts.length < 2) return null
  const owner = parts[0]
  const repo = parts[1]
  const ok = /^[A-Za-z0-9._-]+$/
  if (!ok.test(owner) || !ok.test(repo)) return null
  return { owner, repo }
}

function labelNames(issue: GithubIssue): string[] {
  if (!Array.isArray(issue.labels)) return []
  return issue.labels
    .map(l => (typeof l === 'string' ? l : l?.name) || '')
    .filter(Boolean)
    .map(n => n.toLowerCase())
}

// Best-effort priority from issue labels. Recognises bare ("high") and prefixed
// ("priority: high", "p1") conventions. Falls back to medium so every row stays
// valid for the importer.
export function priorityFromLabels(labels: string[]): string {
  const joined = labels.join(' ')
  if (/\b(critical|urgent|blocker|p0|p1)\b/.test(joined)) return 'critical'
  if (/\bhigh\b|\bp2\b/.test(joined)) return 'high'
  if (/\blow\b|\bp4\b|\btrivial\b|\bminor\b/.test(joined)) return 'low'
  if (/\bmedium\b|\bp3\b|\bnormal\b/.test(joined)) return 'medium'
  return 'medium'
}

// GitHub issue state -> task status. Closed issues land as done; everything open
// starts in the backlog.
export function statusFromIssue(issue: GithubIssue): string {
  return (issue.state || '').toLowerCase() === 'closed' ? 'done' : 'todo'
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return '"' + value.replace(/"/g, '""') + '"'
  return value
}

const BODY_LIMIT = 2000

export interface IssuesToCsvOptions {
  bodyLimit?: number
}

/**
 * Convert a list of GitHub issues into a task-import CSV. Pull requests (which
 * the /issues endpoint includes) are skipped. GitHub logins are NOT written to
 * the assignee column — they almost never match a local user by name/email and
 * would flag every assigned issue as an error — they are surfaced in the
 * description instead, keeping rows valid. Issue number + URL are appended for
 * traceability. Returns a header-only CSV when nothing maps.
 */
export function githubIssuesToCsv(issues: GithubIssue[], opts: IssuesToCsvOptions = {}): string {
  const limit = opts.bodyLimit ?? BODY_LIMIT
  const header = 'name,description,status,priority,wbs_code'
  const lines: string[] = [header]

  for (const issue of Array.isArray(issues) ? issues : []) {
    if (issue.pull_request) continue // skip PRs
    const title = (issue.title || '').trim()
    if (!title) continue // the importer would reject a nameless row anyway

    const logins = [
      issue.assignee?.login,
      ...(Array.isArray(issue.assignees) ? issue.assignees.map(a => a?.login) : []),
    ].filter((v, i, a): v is string => !!v && a.indexOf(v) === i)

    const bodyParts: string[] = []
    const rawBody = (issue.body || '').trim()
    if (rawBody) bodyParts.push(rawBody.length > limit ? rawBody.slice(0, limit) + '…' : rawBody)
    if (logins.length) bodyParts.push(`GitHub assignee(s): ${logins.join(', ')}`)
    if (issue.number != null) {
      const ref = issue.html_url ? `GitHub #${issue.number}: ${issue.html_url}` : `GitHub #${issue.number}`
      bodyParts.push(ref)
    }
    const description = bodyParts.join('\n\n')

    const wbs = issue.number != null ? `GH-${issue.number}` : ''

    lines.push([
      csvEscape(title),
      csvEscape(description),
      statusFromIssue(issue),
      priorityFromLabels(labelNames(issue)),
      csvEscape(wbs),
    ].join(','))
  }

  return lines.join('\n') + '\n'
}

// Number of mappable (non-PR, titled) issues in a payload — lets the route give
// a useful message when a repo has only pull requests.
export function countImportableIssues(issues: GithubIssue[]): number {
  if (!Array.isArray(issues)) return 0
  return issues.filter(i => !i.pull_request && (i.title || '').trim()).length
}
