// File-attachment helpers. Uploads come in as base64 (JSON body) so the whole
// app stays a single self-contained Node process with no multipart dependency.
// This module is pure (no DB / no fs) so it is unit-testable; the route writes
// the decoded buffer to disk and records a row.

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 // 10 MB decoded

// Strip directory components and anything that could escape the uploads dir or
// confuse the filesystem; collapse to a safe, reasonably short basename.
export function sanitizeFilename(name: string): string {
  const base = String(name || '')
    .replace(/\\/g, '/') // normalise Windows separators
    .split('/').pop() || '' // drop any path, keep the basename
  const cleaned = base
    .replace(/[\x00-\x1f]/g, '') // control chars
    .replace(/[^A-Za-z0-9._ ()\-]/g, '_') // keep a friendly whitelist
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '') // no leading dots (hidden / traversal)
    .trim()
    .slice(0, 120)
  return cleaned || 'file'
}

export interface DecodeInput { filename?: string; mime?: string; data?: string }
export interface DecodeResult {
  ok: boolean
  error?: string
  buffer?: Buffer
  size?: number
  safeName?: string
  mime?: string
}

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/

// Validate + decode a base64 upload. Accepts a bare base64 string or a data URL
// (`data:<mime>;base64,<payload>`); never throws.
export function decodeAndValidate(input: DecodeInput): DecodeResult {
  const filename = String(input.filename || '').trim()
  if (!filename) return { ok: false, error: 'filename is required' }

  let raw = String(input.data ?? '')
  let mime = String(input.mime || '').trim()
  const dataUrl = raw.match(/^data:([^;,]*)(;base64)?,(.*)$/s)
  if (dataUrl) {
    if (!mime && dataUrl[1]) mime = dataUrl[1]
    raw = dataUrl[3]
  }
  raw = raw.replace(/\s/g, '')
  if (!raw) return { ok: false, error: 'file data is empty' }
  if (!BASE64_RE.test(raw)) return { ok: false, error: 'file data is not valid base64' }

  const buffer = Buffer.from(raw, 'base64')
  if (buffer.length === 0) return { ok: false, error: 'file data is empty' }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: `file exceeds the ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB limit` }
  }

  return {
    ok: true,
    buffer,
    size: buffer.length,
    safeName: sanitizeFilename(filename),
    mime: mime || 'application/octet-stream',
  }
}

// Disk name for a stored attachment: id-prefixed so it is unique even when two
// uploads share a filename, and the original (sanitized) name is preserved for
// download Content-Disposition.
export function storageName(id: number, safeName: string): string {
  return `${id}__${safeName}`
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
