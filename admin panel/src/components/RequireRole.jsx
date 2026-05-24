import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import AccessDenied from './AccessDenied'

export default function RequireRole({ requiredRole, children }) {
  const { hasRole } = useAuth()
  if (requiredRole && !hasRole(requiredRole)) {
    return <AccessDenied requiredRole={requiredRole} />
  }
  return <>{children}</>
}
