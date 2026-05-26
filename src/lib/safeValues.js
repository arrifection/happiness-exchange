export function safeString(value, fallback = '') {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || fallback
  }
  if (value == null) {
    return fallback
  }
  return String(value)
}

export function safeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function safeArray(value) {
  return Array.isArray(value) ? value : []
}
