import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Loader2 } from 'lucide-react'

/**
 * ProtectedRoute — wraps any route that requires authentication.
 * Optionally enforces a minimum role level.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.requiredRole] — one of ROLES values
 * @param {string} [props.redirectTo='/login']
 */
export default function ProtectedRoute({
  children,
  requiredRole,
  redirectTo = '/login',
}) {
  const { isAuthenticated, loading, hasRole, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-surface-500 text-sm">Verifying session…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-surface-100 mb-2">Access Denied</h1>
          <p className="text-surface-400 text-sm mb-6">
            Your role (<span className="text-brand-400 font-mono">{user?.role}</span>) does not
            have permission to access this page. Required:{' '}
            <span className="text-amber-400 font-mono">{requiredRole}</span>.
          </p>
          <button
            className="btn-secondary"
            onClick={() => window.history.back()}
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return children
}
