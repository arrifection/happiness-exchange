/**
 * ApiHealthContext — shared backend status across all admin pages.
 *
 * Pages that successfully load data call `signalDataSuccess()` to mark the
 * backend as online without waiting for the polling health-check. The TopBar
 * subscribes to this context instead of running its own isolated fetch.
 */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { fetchBackendHealthStatus } from '../lib/backendHealth'

const ApiHealthContext = createContext({
  status: 'checking',    // 'checking' | 'online' | 'offline'
  signalDataSuccess: () => {},
})

const POLL_INTERVAL_MS = 30_000

export function ApiHealthProvider({ children }) {
  const [status, setStatus] = useState('checking')
  const cancelledRef = useRef(false)

  const doCheck = useCallback(async (dataRequestSucceeded = false) => {
    const next = await fetchBackendHealthStatus({ dataRequestSucceeded })
    if (!cancelledRef.current) setStatus(next)
  }, [])

  /** Called by any page that successfully loaded data from the API. */
  const signalDataSuccess = useCallback(() => {
    // Skip the health-check round-trip — we know the backend is reachable.
    if (!cancelledRef.current) setStatus('online')
  }, [])

  useEffect(() => {
    cancelledRef.current = false
    doCheck()
    const interval = setInterval(() => doCheck(), POLL_INTERVAL_MS)
    return () => {
      cancelledRef.current = true
      clearInterval(interval)
    }
  }, [doCheck])

  return (
    <ApiHealthContext.Provider value={{ status, signalDataSuccess }}>
      {children}
    </ApiHealthContext.Provider>
  )
}

export function useApiHealth() {
  return useContext(ApiHealthContext)
}
