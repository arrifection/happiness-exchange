import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../lib/api'
import { BACKEND_ERROR_MESSAGE, isBackendUnreachable } from '../lib/backend'
import { canAccess as roleCanAccess } from '../lib/adminPermissions'
import { AUTH_CLEARED_EVENT } from '../lib/authEvents'
import { ROLES, ROLE_HIERARCHY } from '../lib/roles'
import { normalizeRole } from '../lib/staffRoles'

export { ROLES } from '../lib/roles'

const AUTH_BOOT_TIMEOUT_MS = 8000

const AuthContext = createContext(null)

function readStoredUser() {
  try {
    const stored = localStorage.getItem('admin_user')
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function normalizeStaffUser(raw) {
  if (!raw || typeof raw !== 'object') return null
  const base = raw.user && raw.user.role ? raw.user : raw
  const role = normalizeRole(base.role)
  if (!role || !Object.values(ROLES).includes(role)) return null
  return { ...base, role }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => normalizeStaffUser(readStoredUser()))
  const [token, setToken] = useState(() => localStorage.getItem('admin_token'))
  const [loading, setLoading] = useState(true)
  const [bootTimedOut, setBootTimedOut] = useState(false)

  const logout = useCallback(() => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    const onAuthCleared = () => logout()
    window.addEventListener(AUTH_CLEARED_EVENT, onAuthCleared)
    return () => window.removeEventListener(AUTH_CLEARED_EVENT, onAuthCleared)
  }, [logout])

  useEffect(() => {
    let cancelled = false
    setBootTimedOut(false)

    if (!token) {
      setLoading(false)
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        setBootTimedOut(true)
        setLoading(false)
      }
    }, AUTH_BOOT_TIMEOUT_MS)

    const verify = async () => {
      try {
        const res = await authApi.me()
        if (cancelled) return
        const userData = normalizeStaffUser(res.data)
        if (!userData) throw new Error('Insufficient permissions')
        setUser(userData)
        localStorage.setItem('admin_user', JSON.stringify(userData))
      } catch {
        if (!cancelled) logout()
      } finally {
        if (!cancelled) {
          window.clearTimeout(timeoutId)
          setLoading(false)
        }
      }
    }

    verify()
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [token, logout])

  const login = useCallback(async (email, password) => {
    try {
      const res = await authApi.login({ email, password })
      const payload = res.data || {}
      const accessToken = payload.access_token
      const userData = normalizeStaffUser(payload.user || payload)
      if (!accessToken || !userData) {
        throw new Error('You do not have admin access to this panel.')
      }
      localStorage.setItem('admin_token', accessToken)
      localStorage.setItem('admin_user', JSON.stringify(userData))
      setToken(accessToken)
      setUser(userData)
      setBootTimedOut(false)
      return payload
    } catch (err) {
      if (isBackendUnreachable(err)) {
        throw new Error(BACKEND_ERROR_MESSAGE)
      }
      throw err
    }
  }, [])

  const hasRole = useCallback((requiredRole) => {
    if (!user?.role) return false
    const normalized = normalizeRole(user.role)
    return (ROLE_HIERARCHY[normalized] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 99)
  }, [user])

  const canAccess = useCallback(
    (permission) => roleCanAccess(normalizeRole(user?.role), permission),
    [user],
  )

  const isSuperAdmin = useCallback(() => hasRole(ROLES.SUPER_ADMIN), [hasRole])
  const isAdmin      = useCallback(() => hasRole(ROLES.ADMIN),       [hasRole])
  const isModerator  = useCallback(() => hasRole(ROLES.MODERATOR),   [hasRole])
  const isCourier    = useCallback(() => hasRole(ROLES.COURIER),     [hasRole])

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      bootTimedOut,
      isAuthenticated: !!token && !!user,
      login,
      logout,
      hasRole,
      canAccess,
      isSuperAdmin,
      isAdmin,
      isModerator,
      isCourier,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
