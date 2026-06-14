import { describe, it, expect } from 'vitest'
import { parseCsv, buildTaskImport } from './csvImport'

describe('parseCsv', () => {
  it('parses a simple table', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })

  it('handles quoted fields with commas and escaped quotes', () => {
    const out = parseCsv('name,note\n"Smith, John","He said ""hi"""')
    expect(out).toEqual([['name', 'note'], ['Smith, John', 'He said "hi"']])
  })

  it('handles embedded newlines inside quotes and CRLF line endings', () => {
    const out = parseCsv('a,b\r\n"line1\nline2",x\r\n')
    expect(out).toEqual([['a', 'b'], ['line1\nline2', 'x']])
  })

  it('drops fully blank lines and strips a BOM', () => {
    const out = parseCsv('﻿a,b\n\n1,2\n')
    expect(out).toEqual([['a', 'b'], ['1', '2']])
  })
})

const users = [
  { id: 1, name: 'Alex Rivera', email: 'alex.dev@demo.com' },
  { id: 2, name: 'Emma Wilson', email: 'emma.design@demo.com' },
]

describe('buildTaskImport', () => {
  it('maps headers (incl. aliases) and validates a clean row', () => {
    const csv = 'Task Name,Owner,Due Date,Priority,Est Hours\nBuild login,alex.dev@demo.com,2026-03-01,high,12'
    const res = buildTaskImport(csv, users)
    expect(res.mappedColumns).toEqual({ 'Task Name': 'name', 'Owner': 'assignee', 'Due Date': 'end_date', 'Priority': 'priority', 'Est Hours': 'estimated_hours' })
    expect(res.errorCount).toBe(0)
    expect(res.validCount).toBe(1)
    const row = res.rows[0]
    expect(row.name).toBe('Build login')
    expect(row.assignee_id).toBe(1)
    expect(row.end_date).toBe('2026-03-01')
    expect(row.priority).toBe('high')
    expect(row.estimated_hours).toBe(12)
    expect(row.status).toBe('todo') // defaulted
  })

  it('resolves assignee by display name, case-insensitively', () => {
    const res = buildTaskImport('name,assignee\nX,emma wilson', users)
    expect(res.rows[0].assignee_id).toBe(2)
    expect(res.rows[0].errors).toEqual([])
  })

  it('flags missing name, bad enums, unknown assignee and bad dates', () => {
    const csv = [
      'name,status,priority,assignee,start_date,end_date,estimated_hours,story_points',
      ',doing,urgent,Nobody,2026-13-01,2026-01-01,-5,2.5',
    ].join('\n')
    const res = buildTaskImport(csv, users)
    const row = res.rows[0]
    expect(row.errors).toEqual(expect.arrayContaining([
      'name is required',
      expect.stringContaining('invalid status'),
      expect.stringContaining('invalid priority'),
      expect.stringContaining('unknown assignee'),
      expect.stringContaining('invalid date'),
      expect.stringContaining('invalid estimated_hours'),
      expect.stringContaining('invalid story_points'),
    ]))
    expect(res.errorCount).toBe(1)
    expect(res.validCount).toBe(0)
  })

  it('flags end before start', () => {
    const res = buildTaskImport('name,start_date,end_date\nX,2026-05-01,2026-04-01', users)
    expect(res.rows[0].errors).toContain('end_date is before start_date')
  })

  it('normalizes "In Progress" style status with spaces', () => {
    const res = buildTaskImport('name,status\nX,In Progress', users)
    expect(res.rows[0].status).toBe('in_progress')
    expect(res.rows[0].errors).toEqual([])
  })

  it('reports unmapped headers and handles an empty file', () => {
    const res = buildTaskImport('name,foobar\nX,1', users)
    expect(res.unmappedHeaders).toContain('foobar')
    expect(buildTaskImport('', users).rows).toEqual([])
  })
})
