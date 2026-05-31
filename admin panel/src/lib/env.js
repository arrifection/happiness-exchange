export const PRODUCTION_API_BASE = 'https://arrifection-happiness-exchange.hf.space'

function normalizeApiBase(raw) {
  const trimmed = String(raw || '').trim().replace(/\/$/, '')
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export const API_BASE_URL = (() => {
  const configured = normalizeApiBase(import.meta.env.VITE_API_BASE_URL)
  if (configured) return configured
  if (import.meta.env.DEV) return 'http://localhost:8000'
  return PRODUCTION_API_BASE
})()

export const APP_NAME =
  import.meta.env.VITE_APP_NAME || 'Happiness Exchange Admin'
