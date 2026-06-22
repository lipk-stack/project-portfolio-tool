import { describe, it, expect } from 'vitest'
import {
  parseJiraBaseUrl,
  priorityFromJira,
  statusFromJira,
  adfToText,
  jiraIssuesToCsv,
  countImportableJira,
  JiraIssue,
} from './jiraImport'
import { buildTaskImport, ImportUser } from './csvImport'

describe('parseJiraBaseUrl', () => {
  it('normalises host-only, scheme-less and trailing-slash forms', () => {
    expect(parseJiraBaseUrl('acme.atlassian.net')).toBe('https://acme.atlassian.net')
    expect(parseJiraBaseUrl('https://acme.atlassian.net/')).toBe('https://acme.atlassian.net')
    expect(parseJiraBaseUrl('https://jira.acme.com/jira/')).toBe('https://jira.acme.com/jira')
    expect(parseJiraBaseUrl('http://localhost:4599')).toBe('http://localhost:4599')
  })
  it('rejects junk', () => {
    expect(parseJiraBaseUrl('')).toBeNull()
    expect(parseJiraBaseUrl('   ')).toBeNull()
    expect(parseJiraBaseUrl('not a url')).toBeNull()
    expect(parseJiraBaseUrl('nodot')).toBeNull()
    // @ts-expect-error guarding non-string input
    expect(parseJiraBaseUrl(null)).toBeNull()
  })
})

describe('priorityFromJira', () => {
  it('maps the default Jira priority scheme and common variants', () => {
    expect(priorityFromJira('Highest')).toBe('critical')
    expect(priorityFromJira('Blocker')).toBe('critical')
    expect(priorityFromJira('High')).toBe('high')
    expect(priorityFromJira('Medium')).toBe('medium')
    expect(priorityFromJira('Low')).toBe('low')
    expect(priorityFromJira('Lowest')).toBe('low')
    expect(priorityFromJira(undefined)).toBe('medium')
    expect(priorityFromJira('')).toBe('medium')
  })
})

describe('statusFromJira', () => {
  it('prefers the language-independent statusCategory key', () => {
    expect(statusFromJira({ fields: { status: { statusCategory: { key: 'done' } } } })).toBe('done')
    expect(statusFromJira({ fields: { status: { statusCategory: { key: 'indeterminate' } } } })).toBe('in_progress')
    expect(statusFromJira({ fields: { status: { statusCategory: { key: 'new' } } } })).toBe('todo')
  })
  it('falls back to the status name, then todo', () => {
    expect(statusFromJira({ fields: { status: { name: 'Resolved' } } })).toBe('done')
    expect(statusFromJira({ fields: { status: { name: 'In Review' } } })).toBe('in_progress')
    expect(statusFromJira({})).toBe('todo')
  })
})

describe('adfToText', () => {
  it('flattens an ADF document tree to plain text with block breaks', () => {
    const adf = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First line.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second ' }, { type: 'text', text: 'line.' }] },
      ],
    }
    const out = adfToText(adf)
    expect(out).toContain('First line.')
    expect(out).toContain('Second line.')
    expect(out).toBe('First line.\n\nSecond line.')
  })
  it('passes plain strings through and tolerates junk', () => {
    expect(adfToText('hello world')).toBe('hello world')
    expect(adfToText(null)).toBe('')
    expect(adfToText(undefined)).toBe('')
    expect(adfToText(42 as unknown)).toBe('')
  })
})

describe('jiraIssuesToCsv', () => {
  const users: ImportUser[] = [{ id: 7, name: 'Alex Rivera', email: 'alex.dev@demo.com' }]
  const issues: JiraIssue[] = [
    {
      key: 'PROJ-1',
      fields: {
        summary: 'Fix login bug',
        description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Steps to repro' }] }] },
        duedate: '2026-08-01',
        status: { name: 'To Do', statusCategory: { key: 'new' } },
        priority: { name: 'High' },
        assignee: { emailAddress: 'alex.dev@demo.com', displayName: 'Alex Rivera' },
      },
    },
    {
      key: 'PROJ-2',
      fields: {
        summary: 'Ship release',
        description: 'plain text body',
        status: { statusCategory: { key: 'done' } },
        priority: { name: 'Lowest' },
        assignee: null,
      },
    },
    { key: 'PROJ-3', fields: { summary: '' } }, // skipped (no summary)
    { key: 'PROJ-4', fields: { summary: 'Comma, and "quotes"\nand newline', status: { statusCategory: { key: 'new' } } } },
  ]

  it('skips untitled issues and counts the importable ones', () => {
    expect(countImportableJira(issues)).toBe(3)
    const csv = jiraIssuesToCsv(issues, { browseBase: 'https://acme.atlassian.net' })
    const result = buildTaskImport(csv, users)
    expect(result.rows).toHaveLength(3)
    expect(result.errorCount).toBe(0)
    expect(result.validCount).toBe(3)
  })

  it('maps fields and resolves the assignee email to a local user', () => {
    const csv = jiraIssuesToCsv(issues, { browseBase: 'https://acme.atlassian.net' })
    const result = buildTaskImport(csv, users)
    const first = result.rows.find(r => r.name === 'Fix login bug')!
    expect(first.status).toBe('todo')
    expect(first.priority).toBe('high')
    expect(first.wbs_code).toBe('PROJ-1')
    expect(first.end_date).toBe('2026-08-01')
    expect(first.assignee_id).toBe(7) // resolved from email
    expect(first.description).toContain('Steps to repro')
    expect(first.description).toContain('Jira assignee: Alex Rivera')
    expect(first.description).toContain('Jira PROJ-1: https://acme.atlassian.net/browse/PROJ-1')

    const done = result.rows.find(r => r.name === 'Ship release')!
    expect(done.status).toBe('done')
    expect(done.priority).toBe('low')
    expect(done.description).toContain('plain text body')
  })

  it('CSV-escapes commas, quotes and newlines so embedded content survives', () => {
    const csv = jiraIssuesToCsv(issues)
    const result = buildTaskImport(csv, users)
    const tricky = result.rows.find(r => r.name.startsWith('Comma,'))!
    expect(tricky.name).toBe('Comma, and "quotes"\nand newline')
    expect(tricky.errors).toHaveLength(0)
  })

  it('truncates long bodies', () => {
    const long = 'x'.repeat(5000)
    const csv = jiraIssuesToCsv([{ key: 'PROJ-9', fields: { summary: 'Big', description: long } }], { bodyLimit: 100 })
    const result = buildTaskImport(csv, [])
    expect(result.rows[0].description!.length).toBeLessThan(300)
    expect(result.rows[0].description).toContain('…')
  })

  it('returns a header-only CSV for empty/invalid input', () => {
    expect(jiraIssuesToCsv([]).trim()).toBe('name,description,status,priority,assignee,end_date,wbs_code')
    // @ts-expect-error guarding non-array input
    expect(jiraIssuesToCsv(null).trim()).toBe('name,description,status,priority,assignee,end_date,wbs_code')
  })
})
