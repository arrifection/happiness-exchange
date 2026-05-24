export const BACKEND_ERROR_MESSAGE = 'Unable to connect to backend.'

export function isBackendUnreachable(error) {
  if (!error) return false
  if (error.response) return false
  const code = error.code
  const message = error.message || ''
  return (
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    message.includes('Network Error')
  )
}

export function resolveApiError(error, fallback = 'Something went wrong.') {
  if (isBackendUnreachable(error)) return BACKEND_ERROR_MESSAGE
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(', ')
  return error?.message || fallback
}
