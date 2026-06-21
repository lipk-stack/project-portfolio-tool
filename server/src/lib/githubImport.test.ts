import { describe, it, expect } from 'vitest'
import {
  parseGithubRepo,
  priorityFromLabels,
  statusFromIssue,
  githubIssuesToCsv,
  countImportableIssues,
  GithubIssue,
} from './githubImport'
import { buildTaskImport } from './csvImport'

describe('parseGithubRepo', () => {
  it('accepts owner/repo shorthand', () => {
    expect(parseGithubRepo('facebook/react')).toEqual({ owner: 'facebook', repo: 'react' })
  })
  it('accepts full https URLs and strips trailing paths/.git', () => {
    expect(parseGithubRepo('https://github.com/lipk-stack/project-portfolio-tool')).toEqual({ owner: 'lipk-stack', repo: 'project-portfolio-tool' })
    expect(parseGithubRepo('github.com/a/b/issues')).toEqual({ owner: 'a', repo: 'b' })
    expect(parseGithubRepo('https://github.com/a/b.git')).toEqual({ owner: 'a', repo: 'b' })
    expect(parseGithubRepo('git@github.com:a/b.git')).toEqual({ owner: 'a', repo: 'b' })
  })
  it('rejects junk and incomplete refs', () => {
    expect(parseGithubRepo('')).toBeNull()
    expect(parseGithubRepo('   ')).toBeNull()
    expect(parseGithubRepo('justone')).toBeNull()
    expect(parseGithubRepo('bad owner/repo')).toBeNull()
    // @ts-expect-error guarding non-string input
    expect(parseGithubRepo(null)).toBeNull()
  })
})

describe('priorityFromLabels', () => {
  it('maps known label conventions', () => {
    expect(priorityFromLabels(['bug', 'critical'])).toBe('critical')
    expect(priorityFromLabels(['priority: high'])).toBe('high')
    expect(priorityFromLabels(['p1'])).toBe('critical')
    expect(priorityFromLabels(['low'])).toBe('low')
    expect(priorityFromLabels(['enhancement'])).toBe('medium')
    expect(priorityFromLabels([])).toBe('medium')
  })
})

describe('statusFromIssue', () => {
  it('closed -> done, open -> todo', () => {
    expect(statusFromIssue({ state: 'closed' })).toBe('done')
    expect(statusFromIssue({ state: 'open' })).toBe('todo')
    expect(statusFromIssue({})).toBe('todo')
  })
})

describe('githubIssuesToCsv', () => {
  const issues: GithubIssue[] = [
    { number: 1, title: 'Fix login bug', body: 'Steps to repro', state: 'open', html_url: 'https://github.com/a/b/issues/1', labels: [{ name: 'high' }], assignee: { login: 'octocat' } },
    { number: 2, title: 'Closed work', body: null, state: 'closed', labels: ['low'] },
    { number: 3, title: 'A pull request', pull_request: { url: 'x' }, state: 'open' }, // skipped
    { number: 4, title: '', state: 'open' }, // skipped (no title)
    { number: 5, title: 'Comma, and "quotes"\nand newline', state: 'open' },
  ]

  it('skips PRs and untitled issues', () => {
    expect(countImportableIssues(issues)).toBe(3)
    const csv = githubIssuesToCsv(issues)
    const result = buildTaskImport(csv, [])
    expect(result.rows).toHaveLength(3)
    expect(result.errorCount).toBe(0)
    expect(result.validCount).toBe(3)
  })

  it('round-trips through the CSV importer with correct field mapping', () => {
    const csv = githubIssuesToCsv(issues)
    const result = buildTaskImport(csv, [])
    const first = result.rows.find(r => r.name === 'Fix login bug')!
    expect(first.status).toBe('todo')
    expect(first.priority).toBe('high')
    expect(first.wbs_code).toBe('GH-1')
    expect(first.description).toContain('Steps to repro')
    expect(first.description).toContain('GitHub assignee(s): octocat')
    expect(first.description).toContain('GitHub #1: https://github.com/a/b/issues/1')

    const closed = result.rows.find(r => r.name === 'Closed work')!
    expect(closed.status).toBe('done')
    expect(closed.priority).toBe('low')
  })

  it('CSV-escapes commas, quotes and newlines so embedded content survives', () => {
    const csv = githubIssuesToCsv(issues)
    const result = buildTaskImport(csv, [])
    const tricky = result.rows.find(r => r.name.startsWith('Comma,'))!
    expect(tricky.name).toBe('Comma, and "quotes"\nand newline')
    expect(tricky.errors).toHaveLength(0)
  })

  it('truncates long bodies', () => {
    const long = 'x'.repeat(5000)
    const csv = githubIssuesToCsv([{ number: 9, title: 'Big', body: long, state: 'open' }], { bodyLimit: 100 })
    const result = buildTaskImport(csv, [])
    expect(result.rows[0].description!.length).toBeLessThan(300)
    expect(result.rows[0].description).toContain('…')
  })

  it('returns a header-only CSV for empty/invalid input', () => {
    expect(githubIssuesToCsv([]).trim()).toBe('name,description,status,priority,wbs_code')
    // @ts-expect-error guarding non-array input
    expect(githubIssuesToCsv(null).trim()).toBe('name,description,status,priority,wbs_code')
  })
})
