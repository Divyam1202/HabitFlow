import { createHash } from 'crypto'

/**
 * Deterministic 0-99 bucket for a userId. Same userId always maps to the
 * same bucket, so canary membership is stable across runs — required for
 * comparing a cohort's delivery reliability over multiple days rather than
 * getting a different random sample every tick.
 */
export function canaryBucket(userId: string): number {
  const hash = createHash('sha256').update(userId).digest('hex')
  // Use first 8 hex chars as a uint32, mod 100.
  const n = parseInt(hash.slice(0, 8), 16)
  return n % 100
}

/**
 * CANARY_PERCENT env var controls rollout: 0 = nobody on new path (Phase 2
 * shadow-only), 100 = everybody on new path (Phase 4 end state).
 * Read fresh on every call — no caching — so an env var change takes effect
 * on the next cron tick without a redeploy.
 */
export function isCanaryUser(userId: string): boolean {
  const percent = parseInt(process.env.CANARY_PERCENT || '0', 10)
  if (Number.isNaN(percent) || percent <= 0) return false
  if (percent >= 100) return true
  return canaryBucket(userId) < percent
}

export function getCanaryPercent(): number {
  const percent = parseInt(process.env.CANARY_PERCENT || '0', 10)
  return Number.isNaN(percent) ? 0 : Math.max(0, Math.min(100, percent))
}