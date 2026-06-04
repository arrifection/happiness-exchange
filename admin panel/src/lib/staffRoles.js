export const ADMIN_VIEWER_ROLES = ['admin', 'super_admin', 'moderator']

export function normalizeRole(role) {
  return (role || '').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
}

export function isStaffViewerRole(role) {
  return ADMIN_VIEWER_ROLES.includes(normalizeRole(role))
}
