import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AccessDenied from './AccessDenied';

/**
 * RequireRole – renders children only if the current user has at least the required role.
 * `requiredRole` should be one of the ROLES values (e.g., ROLES.ADMIN).
 * If the user lacks permission, a friendly "Access restricted" card is shown.
 */
export default function RequireRole({ requiredRole, children }) {
  const { hasRole, isDemo } = useAuth();
  if (isDemo) return children; // demo mode bypasses role checks
  if (requiredRole && !hasRole(requiredRole)) {
    return <AccessDenied requiredRole={requiredRole} />;
  }
  return <>{children}</>;
}
