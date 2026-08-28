/**
 * Resolve the in-app page a notification should open.
 *
 * Notifications already carry an ``action_url``, but some are stored with API
 * paths ("/requests/incoming", "/requests/my") that are not app routes, and some
 * carry an id that never resolved. Navigating to those lands the user on the
 * catch-all redirect instead of the page the notification is about.
 *
 * This resolver only ever returns a route that exists in App.jsx, so navigation
 * can never dead-end. It grants no access by itself: every destination page
 * still loads its data through the existing authorized endpoints.
 */

/** Routes with no parameter that a notification may open. */
const STATIC_ROUTES = new Set([
  '/',
  '/browse',
  '/needs',
  '/give',
  '/dashboard',
  '/swaps',
  '/requests',
  '/deliveries',
  '/reputation',
  '/profile',
])

/** Parameterised routes, with the page to use when the id is unusable. */
const DYNAMIC_ROUTES = [
  { prefix: '/items/', fallback: '/browse' },
  { prefix: '/exchange/', fallback: '/swaps' },
  { prefix: '/tracking/', fallback: '/deliveries' },
  { prefix: '/deliveries/', fallback: '/deliveries' },
]

/** Stored action_urls that were API paths rather than app routes. */
const LEGACY_PATHS = new Map([
  ['/requests/incoming', '/requests'],
  ['/requests/my', '/requests'],
  ['/exchange-offers', '/swaps'],
  ['/settings', '/profile'],
])

/** Type prefix → destination, used when the stored url cannot be trusted. */
const TYPE_ROUTES = [
  ['exchange_', '/swaps'],
  ['swap_', '/swaps'],
  ['request_', '/requests'],
  ['giveaway_', '/requests'],
  ['new_message', '/requests'],
  ['item_', '/dashboard'],
  ['review_', '/profile'],
  ['delivery_', '/deliveries'],
  ['shipment_', '/deliveries'],
]

export const NOTIFICATION_FALLBACK_ROUTE = '/dashboard'

const UNUSABLE_IDS = new Set(['none', 'null', 'undefined', 'nan'])

function isUsableId(value) {
  if (!value) return false
  if (value.includes('/')) return false
  return !UNUSABLE_IDS.has(value.trim().toLowerCase())
}

function routeForType(type) {
  const normalized = String(type || '').toLowerCase()
  if (!normalized) return null
  for (const [prefix, route] of TYPE_ROUTES) {
    if (normalized.startsWith(prefix)) return route
  }
  return null
}

function stripTrailingSlash(path) {
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

export function resolveNotificationTarget(notification) {
  const typeRoute = routeForType(notification?.type)
  const rawUrl = String(notification?.action_url ?? '').trim()

  // Reject anything that is not an in-app path, including protocol-relative
  // urls, so a notification can never redirect off the site.
  if (!rawUrl.startsWith('/') || rawUrl.startsWith('//')) {
    return typeRoute || NOTIFICATION_FALLBACK_ROUTE
  }

  // Direct messaging is disabled; these notifications belong on the requests page.
  if (rawUrl.startsWith('/messages') || /[?&]conversation=/.test(rawUrl)) {
    return '/requests'
  }

  const path = stripTrailingSlash(rawUrl.split(/[?#]/)[0])

  const legacy = LEGACY_PATHS.get(path)
  if (legacy) return legacy

  if (STATIC_ROUTES.has(path)) return path

  for (const { prefix, fallback } of DYNAMIC_ROUTES) {
    if (!path.startsWith(prefix)) continue
    const id = path.slice(prefix.length)
    // A well-formed id is navigated to even if the target was since deleted:
    // the destination pages already render their own "not found" state.
    if (isUsableId(id)) return path
    return typeRoute || fallback
  }

  return typeRoute || NOTIFICATION_FALLBACK_ROUTE
}
