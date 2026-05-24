/**
 * Production API lives on Hugging Face Spaces.
 * Do NOT default to same-origin /api on Vercel — that serverless route times out in production.
 */
export const PRODUCTION_API_BASE = 'https://arrifection-happiness-exchange.hf.space'

export function resolveApiBase() {
  const configured = import.meta.env.VITE_API_BASE_URL
  if (configured && String(configured).trim()) {
    return String(configured).trim().replace(/\/$/, '')
  }
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
