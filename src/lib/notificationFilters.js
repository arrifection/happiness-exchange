/** Staff roles that may see platform/admin alerts in the notification bell. */
const STAFF_ROLES = new Set(['moderator', 'admin', 'super_admin'])

/** Notification types intended for admin/moderator panels only. */
const ADMIN_NOTIFICATION_TYPES = new Set([
  'new_user_signup',
  'new_item_listed',
  'low_rating_review',
  'suspicious_activity',
  'delivery_match_created',
])

/** Fallback title patterns when type is missing or legacy. */
const ADMIN_TITLE_PATTERNS = [
  /^new user signup$/i,
  /^new item listed$/i,
  /needs review/i,
  /has joined the platform/i,
  /suspicious activity/i,
]

export function isStaffUser(role) {
  return STAFF_ROLES.has(String(role || 'user').toLowerCase())
}

export function isAdminNotification(notification) {
  if (!notification) return false

  const type = String(notification.type || '').toLowerCase()
  if (ADMIN_NOTIFICATION_TYPES.has(type)) return true
  if (type.endsWith('_reported')) return true

  const title = String(notification.title || '').trim()
  return ADMIN_TITLE_PATTERNS.some((pattern) => pattern.test(title))
}

/** Return notifications for the main app navbar bell (never admin/platform alerts). */
export function filterNotificationsForUser(notifications) {
  if (!Array.isArray(notifications)) return []
  return notifications.filter((notification) => !isAdminNotification(notification))
}

export const USER_NOTIFICATION_EMPTY_TITLE = 'No new notifications yet'
export const USER_NOTIFICATION_EMPTY_DESCRIPTION =
  'We\u2019ll let you know when someone requests your item, posts a need, or leaves a review.'
