import { ROLES } from './roles'
import { normalizeRole } from './staffRoles'

export const PERMISSIONS = {
  DASHBOARD: 'dashboard',
  LISTINGS: 'listings',
  MESSAGES: 'messages',
  REVIEWS: 'reviews',
  DELIVERIES: 'deliveries',
  REQUESTS: 'requests',
  REPORTS: 'reports',
  USERS: 'users',
  ANALYTICS: 'analytics',
  TEAM: 'team',
}

const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: new Set(Object.values(PERMISSIONS)),
  [ROLES.MODERATOR]: new Set([
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.LISTINGS,
    PERMISSIONS.MESSAGES,
    PERMISSIONS.REVIEWS,
    PERMISSIONS.REQUESTS,
    PERMISSIONS.REPORTS,
    PERMISSIONS.USERS,
  ]),
  [ROLES.ADMIN]: new Set([
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.LISTINGS,
    PERMISSIONS.MESSAGES,
    PERMISSIONS.REVIEWS,
    PERMISSIONS.DELIVERIES,
  ]),
  [ROLES.COURIER]: new Set([
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.DELIVERIES,
  ]),
}

export function canAccess(role, permission) {
  if (!role || !permission) return false
  const normalized = normalizeRole(role)
  return ROLE_PERMISSIONS[normalized]?.has(permission) ?? false
}

export function defaultRouteForRole(role) {
  if (canAccess(role, PERMISSIONS.DASHBOARD)) return '/dashboard'
  if (canAccess(role, PERMISSIONS.LISTINGS)) return '/listings'
  if (canAccess(role, PERMISSIONS.DELIVERIES)) return '/courier'
  return '/login'
}
