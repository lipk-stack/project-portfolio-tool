import crypto from 'crypto'

export const TOKEN_PREFIX = 'ppt_'

export function generateToken(): { token: string; hash: string; prefix: string } {
  const token = TOKEN_PREFIX + crypto.randomBytes(24).toString('hex')
  return { token, hash: hashToken(token), prefix: token.slice(0, 12) }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function isApiToken(bearer: string): boolean {
  return bearer.startsWith(TOKEN_PREFIX)
}
