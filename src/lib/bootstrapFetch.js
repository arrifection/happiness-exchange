import { trackBootstrapFetch } from './backendWakeup.js'

export const SERVER_STARTING_MESSAGE = 'Server is starting, please wait…'
export const SERVER_STARTING_DETAIL =
  'The backend is waking up from sleep. This usually takes about 30 seconds on first load.'

export const BOOTSTRAP_RETRY_ATTEMPTS = 6
export const BOOTSTRAP_RETRY_BASE_DELAY_MS = 2500
export const BOOTSTRAP_FETCH_TIMEOUT_MS = 25000

export function isTransientNetworkError(error) {
  if (!error) return false
  const name = error.name || ''
  const message = String(error.message || '')
  return (
    name === 'AbortError'
    || name === 'TypeError'
    || message.includes('Failed to fetch')
    || message.includes('NetworkError')
    || message.includes('Load failed')
    || message.includes('Network request failed')
  )
}

export function isServerStartingErrorMessage(message) {
  return String(message || '').includes(SERVER_STARTING_MESSAGE)
}

/** Retry bootstrap fetches during HF cold starts; first attempt is tracked for wakeup UI. */
export async function fetchWithBootstrapRetry(input, init = {}, options = {}) {
  const attempts = options.attempts ?? BOOTSTRAP_RETRY_ATTEMPTS
  const baseDelayMs = options.baseDelayMs ?? BOOTSTRAP_RETRY_BASE_DELAY_MS
  const timeoutMs = options.timeoutMs ?? BOOTSTRAP_FETCH_TIMEOUT_MS
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

    try {
      const fetchFn = attempt === 1 ? trackBootstrapFetch : fetch
      const response = await fetchFn(input, {
        ...init,
        signal: controller.signal,
      })
      window.clearTimeout(timeoutId)
      return response
    } catch (error) {
      window.clearTimeout(timeoutId)
      lastError = error
      if (attempt < attempts && isTransientNetworkError(error)) {
        await new Promise((resolve) => window.setTimeout(resolve, baseDelayMs * attempt))
        continue
      }
      throw error
    }
  }

  throw lastError
}
