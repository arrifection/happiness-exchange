const FLASH_EVENT = 'he:flash'

export function showFlash(message, durationMs = 4500) {
  if (!message) return
  window.dispatchEvent(new CustomEvent(FLASH_EVENT, { detail: { message, durationMs } }))
}

export function subscribeFlash(callback) {
  function handler(event) {
    callback(event.detail)
  }
  window.addEventListener(FLASH_EVENT, handler)
  return () => window.removeEventListener(FLASH_EVENT, handler)
}
