/**
 * Production API lives on Hugging Face Spaces.
 * Do NOT default to same-origin /api on Vercel — that serverless route times out in production.
 */
export const PRODUCTION_API_BASE = 'https://arrifection-happiness-exchange.hf.space'
const PRODUCTION_API_HOST = 'arrifection-happiness-exchange.hf.space'

function normalizeConfiguredApiBase(raw) {
  const trimmed = String(raw || '').trim().replace(/\/$/, '')
  if (!trimmed) return null

  let candidate = trimmed
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`
  }

  try {
    const url = new URL(candidate)
    const host = url.hostname.toLowerCase()

    // Recover from truncated Hugging Face Space hostnames in env config.
    if (
      host.includes('arrifection-happiness')
      && host !== PRODUCTION_API_HOST
      && host.endsWith('.hf.space')
    ) {
      return PRODUCTION_API_BASE
    }

    if (host === 'localhost' || host === '127.0.0.1') {
      return url.origin
    }

    if (host.includes('.')) {
      return url.origin
    }

    return null
  } catch {
    return null
  }
}

export function resolveApiBase() {
  const configured = normalizeConfiguredApiBase(import.meta.env.VITE_API_BASE_URL)
  if (configured) return configured
  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:8000'
  }
  return PRODUCTION_API_BASE
}

export function apiUrl(path) {
  const base = resolveApiBase()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}

/** API responses are not always arrays — never call .find/.map on raw data. */
export function asArray(value) {
  return Array.isArray(value) ? value : []
}
