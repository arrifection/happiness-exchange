export const PRODUCTION_API_BASE = 'https://arrifection-happiness-exchange.hf.space'

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0'])

function normalizeApiBase(raw) {
  const trimmed = String(raw || '').trim().replace(/\/$/, '')
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function isProductionHost() {
  if (typeof window === 'undefined') return import.meta.env.PROD
  const host = window.location.hostname.toLowerCase()
  return !LOCALHOST_HOSTS.has(host)
}

function resolveApiBaseUrl() {
  const fromEnv = normalizeApiBase(
    import.meta.env.VITE_API_URL
    || import.meta.env.VITE_API_BASE_URL,
  )

  if (fromEnv) {
    try {
      const host = new URL(fromEnv).hostname.toLowerCase()
      if (isProductionHost() && LOCALHOST_HOSTS.has(host)) {
        console.warn(
          '[Admin panel] Ignoring localhost API URL in production. Using Hugging Face backend.',
        )
        return PRODUCTION_API_BASE
      }
    } catch {
      // fall through to defaults below
    }
    return fromEnv
  }

  if (import.meta.env.DEV) return 'http://localhost:8000'
  return PRODUCTION_API_BASE
}

export const API_BASE_URL = resolveApiBaseUrl()

export const APP_NAME =
  import.meta.env.VITE_APP_NAME || 'Happiness Exchange Admin'

if (import.meta.env.DEV) {
  console.info('[Admin panel] API base URL:', API_BASE_URL)
}
