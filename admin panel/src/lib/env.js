export const PRODUCTION_API_BASE = 'https://arrifection-happiness-exchange.hf.space'

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0'])
const LOCAL_DEV_API_BASE = 'http://localhost:8000'

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
          '[Admin panel] Ignoring localhost API URL on a deployed host. Using Hugging Face backend.',
        )
        return PRODUCTION_API_BASE
      }
      return fromEnv
    } catch {
      // Invalid URL in env — fall through to defaults.
    }
  }

  if (isProductionHost() || import.meta.env.PROD) {
    return PRODUCTION_API_BASE
  }

  return LOCAL_DEV_API_BASE
}

export const API_BASE_URL = resolveApiBaseUrl()

export const APP_NAME =
  import.meta.env.VITE_APP_NAME || 'Happiness Exchange Admin'

if (import.meta.env.DEV) {
  console.info('Admin API base:', API_BASE_URL)
}
