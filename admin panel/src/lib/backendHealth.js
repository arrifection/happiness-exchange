import api from './api'
import { isBackendUnreachable, STATUS_ENDPOINT } from './backend'


export async function fetchBackendHealthStatus(options = {}) {
  const { dataRequestSucceeded = false } = options

  try {
    const res = await api.get(STATUS_ENDPOINT, { timeout: 15000 })
    const payload = res.data
    if (res.status >= 200 && res.status < 300) {
      if (payload?.status === 'online' || payload?.database === 'connected') {
        return 'online'
      }
      return 'online'
    }
  } catch (error) {
    if (dataRequestSucceeded && !error.response) {
      return 'online'
    }
    if (dataRequestSucceeded && error.response?.status >= 200 && error.response?.status < 500) {
      return 'online'
    }
    if (dataRequestSucceeded && isBackendUnreachable(error)) {
      return 'online'
    }
  }

  if (dataRequestSucceeded) return 'online'
  return 'offline'
}
