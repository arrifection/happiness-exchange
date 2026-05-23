import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../lib/api'

// ── Roles ─────────────────────────────────────────────────────────────────────
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN:       'admin',
  MODERATOR:   'moderator',
  COURIER:     'courier',
}

const ROLE_HIERARCHY = {
  [ROLES.SUPER_ADMIN]: 4,
  [ROLES.ADMIN]:       3,
  [ROLES.MODERATOR]:   2,
  [ROLES.COURIER]:     1,
}

// ── Context ────────────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => {
    try {
      const stored = localStorage.getItem('admin_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [token, setToken]     = useState(() => localStorage.getItem('admin_token'))
  const [loading, setLoading] = useState(true)

  // Verify token on mount
  useEffect(() => {
    const verify = async () => {
      if (!token) { setLoading(false); return }
      // Skip backend verification for demo sessions
      if (token === 'demo_mode_token') { setLoading(false); return }
      try {
        const res = await authApi.me()
        const userData = res.data
        // Ensure user has an admin role
        if (!userData.role || !Object.values(ROLES).includes(userData.role)) {
          throw new Error('Insufficient permissions')
        }
        setUser(userData)
        localStorage.setItem('admin_user', JSON.stringify(userData))
      } catch {
        logout()
      } finally {
        setLoading(false)
      }
    }
    verify()
  }, [token]) // eslint-disable-line

  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ username: email, password })
    const { access_token, ...userData } = res.data

    // Role gate: only allow admin-tier accounts
    const userRole = userData.role || res.data.user?.role
    if (!userRole || !Object.values(ROLES).includes(userRole)) {
      throw new Error('You do not have admin access to this panel.')
    }

    localStorage.setItem('admin_token', access_token)
    localStorage.setItem('admin_user', JSON.stringify(userData.user || userData))
    setToken(access_token)
    setUser(userData.user || userData)
    return res.data
  }, [])

  // ── Demo login — no backend needed ───────────────────────────────────────────
  const demoLogin = useCallback(() => {
    const demoUser = {
      full_name: 'Demo Admin',
      username:  'demo_admin',
      email:     'demo@happinessexchange.com',
      role:      ROLES.SUPER_ADMIN,
      is_demo:   true,
    }
    localStorage.setItem('admin_token', 'demo_mode_token')
    localStorage.setItem('admin_user', JSON.stringify(demoUser))
    setToken('demo_mode_token')
    setUser(demoUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    setToken(null)
    setUser(null)
  }, [])

  // ── Role checks ──────────────────────────────────────────────────────────────
  const hasRole = useCallback((requiredRole) => {
    if (!user?.role) return false
    return (ROLE_HIERARCHY[user.role] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 99)
  }, [user])

  const isSuperAdmin = useCallback(() => hasRole(ROLES.SUPER_ADMIN), [hasRole])
  const isAdmin      = useCallback(() => hasRole(ROLES.ADMIN),       [hasRole])
  const isModerator  = useCallback(() => hasRole(ROLES.MODERATOR),   [hasRole])
  const isCourier    = useCallback(() => hasRole(ROLES.COURIER),     [hasRole])

  const isDemo = user?.is_demo === true

  return (
    <AuthContext.Provider value={{
      user, token, loading, isAuthenticated: !!token && !!user,
      login, demoLogin, logout,
      hasRole, isSuperAdmin, isAdmin, isModerator, isCourier,
      isDemo,
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
