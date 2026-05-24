/**
 * Resolve backend API base URL for all environments.
 * Production falls back to same-origin /api (Vercel rewrite) when env is unset.
 */
export function resolveApiBase() {
  const configured = import.meta.env.VITE_API_BASE_URL
  if (configured && String(configured).trim()) {
    return String(configured).trim().replace(/\/$/, '')
  }
  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:8000'
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return 'https://arrifection-happiness-exchange.hf.space'
}

export function apiUrl(path) {
  const base = resolveApiBase()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}
