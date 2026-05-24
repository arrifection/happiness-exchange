/** 10-minute resend cooldown — aligned with backend rate limit. */
export const RESEND_COOLDOWN_MS = 10 * 60 * 1000
const STORAGE_PREFIX = 'he_verification_resend_until_'

export function getResendCooldownUntil(userId) {
  if (!userId) return 0
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`)
  const until = raw ? parseInt(raw, 10) : 0
  return Number.isFinite(until) ? until : 0
}

export function setResendCooldown(userId, untilMs = Date.now() + RESEND_COOLDOWN_MS) {
  if (!userId) return
  localStorage.setItem(`${STORAGE_PREFIX}${userId}`, String(untilMs))
}

export function syncResendCooldownFromSeconds(userId, retryAfterSeconds) {
  if (!userId || !retryAfterSeconds) return
  setResendCooldown(userId, Date.now() + retryAfterSeconds * 1000)
}

export function getResendCooldownRemainingMs(userId) {
  return Math.max(0, getResendCooldownUntil(userId) - Date.now())
}

export function formatResendCooldown(ms) {
  const totalSec = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function parseApiErrorDetail(errorData, fallbackMessage) {
  const detail = errorData?.detail
  if (typeof detail === 'string') return { message: detail, retryAfterSeconds: null }
  if (detail && typeof detail === 'object') {
    return {
      message: detail.message || fallbackMessage,
      retryAfterSeconds: detail.retry_after_seconds ?? null,
    }
  }
  return { message: fallbackMessage, retryAfterSeconds: null }
}
