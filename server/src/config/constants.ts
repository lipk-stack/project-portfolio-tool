// Central home for security/auth tunables that were previously duplicated as
// magic literals across auth routes, the auth middleware, and the realtime
// gateway. Keeping them here means the JWT signing secret and verification
// secret can never drift apart, and the bcrypt cost / token lifetime are tuned
// in exactly one place.

/**
 * Secret used to BOTH sign (routes/auth) and verify (middleware, realtime) JWTs.
 * Must be identical everywhere — that is the whole reason this lives here.
 * Set JWT_SECRET in the environment for production; the dev fallback only keeps
 * local/demo runs working out of the box.
 *
 * Read once at module load. `import 'dotenv/config'` runs first in index.ts, so
 * the environment is already populated by the time this module is imported.
 */
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

/** JWT lifetime. 7 days balances convenience against re-auth frequency. */
export const JWT_EXPIRY = '7d'

/** bcrypt cost factor for password hashing (≈ login latency vs brute-force cost). */
export const BCRYPT_ROUNDS = 10

/** Minimum length enforced on registration. */
export const MIN_PASSWORD_LENGTH = 6
