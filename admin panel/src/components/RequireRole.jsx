import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import AccessDenied from './AccessDenied'

export default function RequireRole({ requiredRole, permission, children }) {
  const { hasRole, canAccess } = useAuth()

  if (permission) {
    if (!canAccess(permission)) {
      return <AccessDenied permission={permission} />
    }
    return <>{children}</>
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <AccessDenied requiredRole={requiredRole} />
  }
  return <>{children}</>
}
