const WAKEUP_DELAY_MS = 4000

let visible = false
let listener = null
let bootstrapPending = 0
let wakeupTimer = null

function notify() {
  listener?.(visible)
}

export function subscribeBackendWakeup(onChange) {
  listener = onChange
  onChange(visible)
  return () => {
    if (listener === onChange) {
      listener = null
    }
  }
}

export function dismissBackendWakeup() {
  visible = false
  notify()
}

function scheduleWakeupTimer() {
  if (wakeupTimer) return
  wakeupTimer = window.setTimeout(() => {
    if (bootstrapPending > 0) {
      visible = true
      notify()
    }
  }, WAKEUP_DELAY_MS)
}

function clearWakeupTimer() {
  if (!wakeupTimer) return
  window.clearTimeout(wakeupTimer)
  wakeupTimer = null
}

/** Track initial app bootstrap fetches; show wakeup UI if any exceed 4s. */
export function trackBootstrapFetch(input, init) {
  bootstrapPending += 1
  scheduleWakeupTimer()

  const request = fetch(input, init)
  request.finally(() => {
    bootstrapPending = Math.max(0, bootstrapPending - 1)
    if (bootstrapPending === 0) {
      clearWakeupTimer()
      visible = false
      notify()
    }
  })
  return request
}
