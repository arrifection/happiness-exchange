import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { SessionLoadingScreen } from './BootFallback'

export default function ProtectedRoute({
  children,
  requiredRole,
  redirectTo = '/login',
}) {
  const { isAuthenticated, loading, bootTimedOut, hasRole, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return <SessionLoadingScreen timedOut={bootTimedOut} />
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-surface-800 mb-2">Access Denied</h1>
          <p className="text-surface-500 text-sm mb-6">
            Your role (<span className="text-brand-600 font-mono font-medium">{user?.role}</span>) does not
            have permission to access this page. Required:{' '}
            <span className="text-accent-600 font-mono font-medium">{requiredRole}</span>.
          </p>
          <button
            type="button"
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
