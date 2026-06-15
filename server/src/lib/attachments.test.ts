import { describe, it, expect } from 'vitest'
import { sanitizeFilename, decodeAndValidate, storageName, MAX_ATTACHMENT_BYTES } from './attachments'

describe('sanitizeFilename', () => {
  it('strips directory traversal and path separators', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd')
    expect(sanitizeFilename('C:\\Users\\me\\report.pdf')).toBe('report.pdf')
    expect(sanitizeFilename('/abs/path/spec.docx')).toBe('spec.docx')
  })

  it('removes leading dots and control characters', () => {
    expect(sanitizeFilename('...hidden')).toBe('hidden')
    expect(sanitizeFilename('na\x00me.txt')).toBe('name.txt')
  })

  it('keeps a friendly whitelist and replaces the rest', () => {
    expect(sanitizeFilename('Q3 Report (final).xlsx')).toBe('Q3 Report (final).xlsx')
    expect(sanitizeFilename('weird*name?.png')).toBe('weird_name_.png')
  })

  it('falls back to "file" when nothing usable remains', () => {
    expect(sanitizeFilename('')).toBe('file')
    expect(sanitizeFilename('///')).toBe('file')
    expect(sanitizeFilename('....')).toBe('file')
  })

  it('truncates very long names', () => {
    expect(sanitizeFilename('a'.repeat(300)).length).toBe(120)
  })
})

describe('decodeAndValidate', () => {
  const b64 = (s: string) => Buffer.from(s).toString('base64')

  it('decodes a plain base64 payload', () => {
    const r = decodeAndValidate({ filename: 'hello.txt', mime: 'text/plain', data: b64('hello world') })
    expect(r.ok).toBe(true)
    expect(r.buffer?.toString()).toBe('hello world')
    expect(r.size).toBe(11)
    expect(r.safeName).toBe('hello.txt')
    expect(r.mime).toBe('text/plain')
  })

  it('accepts a data URL and infers the mime when not given', () => {
    const r = decodeAndValidate({ filename: 'a.png', data: `data:image/png;base64,${b64('x')}` })
    expect(r.ok).toBe(true)
    expect(r.mime).toBe('image/png')
    expect(r.buffer?.toString()).toBe('x')
  })

  it('defaults mime to octet-stream', () => {
    const r = decodeAndValidate({ filename: 'f.bin', data: b64('data') })
    expect(r.mime).toBe('application/octet-stream')
  })

  it('requires a filename', () => {
    expect(decodeAndValidate({ data: b64('x') }).error).toMatch(/filename/)
  })

  it('rejects empty data', () => {
    expect(decodeAndValidate({ filename: 'a', data: '' }).error).toMatch(/empty/)
  })

  it('rejects non-base64 garbage', () => {
    expect(decodeAndValidate({ filename: 'a', data: 'not base64 !!!' }).error).toMatch(/base64/)
  })

  it('rejects files over the size limit', () => {
    // Build a base64 string whose decoded length exceeds the cap.
    const big = 'A'.repeat(Math.ceil((MAX_ATTACHMENT_BYTES + 1024) / 3) * 4)
    const r = decodeAndValidate({ filename: 'big.bin', data: big })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/limit/)
  })
})

describe('storageName', () => {
  it('prefixes with the id to guarantee uniqueness', () => {
    expect(storageName(42, 'report.pdf')).toBe('42__report.pdf')
  })
})
