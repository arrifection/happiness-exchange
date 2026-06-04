export const AUTH_CLEARED_EVENT = 'admin-auth-cleared'

export function notifyAuthCleared() {
  window.dispatchEvent(new Event(AUTH_CLEARED_EVENT))
}

export function isPublicAdminPath(pathname = window.location.pathname) {
  return pathname === '/login'
    || pathname.startsWith('/login/')
    || pathname === '/accept-invite'
    || pathname.startsWith('/accept-invite/')
}
